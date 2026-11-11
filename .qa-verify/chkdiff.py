import os,json
chk=json.load(open('assets/checksums.json',encoding='utf-8'))
files=[f for f in os.listdir('assets') if f not in ('checksums.json','manifest.md')]
print([f for f in files if f not in chk])
print([f for f in chk if f not in files])
