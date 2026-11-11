#!/usr/bin/env python3
"""Deterministic image asset generator for web-match-game.

All raster art under assets/ is produced by this script from the numeric
specification (spec.md 5.1 / 10.1, plan.md 9.1 / 9.4) so that pixel sizes,
alpha and the six element colours are exact and reproducible.

Run:  python assets/tools/generate_images.py
Deps: pillow, numpy
"""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 4  # supersampling factor for 64px sprites

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

# spec.md 5.1 - do not change without a CR
COLORS = {
    "star": "#F2C230",
    "water": "#3AA0E8",
    "leaf": "#57C24A",
    "flame": "#E8503A",
    "crystal": "#9B59D0",
    "bolt": "#23C4C4",
}


def hx(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def vgrad(w, h, stops, horizontal=False):
    """Linear gradient. stops: [(pos 0..1, (r,g,b), alpha)]."""
    pos = np.array([s[0] for s in stops], dtype=np.float64)
    cols = np.array([s[1] for s in stops], dtype=np.float64)
    alphas = np.array([s[2] for s in stops], dtype=np.float64)
    n = w if horizontal else h
    t = np.linspace(0.0, 1.0, n)
    chans = [np.interp(t, pos, cols[:, i]) for i in range(3)]
    a = np.interp(t, pos, alphas)
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    if horizontal:
        for i in range(3):
            arr[:, :, i] = chans[i][None, :].astype(np.uint8)
        arr[:, :, 3] = a[None, :].astype(np.uint8)
    else:
        for i in range(3):
            arr[:, :, i] = chans[i][:, None].astype(np.uint8)
        arr[:, :, 3] = a[:, None].astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def cubic(p0, p1, p2, p3, n=48):
    out = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0]
        y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1]
        out.append((x, y))
    return out


def poly_mask(n, groups):
    m = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(m)
    for pts in groups:
        d.polygon([(float(x), float(y)) for x, y in pts], fill=255)
    return m


def smooth(mask, r):
    return mask if r <= 0 else mask.filter(ImageFilter.GaussianBlur(r))


def star_points(cx, cy, R, r, n=5, rot=-90.0):
    pts = []
    for i in range(2 * n):
        ang = math.radians(rot + i * 180.0 / n)
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def shape_mask(kind, n):
    c = n / 2.0
    if kind == "star":
        return poly_mask(n, [star_points(c, c + n * 0.02, n * 0.46, n * 0.20)])
    if kind == "water":
        body = Image.new("L", (n, n), 0)
        d = ImageDraw.Draw(body)
        r = n * 0.27
        d.ellipse([c - r, n * 0.66 - r, c + r, n * 0.66 + r], fill=255)
        left = cubic((c, n * 0.06), (c - n * 0.30, n * 0.42), (c - n * 0.34, n * 0.60), (c - r, n * 0.70))
        right = cubic((c, n * 0.06), (c + n * 0.30, n * 0.42), (c + n * 0.34, n * 0.60), (c + r, n * 0.70))
        d.polygon([(float(x), float(y)) for x, y in left + right[::-1]], fill=255)
        return body.filter(ImageFilter.GaussianBlur(n * 0.012)).point(lambda v: 255 if v > 120 else 0)
    if kind == "leaf":
        left = cubic((c, n * 0.07), (n * 0.14, n * 0.32), (n * 0.16, n * 0.74), (c, n * 0.93))
        right = cubic((c, n * 0.93), (n * 0.84, n * 0.74), (n * 0.86, n * 0.32), (c, n * 0.07))
        return poly_mask(n, [left + right[1:]])
    if kind == "flame":
        a = cubic((n * 0.50, n * 0.96), (n * 0.22, n * 0.92), (n * 0.13, n * 0.66), (n * 0.27, n * 0.45))
        b = cubic((n * 0.27, n * 0.45), (n * 0.40, n * 0.32), (n * 0.31, n * 0.20), (n * 0.47, n * 0.07))
        cc = cubic((n * 0.47, n * 0.07), (n * 0.63, n * 0.26), (n * 0.88, n * 0.54), (n * 0.80, n * 0.78))
        d = cubic((n * 0.80, n * 0.78), (n * 0.74, n * 0.93), (n * 0.62, n * 0.97), (n * 0.50, n * 0.96))
        return poly_mask(n, [a + b[1:] + cc[1:] + d[1:]])
    if kind == "crystal":
        pts = [(c, n * 0.05), (n * 0.79, n * 0.33), (n * 0.79, n * 0.68), (c, n * 0.95),
               (n * 0.21, n * 0.68), (n * 0.21, n * 0.33)]
        return poly_mask(n, [pts])
    if kind == "bolt":
        pts = [(n * 0.62, n * 0.03), (n * 0.24, n * 0.56), (n * 0.47, n * 0.56),
               (n * 0.38, n * 0.97), (n * 0.78, n * 0.42), (n * 0.55, n * 0.42),
               (n * 0.64, n * 0.03)]
        return poly_mask(n, [pts])
    raise ValueError(kind)


