import { describe, expect, it } from 'vitest';
import { SFX_EVENTS, SFX_MAP, sfxFile } from '../../src/systems/audio/sfx-map';
import { AudioEngine, volumeToGain } from '../../src/systems/audio/audio-engine';

describe('REQ-046 音效事件映射', () => {
  it('13 个事件一一映射到规定文件', () => {
    expect(SFX_EVENTS).toHaveLength(13);
    expect(SFX_MAP).toEqual({
      swap: 'sfx-swap',
      invalid: 'sfx-invalid',
      match: 'sfx-match',
      cascade: 'sfx-cascade',
      'special-line': 'sfx-special-line',
      'special-rainbow': 'sfx-special-rainbow',
      'ice-break': 'sfx-ice-break',
      'stone-break': 'sfx-stone-break',
      shuffle: 'sfx-shuffle',
      star: 'sfx-star',
      win: 'sfx-win',
      lose: 'sfx-lose',
      click: 'sfx-click',
    });
    expect(sfxFile('click', 'ogg')).toBe('sfx-click.ogg');
    expect(sfxFile('win', 'mp3')).toBe('sfx-win.mp3');
  });
});

describe('REQ-047 音量映射', () => {
  it('0/5/96/100 映射增益均在 [0,1] 且无 NaN', () => {
    for (const v of [0, 5, 96, 100]) {
      const gain = volumeToGain(v);
      expect(Number.isNaN(gain)).toBe(false);
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
    }
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(100)).toBe(1);
    expect(volumeToGain(5)).toBeGreaterThan(0);
    expect(volumeToGain(96)).toBeLessThan(1);
  });
});

describe('REQ-046 100ms 节流', () => {
  it('同一音效 100ms 内只触发 1 次', async () => {
    let now = 0;
    let fetches = 0;
    let starts = 0;
    class FakeGain {
      gain = { value: 0 };
      connect(): void {}
    }
    class FakeSource {
      buffer: AudioBuffer | null = null;
      loop = false;
      connect(): void {}
      start(): void { starts += 1; }
      stop(): void {}
    }
    const ctx = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: () => new FakeGain(),
      createBufferSource: () => new FakeSource(),
      decodeAudioData: async () => ({ duration: 1 }) as AudioBuffer,
      resume: async () => undefined,
      suspend: async () => undefined,
      close: async () => undefined,
    } as unknown as AudioContext;

    const engine = new AudioEngine({
      createContext: () => ctx,
      now: () => now,
      fetchArrayBuffer: async () => {
        fetches += 1;
        return new ArrayBuffer(8);
      },
      resolveBgm: () => null,
    });
    engine.setSettings({ bgmEnabled: false, bgmVolume: 60, sfxEnabled: true, sfxVolume: 80 });
    engine.unlock();

    await engine.playSfx('click');
    now = 50;
    await engine.playSfx('click');
    expect(fetches).toBe(1);

    now = 150;
    await engine.playSfx('click');
    expect(starts).toBe(2);
  });
});

interface FakeSource {
  buffer: AudioBuffer | null;
  loop: boolean;
  startArgs: number[];
  stopped: boolean;
  connect(): void;
  start(when?: number, offset?: number): void;
  stop(): void;
}

function createFakeAudio(options: { duration?: number; decodeError?: boolean } = {}) {
  const sources: FakeSource[] = [];
  let resumeCalls = 0;
  let suspendCalls = 0;
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: () => ({ gain: { value: 0 }, connect: () => undefined }),
    createBufferSource: () => {
      let source: FakeSource;
      source = {
        buffer: null,
        loop: false,
        startArgs: [],
        stopped: false,
        connect: () => undefined,
        start: (when = 0, offset = 0) => {
          source.startArgs.push(when, offset);
        },
        stop: () => {
          source.stopped = true;
        },
      };
      sources.push(source);
      return source;
    },
    decodeAudioData: async () => {
      if (options.decodeError) throw new Error('decode failed');
      return { duration: options.duration ?? 4 } as AudioBuffer;
    },
    resume: async () => {
      resumeCalls += 1;
    },
    suspend: async () => {
      suspendCalls += 1;
    },
    close: async () => undefined,
  };
  return { ctx, sources, calls: () => ({ resumeCalls, suspendCalls }) };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

