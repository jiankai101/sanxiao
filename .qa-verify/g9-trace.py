import re, io, os, collections
maps = collections.defaultdict(list)
pat = re.compile(r'REQ-(\d{3})((?:/\d{3})*)')
for dp, _, fs in os.walk('tests'):
    for f in sorted(fs):
        if not f.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(dp, f).replace('\\', '/')
        for i, line in enumerate(io.open(p, encoding='utf-8', errors='replace'), 1):
            for m in pat.finditer(line):
                ids = [m.group(1)] + [x for x in m.group(2).split('/') if x]
                for n in ids:
                    maps['REQ-' + n].append((p, i, line.strip()[:100]))
missing = []
for i in range(1, 52):
    r = 'REQ-%03d' % i
    hits = maps.get(r, [])
    files = sorted({h[0] for h in hits})
    if not hits:
        missing.append(r)
    first = hits[0] if hits else None
    print(r, len(hits), '|', ', '.join(files[:5]), ('| e.g. %s:%d' % (first[0], first[1])) if first else '')
print('\nMISSING:', missing)
