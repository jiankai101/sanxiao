import { expect, type Page } from '@playwright/test';
import { cellPoint } from './helpers';

/**
 * BUG-006：Vite 产物把音效文件名哈希化（如 `sfx-invalid-BqsWogSh.ogg`），
 * 旧断言用的 `/sfx-invalid\.(ogg|mp3)(\?|$)/` 对哈希名恒为 false，导致「无 invalid 音效」空转。
 * 这里统一用容忍哈希段的正则，并在 `readInvalidSfx` 里同时核对「实际播放」与「网络请求」两条证据。
 */
export const INVALID_SFX_URL = /sfx-invalid[^/]*\.(ogg|mp3)(\?|$)/;

export interface SfxStart {
  /** 由 fetch → decodeAudioData 映射回的资源 URL；null 表示映射失败（测试会判为探针失效）。 */
  url: string | null;
  duration: number | null;
}

export interface AudioProbeState {
  starts: SfxStart[];
  fetches: string[];
  hookErrors: string[];
}

export interface AudioProbeMark {
  starts: number;
  fetches: number;
}

export interface InvalidSfxReport {
  invalidStarts: number;
  invalidFetches: number;
  unlabelledStarts: number;
  starts: SfxStart[];
}

interface ProbeGlobal {
  __sfxProbe?: AudioProbeState;
}

/**
 * 页内探针（在任何页面脚本之前注入）：
 * - 包装 `fetch`：记录请求 URL，并把 response.arrayBuffer() 返回的 buffer 与 URL 关联；
 * - 包装 `decodeAudioData`：把解码产物 AudioBuffer 与 URL 关联；
 * - 包装 `AudioBufferSourceNode.prototype.start`：记录实际播放的 buffer URL 与时长。
 * 这样断言基于「真的开始播放」而不是「有没有发请求」，且能区分 invalid / swap / bgm。
 */
export async function installAudioProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Window & ProbeGlobal;
    const state: AudioProbeState = { starts: [], fetches: [], hookErrors: [] };
    w.__sfxProbe = state;

    const byteUrls = new WeakMap<ArrayBuffer, string>();
    const bufferUrls = new WeakMap<AudioBuffer, string>();

    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      state.fetches.push(url);
      const response = await originalFetch.call(window, input, init);
      try {
        const originalArrayBuffer = response.arrayBuffer.bind(response);
        Object.defineProperty(response, 'arrayBuffer', {
          configurable: true,
          value: async (): Promise<ArrayBuffer> => {
            const bytes = await originalArrayBuffer();
            byteUrls.set(bytes, url);
            return bytes;
          },
        });
      } catch (error) {
        state.hookErrors.push(`fetch.arrayBuffer: ${String(error)}`);
      }
      return response;
    };

    try {
      const decode = BaseAudioContext.prototype.decodeAudioData as unknown as (
        this: BaseAudioContext,
        data: ArrayBuffer,
        ...rest: unknown[]
      ) => Promise<AudioBuffer> | undefined;
      BaseAudioContext.prototype.decodeAudioData = function (
        this: BaseAudioContext,
        data: ArrayBuffer,
        ...rest: unknown[]
      ) {
        const url = byteUrls.get(data) ?? null;
        const result = decode.call(this, data, ...rest);
        if (!result || typeof result.then !== 'function') return result;
        return result.then((buffer: AudioBuffer) => {
          if (url) bufferUrls.set(buffer, url);
          return buffer;
        });
      } as unknown as typeof BaseAudioContext.prototype.decodeAudioData;
    } catch (error) {
      state.hookErrors.push(`decodeAudioData: ${String(error)}`);
    }

    try {
      const originalStart = AudioBufferSourceNode.prototype.start as unknown as (
        this: AudioBufferSourceNode,
        ...args: unknown[]
      ) => void;
      AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: unknown[]) {
        const buffer = this.buffer;
        state.starts.push({
          url: buffer ? bufferUrls.get(buffer) ?? null : null,
          duration: buffer ? buffer.duration : null,
        });
        originalStart.apply(this, args);
      } as unknown as typeof AudioBufferSourceNode.prototype.start;
    } catch (error) {
      state.hookErrors.push(`AudioBufferSourceNode.start: ${String(error)}`);
    }
  });
}

export async function audioProbeState(page: Page): Promise<AudioProbeState> {
  const state = await page.evaluate(() => {
    const probe = (window as unknown as Window & ProbeGlobal).__sfxProbe;
    if (!probe) return null;
    return {
      starts: probe.starts.map((entry) => ({ url: entry.url, duration: entry.duration })),
      fetches: [...probe.fetches],
      hookErrors: [...probe.hookErrors],
    };
  });
  if (!state) throw new Error('audio probe missing: installAudioProbe() must run before page scripts');
  return state;
}

export async function markAudioProbe(page: Page): Promise<AudioProbeMark> {
  const state = await audioProbeState(page);
  return { starts: state.starts.length, fetches: state.fetches.length };
}

/**
 * 统计 mark 之后实际播放的 invalid 音效次数与请求次数。
 * 探针失效（hook 抛错 / buffer 无法映射回 URL）时直接抛错，避免再次出现「断言空转但全绿」。
 */
export async function readInvalidSfx(page: Page, mark: AudioProbeMark): Promise<InvalidSfxReport> {
  const state = await audioProbeState(page);
  if (state.hookErrors.length > 0) throw new Error(`audio probe hook failed: ${state.hookErrors.join('; ')}`);
  const starts = state.starts.slice(mark.starts);
  return {
    invalidStarts: starts.filter((entry) => entry.url !== null && INVALID_SFX_URL.test(entry.url)).length,
    invalidFetches: state.fetches.slice(mark.fetches).filter((url) => INVALID_SFX_URL.test(url)).length,
    unlabelledStarts: starts.filter((entry) => entry.url === null).length,
    starts,
  };
}

/** 等音效的 fetch → decode → start 链路走完（本地 preview，600ms 足够；不要用它替代 poll 断言有音效）。 */
export async function settleSfx(page: Page): Promise<void> {
  await page.waitForTimeout(600);
}

/**
 * 灵敏度自检（BUG-005/006 的「证明新断言不是空转」）：重载到 seed=20261110 第 1 关，
 * 真跑一次「相邻无匹配」B 类交换，断言同会话探针能记录到 invalid 播放。
 * 注意：内部会重新导航，必须放在用例最后一步。
 */
export async function expectInvalidSfxProbeSensitivity(page: Page): Promise<void> {
  await page.goto('/?seed=20261110');
  await page.waitForFunction(() => Boolean(window.__wmgTest));
  await page.evaluate(() => window.__wmgTest?.startLevel(1));
  await page.waitForTimeout(150);

  const mark = await markAudioProbe(page);
  const a = await cellPoint(page, 1, 1);
  await page.mouse.click(a.x, a.y);
  const b = await cellPoint(page, 1, 2);
  await page.mouse.click(b.x, b.y);

  await expect
    .poll(async () => (await readInvalidSfx(page, mark)).invalidStarts, { timeout: 5_000 })
    .toBeGreaterThanOrEqual(1);
}
