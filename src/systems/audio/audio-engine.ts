import type { SettingsV1 } from '../storage/schema';
import { BGM_NAME, SFX_MAP, type SfxEvent } from './sfx-map';
import { pickAudioFile } from './asset-urls';

export const SFX_THROTTLE_MS = 100;
const MASTER_GAIN = 0.9;

export const volumeToGain = (volume: number): number => {
  const v = Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) : 0;
  return Math.pow(v / 100, 1.5);
};

export interface AudioEngineDeps {
  createContext?: () => AudioContext | null;
  canPlay?: (type: string) => boolean;
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>;
  now?: () => number;
  resolveBgm?: (name: string) => string | null;
}

type SettingsAudio = Pick<SettingsV1, 'bgmEnabled' | 'bgmVolume' | 'sfxEnabled' | 'sfxVolume'>;

const defaultCanPlay = (type: string): boolean => {
  try {
    return typeof Audio !== 'undefined' && new Audio().canPlayType(type) !== '';
  } catch {
    return false;
  }
};

/**
 * WebAudio 引擎：首次手势后解锁；BGM 循环 + 13 事件音效；
 * 解码失败静默降级并置 unavailable（REQ-045~048）。
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly pending = new Map<string, Promise<AudioBuffer | null>>();
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmOffset = 0;
  private bgmStartedAt = 0;
  private readonly lastPlayedAt = new Map<string, number>();
  private unlocked = false;
  unavailable = false;
  private settings: SettingsAudio = { bgmEnabled: true, bgmVolume: 60, sfxEnabled: true, sfxVolume: 80 };
  private readonly deps: Required<Pick<AudioEngineDeps, 'canPlay' | 'fetchArrayBuffer' | 'now'>> & AudioEngineDeps;

  constructor(deps: AudioEngineDeps = {}) {
    this.deps = {
      canPlay: deps.canPlay ?? defaultCanPlay,
      fetchArrayBuffer: deps.fetchArrayBuffer ?? ((url) => fetch(url).then((r) => r.arrayBuffer())),
      now: deps.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now())),
      ...deps,
    };
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  get isPlayingBgm(): boolean {
    return this.bgmSource !== null;
  }

  setSettings(settings: SettingsAudio): void {
    this.settings = { ...settings };
    if (this.ctx && this.bgmGain && this.sfxGain) {
      this.bgmGain.gain.value = volumeToGain(settings.bgmVolume);
      this.sfxGain.gain.value = volumeToGain(settings.sfxVolume);
    }
    if (!settings.bgmEnabled) this.stopBgm();
    else if (this.unlocked && this.ctx) void this.startBgm();
  }

  /** 首次用户手势调用（pointerdown/click）。 */
  unlock(): void {
    if (this.unavailable) return;
    this.ensureContext();
    if (!this.ctx) return;
    this.unlocked = true;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.settings.bgmEnabled) void this.startBgm();
  }

  async playSfx(event: SfxEvent): Promise<void> {
    if (!this.settings.sfxEnabled || this.unavailable) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = this.deps.now();
    const last = this.lastPlayedAt.get(event) ?? -Infinity;
    if (now - last < SFX_THROTTLE_MS) return;
    this.lastPlayedAt.set(event, now);

    const file = pickAudioFile(SFX_MAP[event], this.deps.canPlay);
    if (!file) return;
    const buffer = await this.loadBuffer(file);
    if (!buffer || !this.sfxGain) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.sfxGain);
      source.start();
    } catch {
      this.fail();
    }
  }

  onVisibility(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) {
      if (this.bgmSource) {
        this.bgmOffset = this.currentBgmOffset();
        try {
          this.bgmSource.stop();
        } catch {
          // already stopped
        }
        this.bgmSource = null;
      }
      void this.ctx.suspend();
    } else {
      void this.ctx.resume();
      if (this.unlocked && this.settings.bgmEnabled) void this.startBgm();
    }
  }

  dispose(): void {
    this.stopBgm();
    if (this.ctx) void this.ctx.close().catch(() => undefined);
    this.ctx = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (this.unavailable) return null;
    try {
      const ctx = this.deps.createContext
        ? this.deps.createContext()
        : typeof AudioContext !== 'undefined'
          ? new AudioContext()
          : null;
      if (!ctx) {
        this.fail();
        return null;
      }
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = MASTER_GAIN;
      this.master.connect(ctx.destination);
      this.bgmGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.bgmGain.gain.value = volumeToGain(this.settings.bgmVolume);
      this.sfxGain.gain.value = volumeToGain(this.settings.sfxVolume);
      this.bgmGain.connect(this.master);
      this.sfxGain.connect(this.master);
      return ctx;
    } catch {
      this.fail();
      return null;
    }
  }

  private async startBgm(): Promise<void> {
    if (!this.ctx || !this.bgmGain || this.bgmSource || !this.settings.bgmEnabled) return;
    const url = this.deps.resolveBgm ? this.deps.resolveBgm(BGM_NAME) : pickAudioFile(BGM_NAME, this.deps.canPlay);
    if (!url) return;
    const buffer = await this.loadBuffer(url);
    if (!buffer || !this.ctx || this.bgmSource) return;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.bgmGain);
      const offset = buffer.duration > 0 ? this.bgmOffset % buffer.duration : 0;
      source.start(0, offset);
      this.bgmStartedAt = this.ctx.currentTime;
      this.bgmSource = source;
    } catch {
      this.fail();
    }
  }

  private stopBgm(): void {
    if (this.bgmSource) {
      this.bgmOffset = this.currentBgmOffset();
      try {
        this.bgmSource.stop();
      } catch {
        // ignore
      }
      this.bgmSource = null;
      this.bgmStartedAt = 0;
    }
  }

  private currentBgmOffset(): number {
    if (!this.ctx || this.bgmSource === null) return this.bgmOffset;
    return this.bgmOffset + (this.ctx.currentTime - this.bgmStartedAt);
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(url)) return this.buffers.get(url) ?? null;
    if (this.pending.has(url)) return this.pending.get(url) ?? null;
    const ctx = this.ctx;
    if (!ctx) return null;

    const task = (async () => {
      try {
        const bytes = await this.deps.fetchArrayBuffer(url);
        const buffer = await ctx.decodeAudioData(bytes);
        this.buffers.set(url, buffer);
        return buffer;
      } catch {
        this.fail();
        return null;
      } finally {
        this.pending.delete(url);
      }
    })();
    this.pending.set(url, task);
    return task;
  }

  private fail(): void {
    this.unavailable = true;
    this.stopBgm();
  }
}
