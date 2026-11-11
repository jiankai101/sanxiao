import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.ts')) out.push(p); } return out; };
const files = walk('tests/e2e');
const hits = [];
let scanned = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return; // 注释不算断言
    scanned += 1;
    if (line.includes('sfx-invalid\\.(ogg|mp3)')) hits.push(`${f}:${i + 1}: ${t}`);
  });
}
console.log('tests/e2e files scanned:', files.length, '| non-comment lines:', scanned);
console.log('live (non-comment) old-pattern occurrences:', hits.length);
hits.forEach((h) => console.log('  ' + h));
const dist = readdirSync('dist/assets').filter((n) => n.startsWith('sfx-invalid'));
const sample = 'http://127.0.0.1:4173/assets/' + dist.find((n) => n.endsWith('.ogg'));
const oldRe = /sfx-invalid\.(ogg|mp3)(\?|$)/;
const newRe = /sfx-invalid[^/]*\.(ogg|mp3)(\?|$)/;
console.log('dist invalid assets:', dist);
console.log('sample url:', sample);
console.log('old regex:', oldRe.test(sample), '| tolerant regex:', newRe.test(sample));
const probe = readFileSync('tests/e2e/sfx-probe.ts', 'utf8');
console.log('probe wraps fetch:', probe.includes('window.fetch'));
console.log('probe wraps decodeAudioData:', probe.includes('decodeAudioData'));
console.log('probe wraps AudioBufferSourceNode.start:', probe.includes('AudioBufferSourceNode.prototype.start'));
console.log('readInvalidSfx throws on probe failure:', probe.includes('audio probe hook failed'));
console.log('sensitivity self-check exists:', probe.includes('expectInvalidSfxProbeSensitivity'));
for (const f of ['tests/e2e/outside-board.spec.ts', 'tests/e2e/invalid-sfx.spec.ts']) {
  const s = readFileSync(f, 'utf8');
  console.log(f, '| installAudioProbe:', s.includes('installAudioProbe'), '| sensitivity:', s.includes('expectInvalidSfxProbeSensitivity'), '| asserts invalidStarts:', s.includes('invalidStarts'));
}
console.log('RESULT:', hits.length === 0 && oldRe.test(sample) === false && newRe.test(sample) === true ? 'PASS' : 'FAIL');