def compose_shape(mask, color, gloss=True, outline=0.42, shadow=0.26):
    n = mask.size[0]
    top = mix(color, WHITE, 0.20)
    bot = mix(color, BLACK, 0.16)
    img = vgrad(n, n, [(0.0, top, 255), (0.30, color, 255), (0.74, color, 255), (1.0, bot, 255)])
    img.putalpha(mask)

    if gloss:
        gl = Image.new("L", (n, n), 0)
        ImageDraw.Draw(gl).ellipse([n * 0.18, n * 0.12, n * 0.62, n * 0.44], fill=95)
        gl = smooth(gl, n * 0.035)
        gl = Image.composite(gl, Image.new("L", (n, n), 0), mask)
        white = Image.new("RGBA", (n, n), rgba(WHITE, 255))
        img = Image.composite(white, img, gl.point(lambda v: int(v * 0.85)))

    if shadow > 0:
        arr = np.zeros((n, n), dtype=np.float64)
        ys = np.arange(n) / (n - 1.0)
        arr[:, :] = np.clip((ys - 0.55) / 0.45, 0, 1) ** 1.6 * (shadow * 255)
        sh = Image.fromarray(arr.astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(n * 0.03))
        sh = Image.composite(sh, Image.new("L", (n, n), 0), mask)
        dark = Image.new("RGBA", (n, n), rgba(BLACK, 255))
        img = Image.composite(dark, img, sh.point(lambda v: int(v * 0.9)))

    edge = mask.filter(ImageFilter.MinFilter(9))
    rim = Image.fromarray(np.clip(np.asarray(mask, dtype=np.int16) - np.asarray(edge, dtype=np.int16),
                                  0, 255).astype(np.uint8), "L")
    rim = smooth(rim, n * 0.006)
    img = Image.composite(Image.new("RGBA", (n, n), rgba(mix(color, BLACK, outline), 255)), img, rim)
    return img

def add_facets(img, mask, color, kind):
    n = mask.size[0]
    c = n / 2
    lay = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    if kind == "crystal":
        d.polygon([(c, n * 0.05), (n * 0.79, n * 0.33), (n * 0.21, n * 0.33)], fill=rgba(mix(color, WHITE, 0.58), 190))
        d.polygon([(n * 0.21, n * 0.33), (c, n * 0.52), (n * 0.21, n * 0.68)], fill=rgba(mix(color, BLACK, 0.30), 120))
        d.polygon([(n * 0.79, n * 0.33), (c, n * 0.52), (n * 0.79, n * 0.68)], fill=rgba(mix(color, BLACK, 0.10), 95))
        d.polygon([(c, n * 0.52), (n * 0.21, n * 0.68), (c, n * 0.95)], fill=rgba(mix(color, BLACK, 0.20), 90))
        d.polygon([(c, n * 0.52), (n * 0.79, n * 0.68), (c, n * 0.95)], fill=rgba(mix(color, WHITE, 0.10), 60))
        d.line([(n * 0.21, n * 0.33), (n * 0.79, n * 0.33)], fill=rgba(mix(color, WHITE, 0.60), 130), width=4)
    elif kind == "leaf":
        d.line([(c, n * 0.10), (c, n * 0.90)], fill=rgba(mix(color, BLACK, 0.30), 130), width=6)
        for i in range(3):
            y = n * (0.30 + 0.17 * i)
            d.line([(c, y), (n * (0.62 + 0.03 * i), y - n * 0.10)], fill=rgba(mix(color, BLACK, 0.24), 95), width=4)
            d.line([(c, y + n * 0.08), (n * (0.38 - 0.03 * i), y - n * 0.02)], fill=rgba(mix(color, BLACK, 0.24), 95), width=4)
    elif kind == "flame":
        inner = cubic((n * 0.50, n * 0.88), (n * 0.36, n * 0.82), (n * 0.34, n * 0.62), (n * 0.46, n * 0.44))
        inner2 = cubic((n * 0.46, n * 0.44), (n * 0.55, n * 0.50), (n * 0.60, n * 0.62), (n * 0.52, n * 0.74))
        inner3 = cubic((n * 0.52, n * 0.74), (n * 0.64, n * 0.70), (n * 0.66, n * 0.84), (n * 0.50, n * 0.88))
        d.polygon(inner + inner2[1:] + inner3[1:], fill=rgba(mix(color, WHITE, 0.62), 150))
    elif kind == "water":
        d.ellipse([n * 0.34, n * 0.36, n * 0.44, n * 0.56], fill=rgba(WHITE, 150))
    lay.putalpha(Image.composite(lay.getchannel("A"), Image.new("L", (n, n), 0), mask))
    return Image.alpha_composite(img, lay)


