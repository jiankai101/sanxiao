import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5055/', { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
await page.waitForTimeout(1500);
const res = await page.evaluate(async () => {
  const url = [...document.querySelectorAll('script')].length ? null : null;
  const files = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /bgm|sfx/.test(n));
  const target = files.find((f) => f.includes('bgm-main') && f.endsWith('.ogg'));
  if (!target) return { error: 'no bgm url', files };
  const buf = await (await fetch(target)).arrayBuffer();
  const ctx2 = new AudioContext();
  const audio = await ctx2.decodeAudioData(buf);
  const ch = audio.getChannelData(0);
  const n20 = Math.floor(audio.sampleRate * 0.02);
  const peak = (from, to) => {
    let m = 0;
    for (let i = from; i < to; i += 1) m = Math.max(m, Math.abs(ch[i]));
    return m;
  };
  return {
    duration: audio.duration,
    sampleRate: audio.sampleRate,
    channels: audio.numberOfChannels,
    first20msPeak: peak(0, n20),
    last20msPeak: peak(ch.length - n20, ch.length),
    firstSample: ch[0],
    lastSample: ch[ch.length - 1],
  };
});
console.log(JSON.stringify(res, null, 2));
await browser.close();

