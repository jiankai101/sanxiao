import os,sys,json,hashlib
import numpy as np
import soundfile as sf
rows=[]
for name in ['bgm-main']:
    for ext in ['ogg','mp3']:
        p=f'assets/{name}.{ext}'
        data,rate=sf.read(p,dtype='float64',always_2d=True)
        x=data[:,0]
        n=len(x)
        seam=abs(x[-1]-x[0])
        head=np.sqrt(np.mean(x[:int(rate*0.05)]**2)); tail=np.sqrt(np.mean(x[-int(rate*0.05):]**2))
        print(f'{p}: frames={n} dur={n/rate:.4f}s rate={rate} ch={data.shape[1]} seam|x[-1]-x[0]|={seam:.5f} headRMS={head:.5f} tailRMS={tail:.5f}')
        rows.append((name,ext,n,rate,seam,head,tail))
print('SEAM_O2O', abs(rows[0][4]-rows[1][4]))
print('seam per spec <=20ms silence (amplitude criterion: <0.01):', all(r[4] < 0.01 for r in rows))
print('RESULT', 'PASS' if all(r[4] < 0.01 for r in rows) else 'FAIL')
# checksums
chk=json.load(open('assets/checksums.json',encoding='utf-8'))
bad=[]
for fn,h in chk.items():
    p=os.path.join('assets',fn)
    if not os.path.exists(p): bad.append((fn,'missing')); continue
    a=hashlib.sha256(open(p,'rb').read()).hexdigest()
    if a!=h: bad.append((fn,'mismatch'))
print('checksums entries',len(chk),'mismatches',len(bad),bad[:5])
files=[f for f in os.listdir('assets') if f not in ('checksums.json','manifest.md')]
print('asset files on disk',len(files),'all covered',set(files)==set(chk))
audio=[f for f in files if f.endswith(('.ogg','.mp3'))]
print('audio files',len(audio),'total bytes',sum(os.path.getsize('assets/'+f) for f in audio))
