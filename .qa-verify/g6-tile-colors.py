from PIL import Image
import numpy as np
SPEC = {'tile-star.webp':(242,194,48),'tile-water.webp':(58,160,232),'tile-leaf.webp':(87,194,74),'tile-flame.webp':(232,80,58),'tile-crystal.webp':(155,89,208),'tile-bolt.webp':(35,196,196)}
for n,c in SPEC.items():
    im = Image.open('assets/'+n).convert('RGBA')
    a = np.array(im)
    mask = a[:,:,3] > 200
    mean = a[:,:,0:3][mask].mean(axis=0)
    dist = float(np.linalg.norm(mean - np.array(c)))
    print(f'{n:20s} mean={mean.round(1).tolist()} spec={list(c)} dist={dist:.1f}')
