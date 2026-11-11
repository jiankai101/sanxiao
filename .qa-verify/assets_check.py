import os, struct, json, sys
from PIL import Image

ROOT = 'assets'
IMAGES = {
 'bg-main.webp': (1920,1080), 'board-frame.webp': (560,560), 'cell-empty.webp': (64,64),
 'tile-star.webp': (64,64), 'tile-water.webp': (64,64), 'tile-leaf.webp': (64,64),
 'tile-flame.webp': (64,64), 'tile-crystal.webp': (64,64), 'tile-bolt.webp': (64,64),
 'tile-select.webp': (64,64), 'special-line-h.webp': (64,64), 'special-line-v.webp': (64,64),
 'special-rainbow.webp': (64,64), 'obs-ice.webp': (64,64), 'obs-stone-2.webp': (64,64),
 'obs-stone-1.webp': (64,64), 'obs-hole.webp': (64,64), 'fx-clear.webp': (128,128),
 'ui-panel.webp': (720,520),
 'icon-star-on.svg': (48,48), 'icon-star-off.svg': (48,48), 'icon-play.svg': (32,32),
 'icon-pause.svg': (32,32), 'icon-restart.svg': (32,32), 'icon-back.svg': (32,32),
 'icon-lock.svg': (32,32), 'icon-sound-on.svg': (32,32), 'icon-sound-off.svg': (32,32),
 'icon-music-on.svg': (32,32), 'icon-music-off.svg': (32,32), 'icon-settings.svg': (32,32),
 'icon-trophy.svg': (32,32), 'icon-close.svg': (32,32),
}
AUDIO = {
 'bgm-main': 60.0, 'sfx-swap': 0.12, 'sfx-invalid': 0.15, 'sfx-match': 0.25, 'sfx-cascade': 0.30,
 'sfx-special-line': 0.40, 'sfx-special-rainbow': 0.60, 'sfx-ice-break': 0.30,
 'sfx-stone-break': 0.35, 'sfx-shuffle': 0.50, 'sfx-star': 0.50, 'sfx-win': 1.50,
 'sfx-lose': 1.20, 'sfx-click': 0.08,
}
fails = []

def ogg_info(path):
    data = open(path,'rb').read()
    # find vorbis id header
    i = data.find(b'\x01vorbis')
    if i < 0: return (None,None)
    ch = data[i+11]
    rate = struct.unpack('<I', data[i+12:i+16])[0]
    # last granule
    j = data.rfind(b'OggS')
    gran = struct.unpack('<q', data[j+6:j+14])[0]
    return (ch, rate, gran/rate)

