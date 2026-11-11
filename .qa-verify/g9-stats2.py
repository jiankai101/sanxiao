import json, io, sys
raw = open('.qa-verify/out/g9-resize-final.txt','rb').read()
s = raw.decode('utf-16') if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else raw.decode('utf-8','replace')
lines = s.splitlines()
first = min(i for i,l in enumerate(lines) if l.strip().startswith('{'))
last = max(i for i,l in enumerate(lines) if l.strip() == '}')
d = json.loads('\n'.join(lines[first:last+1]))
res = d['results']
load = res['load']
print('n=', len(load))
for key in ('rebuildMs','sizeOkMs','contentMs','paintMs'):
    vals = sorted(r[key] for r in load if r[key] is not None)
    n = len(vals)
    print(f'{key}: min={vals[0]} p50={vals[n//2]} p90={vals[int(n*0.9)-1]} max={vals[-1]} over200={sum(1 for v in vals if v>200)}')
over = [r for r in load if (r['contentMs'] or 0) > 200]
for r in over: print('OVER', r['viewport'], 'rebuild',r['rebuildMs'],'sizeOk',r['sizeOkMs'],'content',r['contentMs'],'paint',r['paintMs'])
byvp = {}
for r in load:
    byvp.setdefault(r['viewport'], []).append(r)
for vp, rows in byvp.items():
    print(vp, 'content max', max(x['contentMs'] for x in rows), 'paint max', max(x['paintMs'] for x in rows), 'rebuild max', max(x['rebuildMs'] for x in rows))
print('STATE', res['state'])
print('BURST', res['burst'])
print('DPR', res['dpr'])