describe('REQ-045 BGM 首手势与可见性', () => {
  it('REQ-045 首次手势前不播放，手势后 BGM 循环播放', async () => {
    const fake = createFakeAudio();
    const engine = new AudioEngine({
      createContext: () => fake.ctx as unknown as AudioContext,
      resolveBgm: () => 'bgm-main.ogg',
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    });

    await flush();
    expect(engine.isUnlocked).toBe(false);
    expect(engine.isPlayingBgm).toBe(false);
    expect(fake.sources).toHaveLength(0);

    engine.unlock();
    await flush();

    expect(engine.isUnlocked).toBe(true);
    expect(engine.isPlayingBgm).toBe(true);
    const bgm = fake.sources[0]!;
    expect(bgm.loop).toBe(true);
    expect(bgm.startArgs).toEqual([0, 0]);
  });

  it('REQ-045 visibilitychange 隐藏暂停、可见从暂停点续播且接缝 ≤20ms', async () => {
    const fake = createFakeAudio({ duration: 4 });
    const engine = new AudioEngine({
      createContext: () => fake.ctx as unknown as AudioContext,
      resolveBgm: () => 'bgm-main.ogg',
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    });
    engine.unlock();
    await flush();
    expect(engine.isPlayingBgm).toBe(true);

    // 播放到 9.5s 时切到后台：暂停并记录偏移。
    fake.ctx.currentTime = 9.5;
    engine.onVisibility(true);
    await flush();
    expect(fake.calls().suspendCalls).toBe(1);
    expect(fake.sources[0]!.stopped).toBe(true);
    expect(engine.isPlayingBgm).toBe(false);

    // 恢复可见：从暂停点继续，循环接缝与暂停点之差 ≤20ms。
    fake.ctx.currentTime = 12;
    engine.onVisibility(false);
    await flush();
    expect(fake.calls().resumeCalls).toBe(1);
    expect(engine.isPlayingBgm).toBe(true);
    const resumed = fake.sources[fake.sources.length - 1]!;
    expect(resumed).not.toBe(fake.sources[0]);
    expect(resumed.loop).toBe(true);
    const expectedOffset = 9.5 % 4;
    const seamMs = Math.abs((resumed.startArgs[1] ?? 0) - expectedOffset) * 1000;
    expect(seamMs).toBeLessThanOrEqual(20);
  });
});

describe('REQ-048 音频加载/解码失败静默降级', () => {
  it('REQ-048 解码失败时静默降级：不播放、不抛异常、unavailable=true', async () => {
    const fake = createFakeAudio({ decodeError: true });
    const engine = new AudioEngine({
      createContext: () => fake.ctx as unknown as AudioContext,
      resolveBgm: () => 'bgm-main.ogg',
      fetchArrayBuffer: async () => new ArrayBuffer(8),
    });

    engine.unlock();
    await flush();
    expect(engine.unavailable).toBe(true);
    expect(engine.isPlayingBgm).toBe(false);

    await expect(engine.playSfx('swap')).resolves.toBeUndefined();
    await expect(engine.playSfx('match')).resolves.toBeUndefined();
    expect(engine.unavailable).toBe(true);
    expect(engine.isPlayingBgm).toBe(false);
  });

  it('REQ-048 资源加载失败同样静默降级，游戏可继续', async () => {
    const fake = createFakeAudio();
    const engine = new AudioEngine({
      createContext: () => fake.ctx as unknown as AudioContext,
      resolveBgm: () => 'bgm-main.ogg',
      fetchArrayBuffer: async () => {
        throw new Error('network blocked');
      },
    });

    engine.unlock();
    await flush();
    expect(engine.unavailable).toBe(true);
    await expect(engine.playSfx('click')).resolves.toBeUndefined();
    expect(fake.sources).toHaveLength(0);
  });
});