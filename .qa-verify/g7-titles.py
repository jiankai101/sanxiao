import re,io
files=['tests/core/swap.spec.ts','tests/core/resolve.spec.ts','tests/core/special-generate.spec.ts','tests/core/special-trigger.spec.ts','tests/core/goals.spec.ts','tests/core/state-machine.spec.ts','tests/render/layout.spec.ts','tests/render/assets.spec.ts','tests/systems/levels.spec.ts']
pat=re.compile(r"(?:describe|it|test)\(\s*['\"`]([^'\"`]+)")
for p in files:
    s=io.open(p,encoding='utf-8').read()
    print('###',p)
    for m in pat.finditer(s):
        print('  ',m.group(1))
