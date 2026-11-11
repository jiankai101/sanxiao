/** 用浏览器 WebAudio.decodeAudioData（游戏实际解码器）测量 28 个音频的播放时长（直接读 assets/ 原文件）。 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const NAMES = ['bgm-main','sfx-swap','sfx-invalid','sfx-match','sfx-cascade','sfx-special-line','sfx-special-rainbow','sfx-ice-break','sfx-stone-break','sfx-shuffle','sfx-star','sfx-win','sfx-lose','sfx-click'];
const NOMINAL = { 'bgm-main':60.0,'sfx-swap':0.12,'sfx-invalid':0.15,'sfx-match':0.25,'sfx-cascade':0.30,'sfx-special-line':0.40,'sfx-special-rainbow':0.60,'sfx-ice-break':0.30,'sfx-stone-break':0.35,'sfx-shuffle':0.50,'sfx-star':0.50,'sfx-win':1.50,'sfx-lose':1.20,'sfx-click':0.08 };
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5056/', { waitUntil: 'domcontentloaded' });
const rows = [];
for (const name of NAMES) {
  const payload = {};
  for (const ext of ['ogg', 'mp3']) payload[ext] = readFileSync(`assets/${name}.${ext}`).toString('base64');
  const r = await page.evaluate(async ({ payload }) => {
    const ctx = new OfflineAudioContext(1, 48000, 48000);
    const out = {};
    for (const ext of ['ogg', 'mp3']) {
      try {
        const bin = atob(payload[ext]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        const decoded = await ctx.decodeAudioData(bytes.buffer);
        out[ext] = { duration: decoded.duration, rate: decoded.sampleRate, ch: decoded.numberOfChannels, frames: decoded.length };
      } catch (e) { out[ext] = { error: String(e) }; }
    }
    return out;
  }, { payload });
  const nom = NOMINAL[name];
  const o = r.ogg, m = r.mp3;
  const errO = o.duration ? (o.duration - nom) * 1000 : NaN;
  const errM = m.duration ? (m.duration - nom) * 1000 : NaN;
  const diff = (o.duration && m.duration) ? Math.abs(o.duration - m.duration) * 1000 : NaN;
  rows.push({ name, nom, ogg: o.duration, mp3: m.duration, errO, errM, diff, oRate: o.rate, mRate: m.rate, oCh: o.ch, mCh: m.ch, oFrames: o.frames, mFrames: m.frames });
  console.log(`${name.padEnd(20)} nom=${nom.toFixed(2)} ogg=${(o.duration ?? NaN).toFixed(4)}(${(errO>=0?'+':'')}${errO.toFixed(1)}) mp3=${(m.duration ?? NaN).toFixed(4)}(${(errM>=0?'+':'')}${errM.toFixed(1)}) |o-m|=${diff.toFixed(1)}ms ${o.rate}/${m.rate} ${o.ch}/${m.ch}`);
}
const frame = 1152/48000*1000;
const badErr = rows.filter((r) => Math.abs(r.errO) > frame || Math.abs(r.errM) > frame);
const badDiff = rows.filter((r) => r.diff > 20);
const badFmt = rows.filter((r) => r.oRate !== 48000 || r.mRate !== 48000 || r.oCh !== 1 || r.mCh !== 1);
console.log(`\nframe=${frame.toFixed(1)}ms | |err|>1frame: ${badErr.length} (${badErr.map(r=>r.name+':'+r.errM.toFixed(0)+'ms').join(', ')})`);
console.log(`|ogg-mp3|>20ms: ${badDiff.length} (${badDiff.map(r=>r.name+':'+r.diff.toFixed(0)+'ms').join(', ')})`);
console.log(`format mismatch: ${badFmt.length}`);
await browser.close();
