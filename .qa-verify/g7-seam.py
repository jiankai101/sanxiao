import numpy as np, soundfile as sf
for ext in ['ogg','mp3']:
    x,sr=sf.read(f'assets/bgm-main.{ext}',dtype='float64',always_2d=True)
    x=x[:,0]
    # longest run of near-silence (|x|<=0.005) over last 100ms + first 100ms, treating the loop boundary as continuous
    n=int(sr*0.1)
    seg=np.concatenate([x[-n:],x[:n]])
    silent=np.abs(seg)<=0.005
    best=cur=0
    for v in silent:
        cur=cur+1 if v else 0
        best=max(best,cur)
    boundary=[abs(x[-1]),abs(x[0])]
    print(ext,'sr',sr,'len',len(x),'seam_amp',abs(x[-1]-x[0]),'boundary_abs',boundary,'longest_near_silence_ms',round(best/sr*1000,2),'<=20ms',best/sr*1000<=20)
