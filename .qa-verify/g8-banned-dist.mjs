import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|html|css)$/.test(p)) files.push(p); } };
walk('dist');
const words = ['全球', '在线', '全服', '服务器排名'];
let hits = 0;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const w of words) {
    const n = s.split(w).length - 1;
    if (n > 0) { hits += n; console.log('HIT', w, 'x' + n, f); }
  }
}
console.log('dist text files:', files.length, '| banned word hits:', hits);
const js = files.map((f) => readFileSync(f, 'utf8')).join('\n');
console.log('contains 本地排行榜:', js.includes('本地排行榜'));
console.log('contains 存档已重置:', js.includes('存档已重置'));
console.log('contains 上一局已中断:', js.includes('上一局已中断'));
console.log('contains 音频不可用:', js.includes('音频不可用'));
console.log('contains 当前为临时存档:', js.includes('当前为临时存档'));
console.log('contains 不可恢复:', js.includes('不可恢复'));
console.log('RESULT:', hits === 0 && js.includes('本地排行榜') ? 'PASS' : 'FAIL');

