import json, hashlib, os
cs = json.load(open('assets/checksums.json', encoding='utf-8'))
bad = []
for name, want in cs.items():
    p = os.path.join('assets', name)
    got = hashlib.sha256(open(p,'rb').read()).hexdigest()
    if got != want: bad.append(name)
print('checksums entries:', len(cs), 'mismatch:', len(bad), bad)
