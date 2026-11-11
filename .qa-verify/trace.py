import re, os, collections
pat = re.compile(r'REQ-(\d{3})((?:/\d{3})*)')
req2test = collections.defaultdict(set)
for root, dirs, files in os.walk('tests'):
    for f in files:
        p = os.path.join(root, f)
        try:
            txt = open(p, encoding='utf-8').read()
        except Exception:
            continue
        for m in pat.finditer(txt):
            nums = [int(m.group(1))] + [int(x) for x in re.findall(r'\d{3}', m.group(2))]
            for n in nums:
                req2test[n].add(p.replace('\\', '/'))
missing = [r for r in range(1, 52) if r not in req2test]
print('REQ without test reference:', missing)
for r in range(1, 52):
    tests = sorted(req2test.get(r, []))
    print('REQ-%03d\t%d\t%s' % (r, len(tests), ','.join(x.split('/')[-1] for x in tests)))
