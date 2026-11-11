# G6 音频时长定稿核对：Xing 声明帧数 vs 实际可解码帧数 vs OGG 解码时长
import os, struct, sys
import soundfile as sf
AUDIO = {
 'bgm-main': 60.0, 'sfx-swap': 0.12, 'sfx-invalid': 0.15, 'sfx-match': 0.25, 'sfx-cascade': 0.30,
 'sfx-special-line': 0.40, 'sfx-special-rainbow': 0.60, 'sfx-ice-break': 0.30,
 'sfx-stone-break': 0.35, 'sfx-shuffle': 0.50, 'sfx-star': 0.50, 'sfx-win': 1.50,
 'sfx-lose': 1.20, 'sfx-click': 0.08,
}
BR = {(1,1):[0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],(1,2):[0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],(1,3):[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]}
RATES = {3:[44100,48000,32000],2:[22050,24000,16000],0:[11025,12000,8000]}

def xing_frames(path):
    data = open(path,'rb').read()
    off = 0
    if data[:3] == b'ID3':
        off = 10 + ((data[6]<<21)|(data[7]<<14)|(data[8]<<7)|data[9])
    while off < len(data)-4:
        if data[off]==0xFF and (data[off+1]&0xE0)==0xE0:
            b1,b2,b3=data[off+1],data[off+2],data[off+3]
            ver=(b1>>3)&3; layer=(b1>>1)&3; br=(b2>>4)&0xF; sri=(b2>>2)&3; mode=(b3>>6)&3
            if ver!=1 and layer!=0 and br not in (0,15) and sri!=3:
                vtab=1 if ver==3 else 2; ltab=4-layer
                srate=RATES[ver][sri]
                side = 32 if vtab==1 else 17
                if mode==3: side = 17 if vtab==1 else 9
                x = off+4+side
                if data[x:x+4] in (b'Xing',b'Info'):
                    flags=int.from_bytes(data[x+4:x+8],'big')
                    if flags & 1:
                        return int.from_bytes(data[x+8:x+12],'big'), srate, (1 if mode==3 else 2)
                return None, srate, (1 if mode==3 else 2)
        off += 1
    return None, None, None

fails=[]; zero_margin=[]
print(f"{'file':22s} {'nom':>6s} {'xing_f':>6s} {'pcm_f':>6s} {'mp3_ms':>8s} {'err_ms':>7s} {'frameErr':>8s} {'ogg_ms':>8s} {'|o-m|':>6s}")
for name, nom in AUDIO.items():
    xf, sr, ch = xing_frames(f'assets/{name}.mp3')
    frame_ms = 1152.0/sr*1000.0
    mp3_pcm_frames = xf - 1           # LAME info/flush 帧不计入可解码 PCM
    mp3_ms = mp3_pcm_frames*frame_ms
    err = mp3_ms - nom*1000
    fe = abs(err)/frame_ms
    o, so = sf.read(f'assets/{name}.ogg', dtype='float64', always_2d=True)
    ogg_ms = len(o)/so*1000
    diff = abs(ogg_ms-mp3_ms)
    ok = fe <= 1.0 + 1e-9
    if not ok: fails.append(name)
    if abs(fe-1.0) < 1e-9: zero_margin.append(name)
    print(f"{name:22s} {nom*1000:6.0f} {xf:6d} {mp3_pcm_frames:6d} {mp3_ms:8.1f} {err:+7.1f} {fe:8.2f} {ogg_ms:8.1f} {diff:6.1f}{'' if ok else '  <-- FAIL'}")
print()
print('MP3 frame = 24.0ms @48kHz; 判定：|err| <= 1 frame')
print('PASS:', len(AUDIO)-len(fails), '/', len(AUDIO), ' FAIL:', fails)
print('零余量（恰好 1 帧）:', zero_margin)
sys.exit(1 if fails else 0)
