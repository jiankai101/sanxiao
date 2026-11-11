#!/usr/bin/env python3
"""Procedural audio generator for web-match-game (spec.md 10.2).

Every sound is synthesised from oscillators/noise with numpy, so the whole
soundtrack is reproducible and licence-free (original work, CC0 waiver).
Outputs OGG Vorbis (primary) + MP3 (Safari fallback) for 14 names.

Run:  python assets/tools/generate_audio.py            # OGG + MP3
      python assets/tools/generate_audio.py --mp3-only  # re-encode MP3 only
Deps: numpy + ffmpeg (libvorbis, libmp3lame)
"""
from __future__ import annotations

import math
import os
import sys

_WS = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if os.path.isdir(os.path.join(_WS, "pylibs")):
    sys.path.insert(0, os.path.join(_WS, "pylibs"))

import shutil
import subprocess
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
BPM = 128
BEAT = SR * 60 // BPM          # 22500 samples
BAR = BEAT * 4                 # 90000 samples (1.875 s)
BGM_BARS = 32
BGM_N = BAR * BGM_BARS         # 2_880_000 = 60.0 s exactly

RNG = np.random.default_rng(20261110)


def t_axis(n):
    return np.arange(n, dtype=np.float64) / SR


def midi_hz(n):
    return 440.0 * 2.0 ** ((n - 69) / 12.0)


def hz(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6,
             "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    pitch, octave = name[:-1], int(name[-1])
    return midi_hz(12 * (octave + 1) + names[pitch])


def env(n, attack=0.004, release=None, curve=4.0):
    e = np.ones(n)
    a = max(1, int(attack * SR))
    e[:a] = np.linspace(0, 1, a) ** 0.7
    if release is None:
        release = n / SR
    r = max(1, int(release * SR))
    r = min(r, n)
    e[-r:] *= np.linspace(1, 0, r) ** (1.0 / max(curve, 0.1))
    return e


def exp_decay(n, tau):
    return np.exp(-t_axis(n) / tau)


def sine(freq, n, phase=0.0):
    t = t_axis(n)
    if np.isscalar(freq):
        return np.sin(2 * np.pi * freq * t + phase)
    phase_acc = np.cumsum(freq) / SR
    return np.sin(2 * np.pi * phase_acc + phase)


def pluck(f, dur, tau=0.18, bright=0.35, detune=0.0):
    n = int(dur * SR)
    t = t_axis(n)
    f0 = f * (1.0 + detune)
    sig = np.sin(2 * np.pi * f0 * t) * 1.0
    sig += bright * 0.5 * np.sin(2 * np.pi * 2 * f0 * t) * np.exp(-t / (tau * 0.6))
    sig += bright * 0.22 * np.sin(2 * np.pi * 3 * f0 * t) * np.exp(-t / (tau * 0.4))
    sig += bright * 0.12 * np.sin(2 * np.pi * 4.02 * f0 * t) * np.exp(-t / (tau * 0.25))
    return sig * exp_decay(n, tau) * env(n, 0.003, min(dur, 0.05))


def bell(f, dur, tau=0.25):
    n = int(dur * SR)
    t = t_axis(n)
    partials = [(1.0, 1.0, tau), (2.01, 0.5, tau * 0.6), (3.02, 0.28, tau * 0.45), (4.98, 0.14, tau * 0.3)]
    sig = np.zeros(n)
    for mul, amp, tp in partials:
        sig += amp * np.sin(2 * np.pi * f * mul * t) * np.exp(-t / tp)
    return sig * env(n, 0.002, 0.05)


def pad(freqs, dur, attack=0.25, release=0.4, detune=0.004):
    n = int(dur * SR)
    t = t_axis(n)
    sig = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0.0, detune):
            sig += 0.33 * np.sin(2 * np.pi * f * (1 + d) * t + RNG.uniform(0, 6.28))
    sig /= max(1, len(freqs))
    a = max(1, int(attack * SR))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a) ** 1.5
    r = max(1, int(release * SR))
    e[-r:] *= np.linspace(1, 0, r) ** 0.8
    trem = 0.94 + 0.06 * np.sin(2 * np.pi * 0.7 * t)
    return sig * e * trem


def noise(n):
    return RNG.uniform(-1, 1, n)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(x.size):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def resolve(x):
    peak = float(np.max(np.abs(x))) or 1.0
    return x / peak


def add_wrap(buf, start, sig):
    n = buf.size
    idx = (start + np.arange(sig.size)) % n
    np.add.at(buf, idx, sig)


