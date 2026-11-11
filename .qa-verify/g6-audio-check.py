# G6 独立音效资源复核：MP3 时长（≤1 帧）、OGG 时长、两套一致性、总体积
import os, struct, sys
import numpy as np
import soundfile as sf

AUDIO = {
 'bgm-main': 60.0, 'sfx-swap': 0.12, 'sfx-invalid': 0.15, 'sfx-match': 0.25, 'sfx-cascade': 0.30,
 'sfx-special-line': 0.40, 'sfx-special-rainbow': 0.60, 'sfx-ice-break': 0.30,
 'sfx-stone-break': 0.35, 'sfx-shuffle': 0.50, 'sfx-star': 0.50, 'sfx-win': 1.50,
 'sfx-lose': 1.20, 'sfx-click': 0.08,
}
MP3_BITRATES = {
 (1,1):[0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
 (1,2):[0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],
 (1,3):[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],
}
RATES = {3:[44100,48000,32000],2:[22050,24000,16000],0:[11025,12000,8000]}

def mp3_frames(path):
    data = open(path,'rb').read()
    off = 0
    if data[:3] == b'ID3':
        size = (data[6]<<21)|(data[7]<<14)|(data[8]<<7)|data[9]
        off = 10 + size
    total = 0; sr = None; ch = None; pos = None
    while off < len(data)-4:
        if data[off] == 0xFF and (data[off+1] & 0xE0) == 0xE0:
            b1,b2,b3 = data[off+1], data[off+2], data[off+3]
            ver=(b1>>3)&3; layer=(b1>>1)&3; br=(b2>>4)&0xF; sri=(b2>>2)&3
            mode=(b3>>6)&3
            if ver!=1 and layer!=0 and br not in (0,15) and sri!=3:
                vtab = 1 if ver==3 else 2
                ltab = 4-layer
                brate = MP3_BITRATES[(vtab,ltab)][br]*1000
                srate = RATES[ver][sri]
                pad = (b2>>1)&1
                if ltab==1: flen=(12*brate//srate+pad)*4
                elif ltab==3 and vtab==2: flen=72*brate//srate+pad
                else: flen=144*brate//srate+pad
                total += 1; sr = srate; ch = 1 if mode==3 else 2
                pos = off + flen
                break
        off += 1
    if pos is None: return None
    while pos < len(data)-4:
        if data[pos]==0xFF and (data[pos+1]&0xE0)==0xE0:
            b2=data[pos+2]; brf=(b2>>4)&0xF; srf=(b2>>2)&3
            if brf in (0,15) or srf==3: break
            brate=MP3_BITRATES[(vtab,ltab)][brf]*1000
            srate=RATES[ver][srf]; pad=(b2>>1)&1
            if ltab==1: flen=(12*brate//srate+pad)*4
            elif ltab==3 and vtab==2: flen=72*brate//srate+pad
            else: flen=144*brate//srate+pad
            total += 1; pos += flen
        else:
            pos += 1
    return total, sr, ch

fails = []
total_bytes = 0
print(f"{'file':26s} {'nominal':>8s} {'mp3_frames':>10s} {'mp3_dur':>8s} {'err_ms':>7s} {'frames_err':>10s} {'decoded':>8s} {'corr':>6s}")
for name, dur in AUDIO.items():
    p_ogg = os.path.join('assets', f'{name}.ogg')
    p_mp3 = os.path.join('assets', f'{name}.mp3')
    total_bytes += os.path.getsize(p_ogg) + os.path.getsize(p_mp3)
    frames, sr, ch = mp3_frames(p_mp3)
    frame_ms = 1152.0 / sr * 1000.0
    mp3_dur = frames * 1152.0 / sr
    err_ms = (mp3_dur - dur) * 1000.0
    frames_err = abs(err_ms) / frame_ms
    # 解码（libsndfile）时长与波形
    m, sm = sf.read(p_mp3, dtype='float64', always_2d=True)
    o, so = sf.read(p_ogg, dtype='float64', always_2d=True)
    md = len(m) / sm
    n = min(len(m), len(o))
    a = m[:n,0]; b = o[:n,0]
    corr = float(np.corrcoef(a, b)[0,1]) if n > 10 else float('nan')
    ok = frames_err <= 1.0 + 1e-9 and abs(sm - 48000) < 1 and abs(so - 48000) < 1 and m.shape[1] == 1
    print(f"{name+'.mp3':26s} {dur:8.3f} {frames:10d} {mp3_dur:8.3f} {err_ms:+7.1f} {frames_err:10.3f} {md:8.3f} {corr:6.3f}{'' if ok else '  <-- FAIL'}")
    if not ok: fails.append(name)
    if frames_err > 1.0: fails.append(f'{name} frame error {frames_err:.3f}')
print(f"audio total = {total_bytes/1024:.1f} KB (limit 2048)")
if total_bytes > 2*1024*1024: fails.append('total exceeds 2MB')
print('FAILS:', len(fails), fails)
sys.exit(1 if fails else 0)
