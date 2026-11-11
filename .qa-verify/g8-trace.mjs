import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const expand = (text) => {
  const set = new Set();
  for (const m of text.matchAll(/REQ-(\d{3})((?:\/\d{3})*)/g)) {
    set.add(m[1]);
    for (const x of (m[2] || '').split('/').filter(Boolean)) set.add(x);
  }
  return set;
};
const spec = readFileSync('specs/001-core-game/spec.md', 'utf8');
const reqs = [...new Set([...spec.matchAll(/REQ-(\d{3})/g)].map((m) => m[1]))].sort();
const tasks = readFileSync('specs/001-core-game/tasks.md', 'utf8');
const taskHeadings = [...tasks.matchAll(/^### TASK-(\d{3})/gm)].map((m) => m[1]);
const blocks = tasks.split(/^### TASK-/m).slice(1);
const map = new Map();
for (const b of blocks) {
  const id = 'TASK-' + b.slice(0, 3);
  const line = (b.match(/对应 REQ：(.+)/) || [])[1] || '';
  for (const r of expand(line)) { if (!map.has(r)) map.set(r, []); map.get(r).push(id); }
}
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(p)) files.push(p); } };
walk('tests');
const perReq = new Map();
for (const f of files) {
  const ids = expand(readFileSync(f, 'utf8'));
  for (const id of ids) { if (!perReq.has(id)) perReq.set(id, []); perReq.get(id).push(f.replace(/\\/g, '/')); }
}
let bad = 0;
for (const r of reqs) {
  const tasksFor = map.get(r) || [];
  const testsFor = perReq.get(r) || [];
  if (tasksFor.length === 0 || testsFor.length === 0) { bad += 1; console.log(`MISSING REQ-${r} tasks=${JSON.stringify(tasksFor)} tests=${JSON.stringify(testsFor)}`); }
}
console.log('spec REQ:', reqs.length, '| TASK headings:', taskHeadings.length, '| mapped REQ:', map.size, '| REQ with >=1 test file:', [...perReq.keys()].filter((k) => reqs.includes(k)).length);
console.log('REQ missing TASK or test:', bad);
console.log('sample: REQ-004 ->', JSON.stringify(perReq.get('004')));
console.log('sample: REQ-039 ->', JSON.stringify(perReq.get('039')));
console.log('RESULT:', reqs.length === 51 && taskHeadings.length === 41 && bad === 0 ? 'PASS' : 'FAIL');