def sprite(kind, color, size=64):
    n = size * SS
    mask = shape_mask(kind, n)
    img = compose_shape(mask, color)
    img = add_facets(img, mask, color, kind)
    return img.resize((size, size), Image.LANCZOS)


def save_webp(img, name, quality=92):
    path = os.path.join(ROOT, name)
    img.save(path, "WEBP", quality=quality, alpha_quality=100, method=6, exact=True)
    print("%-24s %dx%d %d B" % (name, img.size[0], img.size[1], os.path.getsize(path)))


def build_tiles():
    for key, hexv in COLORS.items():
        save_webp(sprite(key, hx(hexv)), "tile-%s.webp" % key, 95)


def build_select():
    n = 64 * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = n * 0.055
    d.rounded_rectangle([pad, pad, n - pad, n - pad], radius=n * 0.22,
                        outline=(255, 255, 255, 235), width=int(n * 0.045))
    d.rounded_rectangle([pad * 1.9, pad * 1.9, n - pad * 1.9, n - pad * 1.9], radius=n * 0.17,
                        outline=rgba(hx("#23C4C4"), 200), width=int(n * 0.022))
    glow = img.filter(ImageFilter.GaussianBlur(n * 0.02))
    save_webp(Image.alpha_composite(glow, img).resize((64, 64), Image.LANCZOS), "tile-select.webp", 95)


def build_line_special(vertical):
    n = 64 * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    band = Image.new("L", (n, n), 0)
    bd = ImageDraw.Draw(band)
    if vertical:
        bd.rounded_rectangle([n * 0.38, n * 0.06, n * 0.62, n * 0.94], radius=n * 0.12, fill=120)
    else:
        bd.rounded_rectangle([n * 0.06, n * 0.38, n * 0.94, n * 0.62], radius=n * 0.12, fill=120)
    img = Image.composite(Image.new("RGBA", (n, n), rgba(WHITE, 110)),
                          img, band.filter(ImageFilter.GaussianBlur(n * 0.03)))
    img = Image.composite(Image.new("RGBA", (n, n), rgba(WHITE, 70)), img, band)
    arrow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arrow)
    w = int(n * 0.10)
    head = n * 0.17
    for s in (0, 1):
        if not vertical:
            x0 = n * (0.30 if s == 0 else 0.70)
            sign = -1 if s == 0 else 1
            ad.line([(x0, n * 0.5), (x0 + sign * n * 0.10, n * 0.5)], fill=(255, 255, 255, 240), width=w)
            ad.polygon([(x0 + sign * n * 0.07, n * 0.5 - head * 0.55),
                        (x0 + sign * n * 0.17, n * 0.5),
                        (x0 + sign * n * 0.07, n * 0.5 + head * 0.55)], fill=(255, 255, 255, 240))
        else:
            y0 = n * (0.30 if s == 0 else 0.70)
            sign = -1 if s == 0 else 1
            ad.line([(n * 0.5, y0), (n * 0.5, y0 + sign * n * 0.10)], fill=(255, 255, 255, 240), width=w)
            ad.polygon([(n * 0.5 - head * 0.55, y0 + sign * n * 0.07),
                        (n * 0.5, y0 + sign * n * 0.17),
                        (n * 0.5 + head * 0.55, y0 + sign * n * 0.07)], fill=(255, 255, 255, 240))
    img = Image.alpha_composite(img, arrow)
    save_webp(img.resize((64, 64), Image.LANCZOS),
              "special-line-v.webp" if vertical else "special-line-h.webp", 95)