def reverb_wrap(x, taps=((0.083, 0.32), (0.127, 0.24), (0.181, 0.17), (0.241, 0.12)), wet=0.28):
    y = x.copy()
    for delay, gain in taps:
        y += gain * wet * np.roll(x, int(delay * SR))
    return y

def sfx_click():
    n = int(0.08 * SR)
    t = t_axis(n)
    sig = 0.55 * highpass(noise(n), 2500) * np.exp(-t / 0.005)
    sig += 0.45 * np.sin(2 * np.pi * 1680 * t) * np.exp(-t / 0.009)
    sig += 0.30 * np.sin(2 * np.pi * 760 * t) * np.exp(-t / 0.014)
    return sig * env(n, 0.001, 0.006)


def sfx_swap():
    n = int(0.12 * SR)
    t = t_axis(n)
    f = 430 * (1.9 ** (t / 0.12))
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR)
    sig += 0.28 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    sig *= np.exp(-t / 0.05)
    return sig * env(n, 0.004, 0.03)


def sfx_invalid():
    n = int(0.15 * SR)
    t = t_axis(n)
    f = 205 - 45 * (t / 0.15)
    base = np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR))
    sig = lowpass(base, 900) * np.exp(-t / 0.07)
    sig += 0.25 * lowpass(noise(n), 500) * np.exp(-t / 0.03)
    return sig * env(n, 0.004, 0.02)


def sfx_match():
    n = int(0.25 * SR)
    sig = np.zeros(n)
    for i, f in enumerate([hz("C6"), hz("E6"), hz("G6")]):
        s = int(i * 0.055 * SR)
        seg = bell(f, 0.20, tau=0.09)[: n - s]
        sig[s:s + seg.size] += seg * (1.0 - 0.15 * i)
    return sig * env(n, 0.002, 0.02)


def sfx_cascade():
    n = int(0.30 * SR)
    sig = np.zeros(n)
    for i, f in enumerate([hz("E6"), hz("G6"), hz("B6"), hz("D7")]):
        s = int(i * 0.05 * SR)
        seg = bell(f, 0.18, tau=0.07)[: n - s]
        sig[s:s + seg.size] += seg * (0.85 + 0.08 * i)
    return sig * env(n, 0.002, 0.02)


def sfx_special_line():
    n = int(0.40 * SR)
    t = t_axis(n)
    whoosh = highpass(lowpass(noise(n), 6200), 900) * np.exp(-t / 0.11)
    f = 520 * (3.1 ** (t / 0.40))
    zing = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-((t - 0.10) ** 2) / 0.0016)
    sig = 0.55 * whoosh + 0.75 * zing
    return sig * env(n, 0.003, 0.05)


def sfx_special_rainbow():
    n = int(0.60 * SR)
    sig = 0.9 * pad([hz("C5"), hz("E5"), hz("G5"), hz("D6")], 0.60, attack=0.02, release=0.35)
    for i, f in enumerate([hz("G5"), hz("C6"), hz("E6"), hz("G6"), hz("C7")]):
        s = int((0.03 + i * 0.065) * SR)
        seg = bell(f, 0.22, tau=0.07)[: n - s]
        sig[s:s + seg.size] += 0.45 * seg
    shimmer = highpass(noise(n), 5000) * np.exp(-t_axis(n) / 0.18) * 0.12
    return (sig + shimmer) * env(n, 0.004, 0.06)


def sfx_ice_break():
    n = int(0.30 * SR)
    t = t_axis(n)
    sig = highpass(noise(n), 3800) * np.exp(-t / 0.035)
    for i, f in enumerate([2400, 3150, 4200]):
        s = int((0.015 + i * 0.055) * SR)
        seg = bell(f, 0.12, tau=0.05)[: n - s]
        sig[s:s + seg.size] += 0.5 * seg
    return sig * env(n, 0.001, 0.03)


def sfx_stone_break():
    n = int(0.35 * SR)
    t = t_axis(n)
    thud = np.sin(2 * np.pi * np.cumsum(95 - 40 * t / 0.35) / SR) * np.exp(-t / 0.11)
    crunch = lowpass(noise(n), 1400) * np.exp(-t / 0.055)
    ticks = np.zeros(n)
    for s in (0.03, 0.09, 0.15, 0.22):
        i = int(s * SR)
        seg = highpass(noise(600), 2500) * np.exp(-np.arange(600) / 180.0) * 0.35
        ticks[i:i + 600] += seg[: max(0, n - i)]
    sig = 0.9 * thud + 0.55 * crunch + ticks
    return sig * env(n, 0.002, 0.04)


