import re,io,os,collections
reqs=[f'REQ-{i:03d}' for i in range(1,52)]
hits=collections.defaultdict(set)
for root,dirs,files in os.walk('tests'):
    for f in files:
        if f.endswith(('.ts','.tsx','.js','.mjs')):
            p=os.path.join(root,f)
            s=io.open(p,encoding='utf-8',errors='replace').read()
            for r in re.findall(r'REQ-\d{3}',s): hits[r].add(p)
tasks=io.open('specs/001-core-game/tasks.md',encoding='utf-8').read()
taskhits=collections.defaultdict(int)
for r in re.findall(r'REQ-\d{3}',tasks): taskhits[r]+=1
for r in reqs:
    print(r,'tests=',len(hits.get(r,[])),'tasks_mentions=',taskhits.get(r,0),'|',';'.join(sorted(hits.get(r,[]))))
print('test missing:',[r for r in reqs if not hits.get(r)])
print('task missing:',[r for r in reqs if not taskhits.get(r)])
