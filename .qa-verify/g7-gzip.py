import os,gzip,json
root='dist'
files=[]
for dp,_,fs in os.walk(root):
    for f in fs:
        p=os.path.join(dp,f)
        if p.lower().endswith(('.ogg','.mp3')): continue
        files.append(p)
total_raw=sum(os.path.getsize(p) for p in files)
total_gz=sum(len(gzip.compress(open(p,'rb').read(),9)) for p in files)
print('non-audio dist files',len(files))
print('raw bytes',total_raw,'raw KiB',round(total_raw/1024,1))
print('gzip bytes',total_gz,'gzip KiB',round(total_gz/1024,1),'<=3.0MB:',total_gz<=3*1024*1024)
for p in sorted(files, key=lambda x: -os.path.getsize(x))[:8]:
    print(os.path.getsize(p), p)