def sfx_shuffle():
    n = int(0.50 * SR)
    sig = np.zeros(n)
    for i, f in enumerate([660, 880, 740, 990, 830]):
        s = int((0.02 + i * 0.075) * SR)
        seg = pluck(f, 0.18, tau=0.06, bright=0.4)[: n - s]
        sig[s:s + seg.size] += 0.7 * seg
    swoosh = lowpass(highpass(noise(n), 600), 4200) * np.exp(-t_axis(n) / 0.14) * 0.25
    return (sig + swoosh) * env(n, 0.003, 0.04)


def sfx_star():
    n = int(0.50 * SR)
    sig = bell(hz("C6"), 0.50, tau=0.22) * 0.9
    s = int(0.10 * SR)
    seg = bell(hz("E6"), 0.40, tau=0.16)[: n - s]
    sig[s:s + seg.size] += 0.55 * seg
    s2 = int(0.18 * SR)
    seg2 = bell(hz("G6"), 0.32, tau=0.12)[: n - s2]
    sig[s2:s2 + seg2.size] += 0.3 * seg2
    return sig * env(n, 0.002, 0.05)


def sfx_win():
    n = int(1.50 * SR)
    sig = np.zeros(n)
    for i, name in enumerate(["C5", "E5", "G5", "C6"]):
        s = int(i * 0.12 * SR)
        seg = pluck(hz(name), 0.30, tau=0.14, bright=0.55)[: n - s]
        sig[s:s + seg.size] += 0.8 * seg
    chord_start = int(0.36 * SR)
    chord = pad([hz("C5"), hz("E5"), hz("G5"), hz("C6")], 1.05, attack=0.02, release=0.55)
    sig[chord_start:chord_start + chord.size] += 0.55 * chord[: n - chord_start]
    s = int(0.36 * SR)
    shine = highpass(noise(n), 4200) * np.exp(-t_axis(n) / 0.09) * 0.18
    sig[s:] += shine[s:]
    return sig * env(n, 0.004, 0.12)


def sfx_lose():
    n = int(1.20 * SR)
    sig = np.zeros(n)
    for i, name in enumerate(["A4", "F4", "D4"]):
        s = int(i * 0.28 * SR)
        seg = pad([hz(name), hz(name) * 1.005], 0.55, attack=0.02, release=0.30)[: n - s]
        sig[s:s + seg.size] += 0.75 * seg
    low = np.sin(2 * np.pi * np.cumsum(np.linspace(110, 70, n)) / SR) * np.exp(-t_axis(n) / 0.35) * 0.35
    return (sig + low) * env(n, 0.01, 0.2)


