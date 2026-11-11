/** G7 authoritative audio duration check: Chrome decodeAudioData (same decoder family as game) on assets/*.ogg|mp3. */
import { chromium } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const NAMES = ['bgm-main','sfx-swap','sfx-invalid','sfx-match','sfx-cascade','sfx-special-line','sfx-special-rainbow','sfx-ice-break','sfx-stone-break','sfx-shuffle','sfx-star','sfx-win','sfx-lose','sfx-click'];
const NOMINAL = { 'bgm-main':60.0,'sfx-swap':0.12,'sfx-invalid':0.15,'sfx-match':0.25,'sfx-cascade':0.30,'sfx-special-line':0.40,'sfx-special-rainbow':0.60,'sfx-ice-break':0.30,'sfx-stone-break':0.35,'sfx-shuffle':0.50,'sfx-star':0.50,'sfx-win':1.50,'sfx-lose':1.20,'sfx-click':0.08 };
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('data:text/html,<title>decode</title>');
const rows = [];
let totalBytes = 0;
for (const name of NAMES) {
  const payload = {};
  for (const ext of ['ogg', 'mp3']) {
    const buf = readFileSync(`assets/${name}.${ext}`);
    totalBytes += buf.length;
    payload[ext] = buf.toString('base64');
    payload[ext + 'sha'] = createHash('sha256').update(buf).digest('hex');
  }
  const r = await page.evaluate(async ({ payload }) => {
    const out = {};
    for (const ext of ['ogg', 'mp3']) {
      try {
        const bin = atob(payload[ext]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        const ctx = new OfflineAudioContext(1, 48000, 48000);
        const decoded = await ctx.decodeAudioData(bytes.buffer);
        out[ext] = { duration: decoded.duration, rate: decoded.sampleRate, ch: decoded.numberOfChannels, frames: decoded.length };
      } catch (e) { out[ext] = { error: String(e) }; }
    }
    return out;
  }, { payload });
  const nom = NOMINAL[name];
  const o = r.ogg, m = r.mp3;
  const errO = (o.duration - nom) * 1000;
  const errM = (m.duration - nom) * 1000;
  rows.push({ name, nom, o, m, errO, errM, osha: payload.oggsha, msha: payload.mp3sha });
  console.log(name.padEnd(20), 'nom='+(nom*1000).toFixed(0)+'ms | ogg='+o.duration.toFixed(4)+'s err='+(errO>=0?'+':'')+errO.toFixed(1)+'ms | mp3='+m.duration.toFixed(4)+'s err='+(errM>=0?'+':'')+errM.toFixed(1)+'ms | diff='+(Math.abs(o.duration-m.duration)*1000).toFixed(1)+'ms | '+o.rate+'Hz/'+o.ch+'ch '+m.rate+'Hz/'+m.ch+'ch');
}
const frame = 24.0; // 1152 samples @ 48kHz
const badM = rows.filter(r => Math.abs(r.errM) > frame + 1e-9);
const badO = rows.filter(r => Math.abs(r.errO) > frame + 1e-9);
const badFmt = rows.filter(r => r.o.rate !== 48000 || r.m.rate !== 48000 || r.o.ch !== 1 || r.m.ch !== 1);
console.log(`\nMP3 |err|<=${frame}ms: ${rows.length-badM.length}/${rows.length}; FAIL=${badM.map(r=>r.name+':'+r.errM.toFixed(1)).join(',')||'none'}`);
console.log(`OGG |err|<=${frame}ms: ${rows.length-badO.length}/${rows.length}; FAIL=${badO.map(r=>r.name+':'+r.errO.toFixed(1)).join(',')||'none'}`);
console.log(`format 48k mono: ${rows.length-badFmt.length}/${rows.length}`);
console.log(`audio total = ${(totalBytes/1024).toFixed(1)} KiB = ${totalBytes} bytes (limit 2097152)`);
console.log(`audio total <= 2048KiB: ${totalBytes <= 2048*1024}`);
console.log('RESULT:', badM.length===0 && badO.length===0 && badFmt.length===0 && totalBytes<=2048*1024 ? 'PASS' : 'FAIL');
console.log(JSON.stringify(rows.map(r=>({name:r.name,mp3:r.m.duration,ogg:r.o.duration,errM:r.errM,errO:r.errO,mp3sha:r.msha,oggsha:r.osha}))));
await browser.close();
