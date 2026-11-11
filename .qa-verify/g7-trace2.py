import re,io,os,collections
def expand(s):
    out=set()
    for m in re.finditer(r'REQ-(\d{3})((?:/\d{3})*)',s):
        out.add('REQ-'+m.group(1))
        for n in re.findall(r'\d{3}',m.group(2)): out.add('REQ-'+n)
    return out
reqs=[f'REQ-{i:03d}' for i in range(1,52)]
hits=collections.defaultdict(set)
for root,dirs,files in os.walk('tests'):
    for f in files:
        if f.endswith(('.ts','.tsx','.js','.mjs')):
            p=os.path.join(root,f)
            s=io.open(p,encoding='utf-8',errors='replace').read()
            for r in expand(s): hits[r].add(p)
for r in reqs:
    print(r, len(hits.get(r,[])), ';'.join(sorted(hits.get(r,[]))))
print('MISSING',[r for r in reqs if not hits.get(r)])