def build_bgm():
    buf = np.zeros(BGM_N)
    prog = [("C", ["C4", "E4", "G4"], "C2"),
            ("G", ["G3", "B3", "D4"], "G2"),
            ("Am", ["A3", "C4", "E4"], "A2"),
            ("F", ["F3", "A3", "C4"], "F2")]
    for bar in range(BGM_BARS):
        root, chord, bass = prog[bar % 4]
        start = bar * BAR
        ch = pad([hz(x) for x in chord], 2.55, attack=0.18, release=0.62)
        add_wrap(buf, (start - int(0.35 * SR)) % BGM_N, 0.18 * ch)
        add_wrap(buf, start, 0.17 * pluck(hz(bass), 0.85, tau=0.30, bright=0.25))
        add_wrap(buf, start + 2 * BEAT + BEAT // 2, 0.13 * pluck(hz(bass) * 1.5, 0.5, tau=0.18, bright=0.2))
        tones = [hz(x) for x in chord]
        pattern = [0, 1, 2, 1, 0, 2, 1, 2]
        for i, p in enumerate(pattern):
            f = tones[p] * (4.0 if (i % 8 in (3, 6)) else 2.0)
            add_wrap(buf, start + i * (BEAT // 2), 0.34 * pluck(f, 0.42, tau=0.18, bright=0.42))
        for i in range(8):
            s = start + i * (BEAT // 2) + BEAT // 4
            sh = highpass(noise(700), 6200) * np.exp(-np.arange(700) / 95.0)
            add_wrap(buf, s, 0.022 * sh)
        if bar % 8 == 0:
            add_wrap(buf, start, 0.12 * bell(hz(chord[0]) * 2, 1.2, tau=0.45))
    buf = reverb_wrap(buf, wet=0.30)
    spec = np.fft.rfft(buf)
    freqs = np.fft.rfftfreq(buf.size, 1.0 / SR)
    spec *= 1.0 / (1.0 + (freqs / 11000.0) ** 4)
    buf = np.fft.irfft(spec, n=buf.size)
    buf = np.tanh(buf * 1.15)
    return resolve(buf) * 0.82

SFX = [
    ("sfx-swap", 0.12, sfx_swap),
    ("sfx-invalid", 0.15, sfx_invalid),
    ("sfx-match", 0.25, sfx_match),
    ("sfx-cascade", 0.30, sfx_cascade),
    ("sfx-special-line", 0.40, sfx_special_line),
    ("sfx-special-rainbow", 0.60, sfx_special_rainbow),
    ("sfx-ice-break", 0.30, sfx_ice_break),
    ("sfx-stone-break", 0.35, sfx_stone_break),
    ("sfx-shuffle", 0.50, sfx_shuffle),
    ("sfx-star", 0.50, sfx_star),
    ("sfx-win", 1.50, sfx_win),
    ("sfx-lose", 1.20, sfx_lose),
    ("sfx-click", 0.08, sfx_click),
]


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
    if found:
        return found
    raise RuntimeError("ffmpeg not found: set FFMPEG_PATH or install ffmpeg")


FFMPEG = find_ffmpeg()


def write_wav(x, path):
    pcm = np.clip(x, -1.0, 1.0) * 32767.0
    # TPDF dither keeps quiet tails clean at 16 bit
    pcm = np.round(pcm + RNG.uniform(-0.5, 0.5, pcm.size) + RNG.uniform(-0.5, 0.5, pcm.size))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.clip(pcm, -32768, 32767).astype("<i2").tobytes())


def encode(wav, out, args):
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", wav,
           "-ac", "1", "-ar", str(SR), "-map_metadata", "-1",
           "-fflags", "+bitexact", "-flags:a", "+bitexact"] + args + [out]
    subprocess.run(cmd, check=True)


MP3_SPF = 1152          # MPEG-1 Layer III samples per frame @ 48 kHz (= 24 ms)
MP3_DELAY = 576         # encoder delay; gapless decoders trim it via the LAME tag


def mp3_frames_for(n):
    """Xing/Info *declared* frame count that decodes to about n samples.

    LAME prepends an Info/Xing metadata frame that gapless decoders discard,
    so the decodable payload is (declared_frames - 1) frames.  Round n to the
    nearest whole *decodable* payload frame, then add that Info frame back.
    This makes decoded duration == nearest_frame(n), i.e. <= half a frame off.
    """
    return int(math.floor(n / float(MP3_SPF) + 0.5)) + 1


def mp3_payload(x, frames, loop=False):
    """PCM that encodes to exactly `frames` MP3 frames (Xing count == frames).

    LAME emits one flush/padding frame beyond the audio, so a stream with
    `frames` declared frames carries at most (frames-1)*1152 samples of audio.
    Short loops are resampled (time/pitch change < 0.05 %) so the loop seam
    stays continuous; one-shots are trimmed with a 12 ms fade-out.
    """
    need = (frames - 1) * MP3_SPF            # LAME appends one flush frame
    if need == x.size:
        return x
    if need > x.size:
        return np.pad(x, (0, need - x.size))
    if loop:
        idx = np.arange(x.size)
        return np.interp(np.linspace(0.0, x.size - 1.0, need), idx, x)
    y = x[:need].copy()
    fade = min(int(0.012 * SR), y.size)
    if fade > 1:
        y[-fade:] *= np.linspace(1.0, 0.0, fade) ** 1.2
    return y


def mp3_declared_frames(path):
    """Return the Xing/Info 'frames' field (what players use for duration)."""
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
                        return int.from_bytes(data[xoff + 8:xoff + 12], "big")
                break
        off += 1
    return None


def decode_pcm(path, n):
    """Decode an existing OGG to `n` mono 48 kHz samples (authoritative render)."""
    raw = subprocess.run([FFMPEG, "-v", "quiet", "-i", path, "-f", "f32le",
                          "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
    x = np.frombuffer(raw, dtype="<f4").astype(np.float64)
    if x.size < n:
        return np.pad(x, (0, n - x.size))
    return x[:n]


def write_formats(x, stem, ogg_kbps=96, mp3_kbps=128, formats=("ogg", "mp3"), loop=False):
    wav = os.path.join(ROOT, "." + stem + ".src.wav")
    ogg = os.path.join(ROOT, stem + ".ogg")
    mp3 = os.path.join(ROOT, stem + ".mp3")
    ok = mk = 0.0
    dur = x.size / SR
    if "ogg" in formats:
        write_wav(x, wav)
        encode(wav, ogg, ["-c:a", "libvorbis", "-b:a", "%dk" % ogg_kbps,
                          "-minrate", "%dk" % ogg_kbps, "-maxrate", "%dk" % ogg_kbps, "-bufsize", "192k"])
        os.remove(wav)
        ok = os.path.getsize(ogg) * 8.0 / dur / 1000.0
    if "mp3" in formats:
        frames = mp3_frames_for(x.size)
        payload = mp3_payload(x, frames, loop=loop)
        write_wav(payload, wav)
        encode(wav, mp3, ["-c:a", "libmp3lame", "-b:a", "%dk" % mp3_kbps])
        os.remove(wav)
        got = mp3_declared_frames(mp3)
        assert got == frames, "%s: encoded %r frames, wanted %d" % (stem, got, frames)
        mk = os.path.getsize(mp3) * 8.0 / dur / 1000.0
        dec = payload.size / float(SR)       # gapless decoders return the payload
        print("  %-18s mp3 decl %3d frames, decoded %.3f s (spec %.2f s, %+d ms)"
              % (stem, frames, dec, dur, int(round((dec - dur) * 1000))))
    return ok, mk


def finish(x):
    peak = float(np.max(np.abs(x))) or 1.0
    return np.tanh(x / peak * 1.05) * 0.88


def report(name, n, ogg_kbps, mp3_kbps, ogg_b, mp3_b):
    print("%-22s %5.2fs  ogg %5.1fkbps %6.1fKB  mp3 %5.1fkbps %6.1fKB"
          % (name, n / SR, ogg_kbps, ogg_b / 1024.0, mp3_kbps, mp3_b / 1024.0))


def main():
    total = 0
    only_mp3 = "--mp3-only" in sys.argv[1:]
    formats = ("mp3",) if only_mp3 else ("ogg", "mp3")
    if only_mp3:
        # Re-encode the MP3 fallbacks from the shipped OGG renders so both
        # formats stay sample-consistent (no re-synthesis drift).
        jobs = [("bgm-main", BGM_N, True)] + [(name, int(round(dur * SR)), False)
                                              for name, dur, _ in SFX]
        for stem, n, loop in jobs:
            ogg = os.path.join(ROOT, stem + ".ogg")
            x = decode_pcm(ogg, n)
            ok, mk = write_formats(x, stem, formats=formats, loop=loop)
            mp3 = os.path.join(ROOT, stem + ".mp3")
            ok = os.path.getsize(ogg) * 8.0 / (n / SR) / 1000.0
            report(stem, n, ok, mk, os.path.getsize(ogg), os.path.getsize(mp3))
            total += os.path.getsize(ogg) + os.path.getsize(mp3)
        print("TOTAL AUDIO: %.1f KB (%.2f MB)" % (total / 1024.0, total / 1048576.0))
        return

    bgm = build_bgm()
    assert bgm.size == BGM_N, bgm.size
    ok, mk = write_formats(bgm, "bgm-main", formats=formats, loop=True)
    ogg = os.path.join(ROOT, "bgm-main.ogg")
    mp3 = os.path.join(ROOT, "bgm-main.mp3")
    report("bgm-main", BGM_N, ok, mk, os.path.getsize(ogg), os.path.getsize(mp3))
    total += os.path.getsize(ogg) + os.path.getsize(mp3)

    for name, dur, fn in SFX:
        x = fn()
        n = int(round(dur * SR))
        if x.size != n:
            x = np.resize(x, n) if x.size > n else np.pad(x, (0, n - x.size))
        x = finish(x)
        ok, mk = write_formats(x, name, formats=formats)
        ogg = os.path.join(ROOT, name + ".ogg")
        mp3 = os.path.join(ROOT, name + ".mp3")
        report(name, n, ok, mk, os.path.getsize(ogg), os.path.getsize(mp3))
        total += os.path.getsize(ogg) + os.path.getsize(mp3)
    print("TOTAL AUDIO: %.1f KB (%.2f MB)" % (total / 1024.0, total / 1048576.0))


if __name__ == "__main__":
    main()
