import json, sys, io
p = '.qa-verify/out/g9-resize.txt'
raw = open(p, 'rb').read()
if raw[:2] in (b'\xff\xfe', b'\xfe\xff'):
    s = raw.decode('utf-16')
else:
    s = raw.decode('utf-8', 'replace')
start = s.index('{')
endline = max(i for i, l in enumerate(s.splitlines()) if l.strip() == '}')
lines = s.splitlines()
first = min(i for i, l in enumerate(lines) if l.strip().startswith('{'))
d = json.loads('\n'.join(lines[first:endline + 1]))
res = d['results']
k = sys.argv[1] if len(sys.argv) > 1 else 'idle'
for r in res[k]:
    print(r)
if k == 'idle':
    print('STATE', res['state'])
    print('BURST', res['burst'])
print('DPR', res['dpr'])
