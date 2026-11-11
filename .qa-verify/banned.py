import re
spec = open('specs/001-core-game/spec.md', encoding='utf-8').read()
start = spec.index('**REQ-001')
end = spec.index('## 8. 存档规格')
body = spec[start:end]
cr_start = spec.index('## 15. 变更记录')
cr = spec[cr_start:]
words = ['全球', '在线', '全服', '服务器排名']
import sys
print('== REQ 正文命中 ==')
for w in words:
    for m in re.finditer(w, body):
        ctx = body[max(0, m.start()-60):m.end()+30].replace('\n', ' ')
        req = body.rfind('**REQ-', 0, m.start())
        reqid = body[req:req+9] if req >= 0 else '?'
        print(f'{w} @ {reqid} ... {ctx}')
print('== CR 新增行命中 ==')
for w in words:
    for m in re.finditer(w, cr):
        line_start = cr.rfind('\n', 0, m.start()) + 1
        line_end = cr.find('\n', m.end())
        line = cr[line_start:line_end if line_end > 0 else len(cr)]
        print(f'{w} :: {line.strip()[:160]}')
print('== 宪法 8.3 命中（规则条款，按口径不计 FAIL）==')
const = open('specs/constitution.md', encoding='utf-8').read()
for w in words:
    n = len(re.findall(w, const))
    print(f'{w}: {n}')