def build_rainbow():
    n = 64 * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ring = n * 0.40
    cols = ["#E8503A", "#F2A03A", "#F2C230", "#57C24A", "#3AA0E8", "#9B59D0"]
    box = [n / 2 - ring, n / 2 - ring, n / 2 + ring, n / 2 + ring]
    d = ImageDraw.Draw(img)
    for i, c in enumerate(cols):
        a0 = -90 + i * 60
        d.arc(box, a0, a0 + 61, fill=rgba(hx(c), 235), width=int(n * 0.15))
    glow = img.filter(ImageFilter.GaussianBlur(n * 0.035))
    out = Image.alpha_composite(glow, img)
    ImageDraw.Draw(out).ellipse([n * 0.22, n * 0.22, n * 0.78, n * 0.78],
                                outline=(255, 255, 255, 170), width=int(n * 0.012))
    save_webp(out.resize((64, 64), Image.LANCZOS), "special-rainbow.webp", 95)

def build_ice():
    n = 64 * SS
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle([n * 0.04, n * 0.04, n * 0.96, n * 0.96], radius=n * 0.16, fill=255)
    mask = smooth(mask, n * 0.006)
    img = vgrad(n, n, [(0, (232, 248, 255), 205), (0.6, (176, 226, 248), 175), (1, (120, 190, 230), 205)])
    img.putalpha(mask.point(lambda v: int(v * 0.8)))
    d = ImageDraw.Draw(img)
    d.line([(n * 0.22, n * 0.30), (n * 0.40, n * 0.44), (n * 0.35, n * 0.62), (n * 0.54, n * 0.74)],
           fill=(255, 255, 255, 190), width=int(n * 0.012), joint="curve")
    d.line([(n * 0.40, n * 0.44), (n * 0.62, n * 0.36), (n * 0.78, n * 0.48)],
           fill=(255, 255, 255, 175), width=int(n * 0.010), joint="curve")
    d.rounded_rectangle([n * 0.09, n * 0.09, n * 0.91, n * 0.91], radius=n * 0.13,
                        outline=(255, 255, 255, 150), width=int(n * 0.010))
    save_webp(img.resize((64, 64), Image.LANCZOS), "obs-ice.webp", 95)


def build_stone(damaged):
    n = 64 * SS
    mask = Image.new("L", (n, n), 0)
    pts = [(n * 0.14, n * 0.34), (n * 0.30, n * 0.12), (n * 0.64, n * 0.08), (n * 0.86, n * 0.30),
           (n * 0.90, n * 0.66), (n * 0.68, n * 0.90), (n * 0.32, n * 0.92), (n * 0.10, n * 0.66)]
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    mask = smooth(mask, n * 0.004)
    base = (118, 126, 138)
    img = vgrad(n, n, [(0, mix(base, WHITE, 0.28), 255), (0.5, base, 255), (1, mix(base, BLACK, 0.32), 255)])
    img.putalpha(mask)
    d = ImageDraw.Draw(img)
    d.line([(n * 0.26, n * 0.40), (n * 0.44, n * 0.34), (n * 0.58, n * 0.44)],
           fill=(255, 255, 255, 90), width=int(n * 0.014), joint="curve")
    srng = np.random.default_rng(4242)
    for _ in range(26):
        px = float(srng.uniform(n * 0.18, n * 0.82))
        py = float(srng.uniform(n * 0.18, n * 0.80))
        pr = float(srng.uniform(n * 0.006, n * 0.016))
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(255, 255, 255, int(srng.uniform(18, 52))))
    if damaged:
        main = [(n * 0.36, n * 0.22), (n * 0.46, n * 0.38), (n * 0.41, n * 0.52),
                (n * 0.56, n * 0.66), (n * 0.62, n * 0.84)]
        d.line(main, fill=(28, 32, 38, 225), width=int(n * 0.020), joint="curve")
        d.line([(n * 0.46, n * 0.38), (n * 0.60, n * 0.34), (n * 0.70, n * 0.42)],
               fill=(28, 32, 38, 195), width=int(n * 0.014), joint="curve")
        d.line([(n * 0.41, n * 0.52), (n * 0.28, n * 0.56), (n * 0.20, n * 0.66)],
               fill=(28, 32, 38, 185), width=int(n * 0.013), joint="curve")
        d.line([(n * 0.56, n * 0.66), (n * 0.72, n * 0.70)], fill=(28, 32, 38, 170), width=int(n * 0.011))
    edge = mask.filter(ImageFilter.MinFilter(9))
    rim = Image.fromarray(np.clip(np.asarray(mask, dtype=np.int16) - np.asarray(edge, dtype=np.int16),
                                  0, 255).astype(np.uint8), "L")
    img = Image.composite(Image.new("RGBA", (n, n), (52, 58, 68, 255)), img, smooth(rim, n * 0.006))
    save_webp(img.resize((64, 64), Image.LANCZOS), "obs-stone-1.webp" if damaged else "obs-stone-2.webp", 95)


