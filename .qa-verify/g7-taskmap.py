import re,io,collections
s=io.open('specs/001-core-game/tasks.md',encoding='utf-8').read().splitlines()
m=collections.defaultdict(list)
for l in s:
    if l.startswith('| TASK-'):
        cols=[c.strip() for c in l.strip('|').split('|')]
        tid=cols[0]; reqcol=cols[3]
        for n in re.findall(r'\d{3}',reqcol):
            m[f'REQ-{n}'].append(tid)
for i in range(1,52):
    r=f'REQ-{i:03d}'
    print(r,','.join(m.get(r,[])))
