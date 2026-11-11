/**
 * G8 独立音效探针（不复用 tests/e2e/sfx-probe.ts）。
 * 目的：断言「实际播放事件」而不是网络请求：
 *   fetch(url) -> arrayBuffer 打标 -> decodeAudioData 产出 AudioBuffer 打标 -> AudioBufferSourceNode.start 记录 url+duration。
 * 任一环节失败会进入 hookErrors，调用方必须据此判探针失效（避免 BUG-006 的空转断言）。
 */
export interface G8Start { url: string | null; duration: number | null; t: number }
export interface G8ProbeState { starts: G8Start[]; fetches: string[]; hookErrors: string[] }

export const INVALID_RE = /sfx-invalid[^/]*\.(ogg|mp3)(\?|$)/;
export const SWAP_RE = /sfx-swap[^/]*\.(ogg|mp3)(\?|$)/;

export const installG8Probe = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.addInitScript(() => {
    const w = window as any;
    const state = { starts: [] as any[], fetches: [] as string[], hookErrors: [] as string[] };
    w.__g8 = state;
    const urlByBytes = new WeakMap<ArrayBuffer, string>();
    const urlByBuffer = new WeakMap<AudioBuffer, string>();

    const origFetch = window.fetch;
    window.fetch = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      state.fetches.push(url);
      const res = await origFetch.call(window, input, init);
      try {
        const origAb = res.arrayBuffer.bind(res);
        Object.defineProperty(res, 'arrayBuffer', {
          configurable: true,
          value: async () => {
            const bytes = await origAb();
            urlByBytes.set(bytes, url);
            return bytes;
          },
        });
      } catch (e) { state.hookErrors.push('fetch:' + String(e)); }
      return res;
    };

    try {
      const origDecode = BaseAudioContext.prototype.decodeAudioData as any;
      BaseAudioContext.prototype.decodeAudioData = function (data: ArrayBuffer, ...rest: any[]) {
        const url = urlByBytes.get(data) ?? null;
        const out = origDecode.call(this, data, ...rest);
        if (!out || typeof out.then !== 'function') return out;
        return out.then((buf: AudioBuffer) => {
          if (url) urlByBuffer.set(buf, url);
          return buf;
        });
      };
    } catch (e) { state.hookErrors.push('decode:' + String(e)); }

    try {
      const origStart = AudioBufferSourceNode.prototype.start as any;
      AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: any[]) {
        const buf = this.buffer;
        state.starts.push({
          url: buf ? urlByBuffer.get(buf) ?? null : null,
          duration: buf ? buf.duration : null,
          t: performance.now(),
        });
        return origStart.apply(this, args);
      };
    } catch (e) { state.hookErrors.push('start:' + String(e)); }
  });
};

export const probeState = async (page: import('@playwright/test').Page): Promise<G8ProbeState> =>
  page.evaluate(() => {
    const s = (window as any).__g8;
    if (!s) throw new Error('probe missing');
    return { starts: s.starts.slice(), fetches: s.fetches.slice(), hookErrors: s.hookErrors.slice() };
  });

export const mark = async (page: import('@playwright/test').Page): Promise<{ starts: number; fetches: number }> => {
  const s = await probeState(page);
  return { starts: s.starts.length, fetches: s.fetches.length };
};

export const since = async (page: import('@playwright/test').Page, m: { starts: number; fetches: number }) => {
  const s = await probeState(page);
  if (s.hookErrors.length) throw new Error('probe hook errors: ' + s.hookErrors.join('; '));
  const starts = s.starts.slice(m.starts);
  return {
    invalidStarts: starts.filter((x) => x.url !== null && INVALID_RE.test(x.url)).length,
    swapStarts: starts.filter((x) => x.url !== null && SWAP_RE.test(x.url)).length,
    unlabelled: starts.filter((x) => x.url === null).length,
    starts,
    fetches: s.fetches.slice(m.fetches),
  };
};