def build_hole():
    n = 64 * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    m = Image.new("L", (n, n), 0)
    ImageDraw.Draw(m).rounded_rectangle([n * 0.03, n * 0.03, n * 0.97, n * 0.97], radius=n * 0.14, fill=255)
    img.paste(vgrad(n, n, [(0, (8, 16, 24), 235), (0.55, (16, 32, 44), 240), (1, (26, 48, 62), 235)]), (0, 0), m)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([n * 0.05, n * 0.05, n * 0.95, n * 0.95], radius=n * 0.13,
                        outline=(93, 61, 38, 200), width=int(n * 0.020))
    d.arc([n * 0.10, n * 0.06, n * 0.90, n * 0.80], 200, 340, fill=(255, 210, 160, 60), width=int(n * 0.018))
    save_webp(img.resize((64, 64), Image.LANCZOS), "obs-hole.webp", 95)


def build_fx():
    n = 128 * 2
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    glow = Image.new("L", (n, n), 0)
    ImageDraw.Draw(glow).ellipse([n * 0.26, n * 0.26, n * 0.74, n * 0.74], fill=140)
    glow = glow.filter(ImageFilter.GaussianBlur(n * 0.06))
    img = Image.composite(Image.new("RGBA", (n, n), (255, 240, 200, 200)), img, glow)
    spikes = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(spikes)
    for i in range(12):
        a = math.radians(i * 30 + 15)
        r1 = n * (0.46 if i % 2 == 0 else 0.33)
        w = n * (0.055 if i % 2 == 0 else 0.035)
        px, py = math.cos(a), math.sin(a)
        ox, oy = -py, px
        d.polygon([(n / 2 + ox * w, n / 2 + oy * w), (n / 2 + px * r1, n / 2 + py * r1),
                   (n / 2 - ox * w, n / 2 - oy * w)], fill=(255, 236, 170, 220))
    img = Image.alpha_composite(img, spikes.filter(ImageFilter.GaussianBlur(n * 0.008)))
    d2 = ImageDraw.Draw(img)
    d2.ellipse([n * 0.36, n * 0.36, n * 0.64, n * 0.64], fill=(255, 255, 255, 235))
    for i in range(8):
        a = math.radians(i * 45 + 22)
        cx = n / 2 + math.cos(a) * n * 0.36
        cy = n / 2 + math.sin(a) * n * 0.36
        r = n * 0.022
        d2.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 250, 220, 210))
    save_webp(img.resize((128, 128), Image.LANCZOS), "fx-clear.webp", 95)


def build_cell():
    n = 64 * 2
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    m = Image.new("L", (n, n), 0)
    ImageDraw.Draw(m).rounded_rectangle([n * 0.06, n * 0.06, n * 0.94, n * 0.94], radius=n * 0.18, fill=255)
    img.paste(vgrad(n, n, [(0, (10, 26, 38), 120), (1, (28, 62, 78), 120)]), (0, 0), m)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([n * 0.06, n * 0.06, n * 0.94, n * 0.94], radius=n * 0.18,
                        outline=(86, 150, 168, 110), width=max(2, int(n * 0.014)))
    d.arc([n * 0.09, n * 0.07, n * 0.91, n * 0.60], 195, 330, fill=(180, 235, 245, 70), width=int(n * 0.012))
    save_webp(img.resize((64, 64), Image.LANCZOS), "cell-empty.webp", 95)

