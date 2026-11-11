#!/usr/bin/env python3
"""Asset acceptance checker for web-match-game (TASK-041 style checks).

Verifies the 33 image + 28 audio files against spec.md 10.1 / 10.2 and the
plan.md budgets, prints a report and exits non-zero on any failure.

Run:  python assets/tools/verify_assets.py
Deps: numpy, pillow, ffmpeg (FFMPEG_PATH or ../pylibs/imageio_ffmpeg/binaries)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WS = os.path.dirname(ROOT)

IMAGES = {
    "bg-main.webp": (1920, 1080, "webp"),
    "board-frame.webp": (560, 560, "webp"),
    "cell-empty.webp": (64, 64, "webp"),
    "tile-star.webp": (64, 64, "webp"),
    "tile-water.webp": (64, 64, "webp"),
    "tile-leaf.webp": (64, 64, "webp"),
    "tile-flame.webp": (64, 64, "webp"),
    "tile-crystal.webp": (64, 64, "webp"),
    "tile-bolt.webp": (64, 64, "webp"),
    "tile-select.webp": (64, 64, "webp"),
    "special-line-h.webp": (64, 64, "webp"),
    "special-line-v.webp": (64, 64, "webp"),
    "special-rainbow.webp": (64, 64, "webp"),
    "obs-ice.webp": (64, 64, "webp"),
    "obs-stone-2.webp": (64, 64, "webp"),
    "obs-stone-1.webp": (64, 64, "webp"),
    "obs-hole.webp": (64, 64, "webp"),
    "fx-clear.webp": (128, 128, "webp"),
    "ui-panel.webp": (720, 520, "webp"),
    "icon-star-on.svg": (48, 48, "svg"),
    "icon-star-off.svg": (48, 48, "svg"),
    "icon-play.svg": (32, 32, "svg"),
    "icon-pause.svg": (32, 32, "svg"),
    "icon-restart.svg": (32, 32, "svg"),
    "icon-back.svg": (32, 32, "svg"),
    "icon-lock.svg": (32, 32, "svg"),
    "icon-sound-on.svg": (32, 32, "svg"),
    "icon-sound-off.svg": (32, 32, "svg"),
    "icon-music-on.svg": (32, 32, "svg"),
    "icon-music-off.svg": (32, 32, "svg"),
    "icon-settings.svg": (32, 32, "svg"),
    "icon-trophy.svg": (32, 32, "svg"),
    "icon-close.svg": (32, 32, "svg"),
}

AUDIO = {
    "bgm-main": 60.00,
    "sfx-swap": 0.12,
    "sfx-invalid": 0.15,
    "sfx-match": 0.25,
    "sfx-cascade": 0.30,
    "sfx-special-line": 0.40,
    "sfx-special-rainbow": 0.60,
    "sfx-ice-break": 0.30,
    "sfx-stone-break": 0.35,
    "sfx-shuffle": 0.50,
    "sfx-star": 0.50,
    "sfx-win": 1.50,
    "sfx-lose": 1.20,
    "sfx-click": 0.08,
}

TILE_HEX = {"tile-star.webp": "F2C230", "tile-water.webp": "3AA0E8", "tile-leaf.webp": "57C24A",
            "tile-flame.webp": "E8503A", "tile-crystal.webp": "9B59D0", "tile-bolt.webp": "23C4C4"}

MP3_SPF = 1152                 # MPEG-1 Layer III @ 48 kHz -> 24.0 ms per frame
MP3_FRAME_SEC = MP3_SPF / 48000.0   # one frame = 0.024 s
MP3_FRAME_ERR = MP3_FRAME_SEC  # decoded duration must be within one frame

MP3_BITRATES = {
    (1, 1): [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    (1, 2): [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    (1, 3): [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    (2, 1): [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    (2, 2): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    (2, 3): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}
MP3_RATES = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}

BUDGET_IMAGES = 1.6 * 1024 * 1024
BUDGET_FIRST_SCREEN = 1.2 * 1024 * 1024
BUDGET_AUDIO = 2.0 * 1024 * 1024
BUDGET_BG = 400 * 1024

FAILS = []


def fail(msg):
    FAILS.append(msg)
    print("  FAIL " + msg)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def find_ffmpeg():
    env = os.environ.get("FFMPEG_PATH")
    if env and os.path.isfile(env):
        return env
    local = os.path.join(_WS, "pylibs", "imageio_ffmpeg", "binaries")
    if os.path.isdir(local):
        for name in sorted(os.listdir(local)):
            if name.lower().startswith("ffmpeg") and name.lower().endswith(".exe"):
                return os.path.join(local, name)
    found = shutil.which("ffmpeg")
    if not found:
        raise RuntimeError("ffmpeg not found")
    return found


def mp3_info(path):
    """(channels, sample rate, declared frames, declared duration) from Xing/Info.

    The Info/Xing header counts its own metadata frame, so the decodable audio
    is only (frames - 1) * 1152 samples.  This declared value is kept for
    reference/printout only; acceptance uses the real decoder output.
    """
    data = open(path, "rb").read()
    off = 0
    if data[:3] == b"ID3":
        size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
        off = 10 + size
    while off < len(data) - 4:
        if data[off] == 0xFF and (data[off + 1] & 0xE0) == 0xE0:
            b1, b2, b3 = data[off + 1], data[off + 2], data[off + 3]
            ver = (b1 >> 3) & 3
            layer = (b1 >> 1) & 3
            br = (b2 >> 4) & 0xF
            sri = (b2 >> 2) & 3
            if ver != 1 and layer != 0 and br not in (0, 15) and sri != 3:
                mode = (b3 >> 6) & 3
                side = 32 if ver == 3 else 17
                if mode == 3:
                    side = 17 if ver == 3 else 9
                xoff = off + 4 + side
                if data[xoff:xoff + 4] in (b"Xing", b"Info"):
                    flags = int.from_bytes(data[xoff + 4:xoff + 8], "big")
                    if flags & 1:
                        frames = int.from_bytes(data[xoff + 8:xoff + 12], "big")
                        rate = MP3_RATES[ver][sri]
                        return (1 if mode == 3 else 2, rate, frames,
                                frames * MP3_SPF / float(rate))
                break
        off += 1
    return (None, None, None, None)


def image_kind(path):
    with open(path, "rb") as f:
        head = f.read(16)
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if b"<svg" in head or head.lstrip().startswith(b"<svg"):
        return "svg"
    if head.startswith(b"\x89PNG"):
        return "png"
    return "?"


def gray_vector(img):
    a = np.asarray(img.convert("RGBA"), dtype=np.float64)
    alpha = a[:, :, 3] / 255.0
    lum = (0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]) * alpha
    hist, _ = np.histogram(lum, bins=32, range=(0, 255))
    hist = hist / max(1, hist.sum())
    return hist


def main():
    print("== images ==")
    img_bytes = 0
    first_screen = 0
    hashes = {}
    for name, (w, h, kind) in IMAGES.items():
        path = os.path.join(ROOT, name)
        if not os.path.isfile(path):
            fail("missing image " + name)
            continue
        size = os.path.getsize(path)
        img_bytes += size
        hashes[name] = sha256(path)
        k = image_kind(path)
        if k != kind:
            fail("%s format %s != %s" % (name, k, kind))
        if kind == "svg":
            txt = open(path, encoding="utf-8").read()
            m = re.search(r'viewBox="0 0 (\d+) (\d+)"', txt)
            if not m or (int(m.group(1)), int(m.group(2))) != (w, h):
                fail("%s viewBox mismatch" % name)
            if "http://" in txt.replace('xmlns="http://www.w3.org/2000/svg"', ""):
                fail("%s has external reference" % name)
            if "currentColor" not in txt:
                fail("%s does not inherit currentColor" % name)
            continue
        with Image.open(path) as im:
            if im.size != (w, h):
                fail("%s size %dx%d != %dx%d" % (name, im.size[0], im.size[1], w, h))
            if name.startswith("tile-") or name.startswith("special-") or name.startswith("obs-") \
                    or name.startswith("fx-") or name == "cell-empty.webp":
                a = np.asarray(im.convert("RGBA"))[:, :, 3]
                if a.min() != 0:
                    fail("%s has no transparent pixels" % name)
                if a.max() == 0:
                    fail("%s is fully transparent" % name)
            if name in TILE_HEX:
                want = np.array([int(TILE_HEX[name][i:i + 2], 16) for i in (0, 2, 4)])
                a = np.asarray(im.convert("RGBA")).reshape(-1, 4)
                solid = a[a[:, 3] > 240][:, :3]
                if solid.size == 0:
                    fail("%s has no opaque pixels" % name)
                else:
                    med = np.median(solid, axis=0)
                    dist = float(np.max(np.abs(med - want)))
                    if dist > 12:
                        fail("%s main colour %s distance %.1f > 12" % (name, med.astype(int).tolist(), dist))
        if name != "bg-main.webp":
            first_screen += size

    print("  images: %d files, %.1f KB (budget %.1f KB)" % (len(IMAGES), img_bytes / 1024, BUDGET_IMAGES / 1024))
    print("  first-screen (excl. bg): %.1f KB (budget %.1f KB)" % (first_screen / 1024, BUDGET_FIRST_SCREEN / 1024))
    if img_bytes > BUDGET_IMAGES:
        fail("image total over budget")
    if first_screen > BUDGET_FIRST_SCREEN:
        fail("first screen images over budget")
    bg = os.path.join(ROOT, "bg-main.webp")
    if os.path.getsize(bg) > BUDGET_BG:
        fail("bg-main over 400 KB")

    print("== grayscale distinctness (32-bin luminance histogram L1) ==")
    tiles = {n: gray_vector(Image.open(os.path.join(ROOT, n))) for n in TILE_HEX}
    names = list(tiles)
    worst = (9.9, "", "")
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            d = float(np.abs(tiles[names[i]] - tiles[names[j]]).sum())
            if d < worst[0]:
                worst = (d, names[i], names[j])
    print("  min pairwise L1 distance: %.3f (%s vs %s)" % worst)
    if worst[0] < 0.20:
        fail("two tiles are too similar in grayscale")
    print("  -> requires 3-person visual review; automated proxy only")

    print("== audio ==")
    ff = find_ffmpeg()
    audio_bytes = 0
    stats = {}
    for stem, dur in AUDIO.items():
        for ext in ("ogg", "mp3"):
            name = "%s.%s" % (stem, ext)
            path = os.path.join(ROOT, name)
            if not os.path.isfile(path):
                fail("missing audio " + name)
                continue
            audio_bytes += os.path.getsize(path)
            hashes[name] = sha256(path)
            # Decode once; the decoded sample count is the authoritative
            # duration (matches Chrome decodeAudioData / libsndfile gapless).
            raw = subprocess.run([ff, "-v", "quiet", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"],
                                 capture_output=True).stdout
            x = np.frombuffer(raw, dtype="<f4").astype(np.float64)
            decoded = x.size / 48000.0
            if ext == "mp3":
                ch, rate, frames, declared = mp3_info(path)
                if declared is None:
                    fail("no MP3 frame header for " + name)
                    continue
                err = decoded - dur
                print("  %-22s decoded %6.3fs  spec %.2f  [Xing %3d frames = %.3fs]  %+d ms"
                      % (name, decoded, dur, frames, declared, int(round(err * 1000))))
                if ch != 1:
                    fail("%s channels %s != mono" % (name, ch))
                if rate != 48000:
                    fail("%s sample rate %s != 48000" % (name, rate))
                if abs(err) > MP3_FRAME_ERR:
                    fail("%s decoded duration %.3fs != %.2fs (err %+d ms > 1 frame)"
                         % (name, decoded, dur, int(round(err * 1000))))
            else:
                m = re.search(r"Duration: (\d\d):(\d\d):(\d\d\.\d\d)",
                              subprocess.run([ff, "-hide_banner", "-i", path], capture_output=True,
                                             text=True, errors="ignore").stderr)
                if not m:
                    fail("no duration for " + name)
                    continue
                d = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
                if abs(d - dur) > 0.02:
                    fail("%s duration %.2fs != %.2fs" % (name, d, dur))
            peak = float(np.max(np.abs(x))) if x.size else 0.0
            rms = float(np.sqrt(np.mean(x ** 2))) if x.size else 0.0
            stats[name] = (peak, rms, x)
            if peak > 0.999:
                fail("%s clips (peak %.3f)" % (name, peak))
            if rms < 0.005:
                fail("%s is near-silent (rms %.4f)" % (name, rms))

    print("  audio: %d files, %.1f KB (budget %.1f KB)" % (len(AUDIO) * 2, audio_bytes / 1024, BUDGET_AUDIO / 1024))
    if audio_bytes > BUDGET_AUDIO:
        fail("audio total over budget")

    for ext in ("ogg", "mp3"):
        x = stats["bgm-main." + ext][2]
        seam = abs(float(x[-1]) - float(x[0]))
        head = float(np.sqrt(np.mean(x[:480] ** 2)))
        tail = float(np.sqrt(np.mean(x[-480:] ** 2)))
        print("  bgm-main.%s loop seam: |x[-1]-x[0]|=%.5f, rms tail/head %.3f/%.3f" % (ext, seam, tail, head))
        if seam > 0.05:
            fail("bgm seam discontinuity %.3f" % seam)

    print("== summary ==")
    print("  images %d, audio %d, total %.2f MB" % (len(IMAGES), len(AUDIO) * 2, (img_bytes + audio_bytes) / 1048576))
    out = os.path.join(ROOT, "checksums.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(hashes, f, indent=2, sort_keys=True)
    print("  sha256 table -> assets/checksums.json")
    if FAILS:
        print("RESULT: FAIL (%d)" % len(FAILS))
        sys.exit(1)
    print("RESULT: PASS")


if __name__ == "__main__":
    main()
