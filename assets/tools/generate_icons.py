#!/usr/bin/env python3
"""Generates the 14 single-colour SVG icons (spec.md 10.1).

Every icon uses currentColor so the UI can tint it via CSS, contains no
external references and renders crisply at 32x32 (stars are 48x48).

Run:  python assets/tools/generate_icons.py
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEAD = ('<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 {s} {s}" '
        'fill="none" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" '
        'stroke-linejoin="round" role="img" aria-hidden="true">\n')
END = '</svg>\n'

ICONS = {}


def add(name, body, size=32, sw=2.2, fill=False):
    ICONS[name] = (body, size, sw, fill)


def star_path(cx, cy, R, r, n=5, rot=-90.0):
    pts = []
    for i in range(2 * n):
        ang = math.radians(rot + i * 180.0 / n)
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return "M" + " L".join("%.2f %.2f" % p for p in pts) + " Z"


def gear(cx=16.0, cy=16.0, teeth=8, r_out=13.2, r_in=10.3, hole=4.0):
    parts = []
    step = 360.0 / teeth
    for i in range(teeth):
        base = i * step - 90.0
        for ang, rad in ((base - 15, r_in), (base - 9, r_out), (base + 9, r_out), (base + 15, r_in)):
            a = math.radians(ang)
            parts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    d = "M" + " L".join("%.2f %.2f" % p for p in parts) + " Z"
    # inner hole as a reversed circle subpath
    hx_, hy_ = cx + hole, cy
    d += (" M%.2f %.2f A%.2f %.2f 0 1 0 %.2f %.2f A%.2f %.2f 0 1 0 %.2f %.2f Z"
          % (hx_, hy_, hole, hole, cx - hole, cy, hole, hole, hx_, hy_))
    return d


add("icon-star-on", '<path d="%s" fill="currentColor" stroke="none"/>' % star_path(24, 25.5, 21, 8.6), 48, 0, True)
add("icon-star-off", '<path d="%s" fill="none"/>' % star_path(24, 25.5, 20, 8.2), 48, 2.4)
add("icon-play", '<path d="M12.5 8.6 L24.2 16 L12.5 23.4 Z" fill="currentColor" stroke="none"/>', 32, 0, True)
add("icon-pause", '<rect x="10" y="8.5" width="4.4" height="15" rx="1.6" fill="currentColor" stroke="none"/>'
                  '<rect x="17.6" y="8.5" width="4.4" height="15" rx="1.6" fill="currentColor" stroke="none"/>', 32, 0, True)
add("icon-restart", '<path d="M25.2 16a9.2 9.2 0 1 1-3.05-6.86"/>'
                    '<path d="M24.4 4.8v5.4h-5.4"/>', 32)
add("icon-back", '<path d="M19.5 7.5 L11 16 L19.5 24.5"/><path d="M11.6 16 H26"/>', 32)
add("icon-lock", '<rect x="8.6" y="14.2" width="14.8" height="11.2" rx="3.2" fill="currentColor" stroke="none"/>'
                 '<path d="M11.6 14.2v-3.4a4.4 4.4 0 0 1 8.8 0v3.4"/>', 32)
add("icon-sound-on", '<path d="M8 13.2h3.6L17 8.4v15.2l-5.4-4.8H8z" fill="currentColor" stroke="none"/>'
                     '<path d="M20.4 11.6a6.2 6.2 0 0 1 0 8.8"/><path d="M23 8.8a10 10 0 0 1 0 14.4"/>', 32)
add("icon-sound-off", '<path d="M8 13.2h3.6L17 8.4v15.2l-5.4-4.8H8z" fill="currentColor" stroke="none"/>'
                      '<path d="M20.6 12.6 L26.4 19.4"/><path d="M26.4 12.6 L20.6 19.4"/>', 32)
add("icon-music-on", '<path d="M13.4 10.2 25 8v9.4" /><path d="M25 8 V20.2"/>'
                     '<ellipse cx="11" cy="21.6" rx="3.4" ry="3" fill="currentColor" stroke="none"/>'
                     '<ellipse cx="22.6" cy="22.6" rx="3.4" ry="3" fill="currentColor" stroke="none"/>'
                     '<path d="M13.4 10.2v11.4" stroke-width="1.6" stroke="none"/>', 32)
add("icon-music-off", '<path d="M13.4 10.2 25 8v9.4" /><path d="M25 8 V20.2"/>'
                      '<ellipse cx="11" cy="21.6" rx="3.4" ry="3" fill="currentColor" stroke="none"/>'
                      '<ellipse cx="22.6" cy="22.6" rx="3.4" ry="3" fill="currentColor" stroke="none"/>'
                      '<path d="M6.4 6.4 L27.6 27.6"/>', 32)
add("icon-settings", '<path d="%s" fill="currentColor" fill-rule="evenodd" stroke="none"/>' % gear(), 32, 0, True)
add("icon-trophy", '<path d="M10.4 6.4h11.2v5.2a5.6 5.6 0 0 1-11.2 0z"/>'
                   '<path d="M10.4 8.2H7.6v1.6a3.4 3.4 0 0 0 3.2 3.4"/>'
                   '<path d="M21.6 8.2h2.8v1.6a3.4 3.4 0 0 1-3.2 3.4"/>'
                   '<path d="M16 17v4.4"/><path d="M11.6 25.2h8.8l-1.2-3.8h-6.4z"/>', 32)
add("icon-close", '<path d="M9.4 9.4 L22.6 22.6"/><path d="M22.6 9.4 L9.4 22.6"/>', 32)


def main():
    for name, (body, size, sw, fill) in ICONS.items():
        head = HEAD.format(s=size, sw=sw)
        if fill:
            head = head.replace('fill="none" stroke="currentColor"', 'fill="none" stroke="none"', 1)
        path = os.path.join(ROOT, name + ".svg")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(head + "  " + body + "\n" + END)
        print("%-22s %d B" % (name + ".svg", os.path.getsize(path)))


if __name__ == "__main__":
    main()