def build_frame():
    n = 560 * 2
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    outer = Image.new("L", (n, n), 0)
    ImageDraw.Draw(outer).rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 0.065, fill=255)
    img.paste(vgrad(n, n, [(0, (28, 74, 92), 255), (0.35, (18, 52, 68), 255), (1, (10, 32, 44), 255)]), (0, 0), outer)

    inner_box = [n * (24 / 560), n * (24 / 560), n * (536 / 560), n * (536 / 560)]
    inner = Image.new("L", (n, n), 0)
    ImageDraw.Draw(inner).rounded_rectangle(inner_box, radius=n * 0.040, fill=255)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(inner_box, radius=n * 0.040, outline=(35, 196, 196, 70), width=int(n * 0.010))
    d.rounded_rectangle([inner_box[0] - n * 0.006, inner_box[1] - n * 0.006,
                         inner_box[2] + n * 0.006, inner_box[3] + n * 0.006],
                        radius=n * 0.046, outline=(120, 220, 220, 45), width=int(n * 0.004))
    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 0.065, outline=(80, 180, 190, 90), width=int(n * 0.006))
    img.putalpha(Image.composite(img.getchannel("A"), Image.new("L", (n, n), 0),
                                 ImageChops.subtract(outer, inner)))
    save_webp(img.resize((560, 560), Image.LANCZOS), "board-frame.webp", 88)


def build_panel():
    w, h = 720 * 2, 520 * 2
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([4, 4, w - 4, h - 4], radius=72, fill=255)
    img.paste(vgrad(w, h, [(0, (20, 48, 66), 244), (0.45, (13, 32, 46), 246), (1, (8, 22, 32), 248)]), (0, 0), m)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 4, w - 4, h - 4], radius=72, outline=(35, 196, 196, 150), width=6)
    d.rounded_rectangle([18, 18, w - 18, h - 18], radius=62, outline=(120, 230, 230, 40), width=3)
    d.arc([22, 18, w - 22, 210], 203, 337, fill=(180, 240, 250, 38), width=6)
    save_webp(img.resize((720, 520), Image.LANCZOS), "ui-panel.webp", 88)


