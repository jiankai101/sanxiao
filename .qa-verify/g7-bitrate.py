import os,struct,collections
NAMES=['bgm-main','sfx-swap','sfx-invalid','sfx-match','sfx-cascade','sfx-special-line','sfx-special-rainbow','sfx-ice-break','sfx-stone-break','sfx-shuffle','sfx-star','sfx-win','sfx-lose','sfx-click']
BR={(1,1):[0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],(1,2):[0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],(1,3):[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]}
RATES={3:[44100,48000,32000],2:[22050,24000,16000],0:[11025,12000,8000]}
def mp3_rates(p):
    d=open(p,'rb').read(); off=0
    if d[:3]==b'ID3': off=10+((d[6]<<21)|(d[7]<<14)|(d[8]<<7)|d[9])
    vals=[]
    while off<len(d)-4:
        if d[off]==0xFF and (d[off+1]&0xE0)==0xE0:
            b1,b2=d[off+1],d[off+2]; ver=(b1>>3)&3; layer=(b1>>1)&3; br=(b2>>4)&0xF; sri=(b2>>2)&3
            if ver!=1 and layer!=0 and br not in (0,15) and sri!=3:
                vtab=1 if ver==3 else 2; ltab=4-layer
                return BR[(vtab,ltab)][br], RATES[ver][sri], (1 if ((d[off+3]>>6)&3)==3 else 2)
        off+=1
    return None,None,None
def ogg_nominal(p):
    d=open(p,'rb').read(); i=d.find(b'\x01vorbis')
    if i<0: return None,None,None
    ch=d[i+11]; rate=struct.unpack('<I',d[i+12:i+16])[0]; nom=struct.unpack('<i',d[i+20:i+24])[0]
    return nom,rate,ch
for n in NAMES:
    mb,mr,mc=mp3_rates(f'assets/{n}.mp3'); ob,orr,oc=ogg_nominal(f'assets/{n}.ogg')
    print(f'{n:20s} MP3 {mb}kbps {mr}Hz {mc}ch | OGG nominal {ob/1000 if ob else None}kbps {orr}Hz {oc}ch')