MP3_BITRATES = {
 (1,1):[0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
 (1,2):[0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],
 (1,3):[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],
 (2,1):[0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
 (2,2):[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
 (2,3):[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
}
RATES = {3:[44100,48000,32000],2:[22050,24000,16000],0:[11025,12000,8000]}

def mp3_info(path):
    data = open(path,'rb').read()
    # skip ID3
    off = 0
    if data[:3] == b'ID3':
        size = (data[6]<<21)|(data[7]<<14)|(data[8]<<7)|data[9]
        off = 10 + size
    # find first valid frame sync
    while off < len(data)-4:
        if data[off] == 0xFF and (data[off+1] & 0xE0) == 0xE0:
            b1, b2, b3 = data[off+1], data[off+2], data[off+3]
            ver_bits = (b1 >> 3) & 3
            layer_bits = (b1 >> 1) & 3
            br_idx = (b2 >> 4) & 0xF
            sr_idx = (b2 >> 2) & 3
            mode = (b3 >> 6) & 3
            if ver_bits != 1 and layer_bits != 0 and br_idx not in (0,15) and sr_idx != 3:
                vtab = 1 if ver_bits == 3 else 2
                ltab = 4 - layer_bits  # 3->1, 2->2, 1->3
                br = MP3_BITRATES[(vtab, ltab)][br_idx] * 1000
                sr = RATES[ver_bits][sr_idx]
                # Xing/Info header
                side = 32 if vtab == 1 else 17
                if mode == 3: side = 17 if vtab == 1 else 9
                xoff = off + 4 + side
                if data[xoff:xoff+4] in (b'Xing', b'Info'):
                    flags = struct.unpack('>I', data[xoff+4:xoff+8])[0]
                    p = xoff+8
                    if flags & 1:
                        frames = struct.unpack('>I', data[p:p+4])[0]
                        return (1 if mode==3 else 2, sr, frames*1152/sr)
                # fallback: count frames
                total = 0
                pos = off
                while pos < len(data)-4:
                    if data[pos] == 0xFF and (data[pos+1] & 0xE0) == 0xE0:
                        b2f = data[pos+2]; brf = (b2f>>4)&0xF; srf=(b2f>>2)&3
                        if brf in (0,15) or srf==3: break
                        brate = MP3_BITRATES[(vtab, ltab)][brf]*1000
                        srate = RATES[ver_bits][srf]
                        pad = (b2f>>1)&1
                        if ltab == 1: flen = (12*brate//srate + pad)*4
                        elif ltab == 3 and vtab == 2: flen = 72*brate//srate + pad
                        else: flen = 144*brate//srate + pad
                        total += 1
                        pos += flen
                    else:
                        pos += 1
                return (1 if mode==3 else 2, sr, total*1152/sr)
        off += 1
    return (None,None,None)

print('== images ==')
img_total = 0
for name,(w,h) in IMAGES.items():
    p = os.path.join(ROOT,name)
    if not os.path.exists(p):
        fails.append(f'missing image {name}'); print(f'MISSING {name}'); continue
    size = os.path.getsize(p)
    img_total += size
    if name.endswith('.webp'):
        im = Image.open(p); actual = im.size; fmt = im.format
        alpha = im.mode in ('RGBA','LA') or (im.mode=='P' and 'transparency' in im.info)
        ok = actual == (w,h) and fmt == 'WEBP'
        if not ok: fails.append(f'{name} size/format {actual} {fmt}')
        # 透明素材必须带 alpha（除 bg-main/board-frame/ui-panel）
        needs_alpha = name not in ('bg-main.webp','board-frame.webp','ui-panel.webp','cell-empty.webp')
        print(f'{name:24s} {actual[0]}x{actual[1]:<5} {fmt:5s} alpha={alpha!s:5s} {size/1024:7.1f}KB')
    else:
        txt = open(p,encoding='utf-8').read()
        import re
        m = re.search(r'viewBox="0 0 (\d+) (\d+)"', txt)
        ok = m and (int(m.group(1)), int(m.group(2))) == (w,h)
        if not ok: fails.append(f'{name} viewBox mismatch {m.groups() if m else None}')
        print(f'{name:24s} {w}x{h:<5} SVG  {size:7d}B')
print(f'images total = {img_total/1024:.1f} KB (limit 1638.4 KB)')
if img_total > 1.6*1024*1024: fails.append('images exceed 1.6MB')
bg = os.path.getsize(os.path.join(ROOT,'bg-main.webp'))
if bg > 400*1024: fails.append('bg-main exceeds 400KB')
first = sum(os.path.getsize(os.path.join(ROOT,n)) for n in ['bg-main.webp','board-frame.webp','cell-empty.webp','ui-panel.webp','tile-star.webp','tile-water.webp','tile-leaf.webp','tile-flame.webp','tile-crystal.webp','tile-bolt.webp','obs-ice.webp','obs-stone-2.webp','obs-stone-1.webp','obs-hole.webp','tile-select.webp','special-line-h.webp','special-line-v.webp','special-rainbow.webp','fx-clear.webp'])
print(f'bg-main = {bg/1024:.1f} KB; first-screen images = {first/1024:.1f} KB (limit 1228.8)')

print('== audio ==')
aud_total = 0
for name, dur in AUDIO.items():
    for ext in ('ogg','mp3'):
        p = os.path.join(ROOT, f'{name}.{ext}')
        if not os.path.exists(p):
            fails.append(f'missing {name}.{ext}'); print('MISSING', name, ext); continue
        size = os.path.getsize(p); aud_total += size
        if ext == 'ogg':
            ch, rate, d = ogg_info(p)
        else:
            ch, rate, d = mp3_info(p)
        ok = d is not None and abs(d - dur) <= 0.02
        if not ok: fails.append(f'{name}.{ext} duration {d} != {dur}')
        if ch not in (1,None): fails.append(f'{name}.{ext} channels {ch}')
        if rate not in (48000,None): fails.append(f'{name}.{ext} rate {rate}')
        print(f'{name}.{ext:4s} dur={d:6.3f}s (spec {dur:4.2f}) ch={ch} rate={rate} {size/1024:7.1f}KB {"OK" if ok else "FAIL"}')
print(f'audio total = {aud_total/1024:.1f} KB (limit 2048)')
if aud_total > 2.0*1024*1024: fails.append('audio exceeds 2.0MB')
print('FAILS:', len(fails))
for f in fails: print(' -', f)