def build_background():
    w, h = 1920, 1080
    stops = [(0.0, hx("#082033"), 255), (0.26, hx("#12566E"), 255), (0.55, hx("#237E96"), 255),
             (0.80, hx("#17566B"), 255), (1.0, hx("#0B2331"), 255)]
    pos = [st[0] for st in stops]
    cols = np.array([st[1] for st in stops], dtype=np.float64)
    t = np.linspace(0, 1, h)
    arr = np.zeros((h, w, 3), dtype=np.float64)
    for i in range(3):
        arr[:, :, i] = np.interp(t, pos, cols[:, i])[:, None]

    rng = np.random.default_rng(20261110)
    dither = rng.uniform(-2.2, 2.2, size=(h, w, 1))
    arr = np.clip(arr + dither, 0, 255)
    img = Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")

    sun = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sun)
    for r, a in [(760, 16), (560, 20), (400, 26), (260, 34), (150, 44)]:
        sd.ellipse([1560 - r, 70 - r, 1560 + r, 70 + r], fill=(242, 196, 60, a))
    img = Image.alpha_composite(img, sun.filter(ImageFilter.GaussianBlur(60)))

    rays = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for i in range(4):
        x0 = 1460 + i * 90
        rd.polygon([(x0, 0), (x0 + 90, 0), (x0 - 620, h), (x0 - 760, h)], fill=(210, 245, 255, 7))
    img = Image.alpha_composite(img, rays.filter(ImageFilter.GaussianBlur(30)))

    clouds = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(clouds)
    for cx, cy, sc, a in [(260, 900, 1.0, 26), (760, 960, 1.3, 22), (1420, 930, 1.1, 24), (1760, 860, 0.8, 18)]:
        for dx, dy, rw, rh in [(0, 0, 300, 56), (-150, 16, 210, 40), (170, 12, 230, 44), (-40, -26, 180, 38)]:
            cd.ellipse([cx + dx * sc - rw * sc, cy + dy * sc - rh * sc,
                        cx + dx * sc + rw * sc, cy + dy * sc + rh * sc], fill=(226, 246, 255, a))
    img = Image.alpha_composite(img, clouds.filter(ImageFilter.GaussianBlur(26)))

    hills = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hills)
    top1 = cubic((0, 940), (420, 810), (900, 980), (1400, 880)) + cubic((1400, 880), (1660, 830), (1830, 890), (1920, 860))
    hd.polygon([(0, 940)] + top1 + [(1920, 1080), (0, 1080)], fill=(23, 92, 110, 255))
    hd.line(top1, fill=(120, 220, 230, 55), width=2, joint="curve")
    top2 = cubic((0, 1006), (360, 916), (760, 1040), (1180, 968)) + cubic((1180, 968), (1500, 918), (1760, 980), (1920, 950))
    hd.polygon([(0, 1006)] + top2 + [(1920, 1080), (0, 1080)], fill=(14, 66, 82, 255))
    hd.line(top2, fill=(110, 210, 222, 45), width=2, joint="curve")
    top3 = cubic((0, 1062), (500, 1010), (1100, 1072), (1920, 1024))
    hd.polygon([(0, 1062)] + top3 + [(1920, 1080), (0, 1080)], fill=(8, 42, 56, 255))
    img = Image.alpha_composite(img, hills.filter(ImageFilter.GaussianBlur(1.2)))

    deco = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    for _ in range(64):
        x = float(rng.uniform(40, w - 40))
        y = float(rng.uniform(30, 900))
        if 400 < x < 1520 and 120 < y < 900:
            continue
        r = float(rng.uniform(5, 30))
        a = int(rng.uniform(22, 58))
        dd.ellipse([x - r, y - r, x + r, y + r], outline=(214, 248, 255, a), width=2)
        dd.ellipse([x - r * 0.52, y - r * 0.52, x + r * 0.08, y + r * 0.08], fill=(255, 255, 255, max(8, a // 2)))
    img = Image.alpha_composite(img, deco.filter(ImageFilter.GaussianBlur(2.5)))

    bokeh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bokeh)
    for _ in range(26):
        x = float(rng.uniform(40, w - 40))
        y = float(rng.uniform(30, 860))
        if 400 < x < 1520 and 120 < y < 900:
            continue
        r = float(rng.uniform(16, 46))
        a = int(rng.uniform(10, 22))
        bd.ellipse([x - r, y - r, x + r, y + r], fill=(190, 240, 250, a))
    img = Image.alpha_composite(img, bokeh.filter(ImageFilter.GaussianBlur(6)))

    spark = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sw = ImageDraw.Draw(spark)
    for _ in range(44):
        x = float(rng.uniform(30, w - 30))
        y = float(rng.uniform(24, 880))
        if 400 < x < 1520 and 120 < y < 900:
            continue
        s = float(rng.uniform(4, 12))
        a = int(rng.uniform(90, 190))
        sw.polygon([(x, y - s), (x + s * 0.26, y - s * 0.26), (x + s, y), (x + s * 0.26, y + s * 0.26),
                    (x, y + s), (x - s * 0.26, y + s * 0.26), (x - s, y), (x - s * 0.26, y - s * 0.26)],
                   fill=(255, 240, 186, a))
    img = Image.alpha_composite(img, spark.filter(ImageFilter.GaussianBlur(1.0)))

    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - w / 2) / (w / 2)
    ny = (yy - h / 2) / (h / 2)
    d = np.sqrt(nx ** 2 * 0.85 + ny ** 2) / 1.45
    vig = (np.clip((d - 0.58) / 0.72, 0, 1) ** 2 * 96).astype(np.uint8)
    img = Image.composite(Image.new("RGBA", (w, h), (2, 12, 20, 255)), img, Image.fromarray(vig, "L"))
    path = os.path.join(ROOT, "bg-main.webp")
    img.convert("RGB").save(path, "WEBP", quality=82, method=6)
    print("%-24s %dx%d %d B" % ("bg-main.webp", w, h, os.path.getsize(path)))


def main():
    build_tiles()
    build_select()
    build_line_special(False)
    build_line_special(True)
    build_rainbow()
    build_ice()
    build_stone(False)
    build_stone(True)
    build_hole()
    build_fx()
    build_cell()
    build_frame()
    build_panel()
    build_background()


if __name__ == "__main__":
    main()
