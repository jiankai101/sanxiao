import re, glob, json
spec = open('specs/001-core-game/spec.md', encoding='utf-8').read()
reqs = sorted(set(re.findall(r'\*\*REQ-(\d{3})', spec)))
def expand(text):
    out = set()
    for m in re.finditer(r'REQ-(\d{3})((?:\s*[/,、]\s*\d{3})*)', text):
        out.add(m.group(1))
        for n in re.findall(r'\d{3}', m.group(2) or ''):
            out.add(n)
    return out
tasks = open('specs/001-core-game/tasks.md', encoding='utf-8').read()
task_reqs = expand(tasks)
test_files = glob.glob('tests/**/*.ts', recursive=True)
alltxt = '\n'.join(open(f, encoding='utf-8').read() for f in test_files)
names = '\n'.join(l for l in alltxt.splitlines() if re.search(r"\b(test|it|describe)\s*\(", l) or l.strip().startswith("//") is False and re.search(r"REQ-\d", l) and ('describe(' in l or 'test(' in l or 'it(' in l))
name_reqs = expand(names)
all_reqs = expand(alltxt)
print('REQ:', len(reqs))
print('missing tasks:', [r for r in reqs if r not in task_reqs])
print('missing test names:', [r for r in reqs if r not in name_reqs])
print('missing any test ref:', [r for r in reqs if r not in all_reqs])
json.dump({'missing_task':[r for r in reqs if r not in task_reqs],'missing_named':[r for r in reqs if r not in name_reqs],'missing_any':[r for r in reqs if r not in all_reqs]}, open('.qa-verify/out/g6-trace.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
