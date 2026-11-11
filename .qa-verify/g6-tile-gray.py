from PIL import Image
import numpy as np, itertools
names = ['tile-star.webp','tile-water.webp','tile-leaf.webp','tile-flame.webp','tile-crystal.webp','tile-bolt.webp']
imgs = {}
for n in names:
    im = Image.open('assets/'+n).convert('RGBA')
    a = np.array(im).astype(float)
    gray = (0.299*a[:,:,0] + 0.587*a[:,:,1] + 0.114*a[:,:,2])
    alpha = a[:,:,3] > 20
    imgs[n] = (gray, alpha)
pairs = []
for x, y in itertools.combinations(names, 2):
    gx, ax = imgs[x]; gy, ay = imgs[y]
    m = ax | ay
    d = np.abs(gx - gy)[m].mean()
    pairs.append((d, x, y))
pairs.sort()
for d,x,y in pairs[:6]:
    print(f'{x:20s} vs {y:20s} mean|Δgray|={d:.1f}/255')
print('min pair diff =', round(pairs[0][0],1))
