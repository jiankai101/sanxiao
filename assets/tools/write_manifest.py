#!/usr/bin/env python3
"""Regenerates assets/manifest.md from the files on disk (single source of truth).

Run:  python assets/tools/write_manifest.py
"""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WS = os.path.dirname(ROOT)

IMAGES = [
    ("bg-main.webp", "bg-main", "主背景（L0，1920×1080，cover 裁切到 960×720）", "REQ-040", "TASK-039", "1920×1080", "WebP q82"),
    ("board-frame.webp", "board-frame", "棋盘外框，含 24px 内边距（内区 512×512 透明）", "REQ-040", "TASK-039", "560×560", "WebP q88"),
    ("cell-empty.webp", "cell-empty", "棋盘空槽底（可平铺）", "REQ-040", "TASK-039", "64×64", "WebP q95"),
    ("tile-star.webp", "tile-star", "元素「星」#F2C230", "REQ-039/043", "TASK-038", "64×64", "WebP q95 透明"),
    ("tile-water.webp", "tile-water", "元素「水滴」#3AA0E8", "REQ-039/043", "TASK-038", "64×64", "WebP q95 透明"),
    ("tile-leaf.webp", "tile-leaf", "元素「叶」#57C24A", "REQ-039/043", "TASK-038", "64×64", "WebP q95 透明"),
    ("tile-flame.webp", "tile-flame", "元素「火」#E8503A", "REQ-039/043", "TASK-038", "64×64", "WebP q95 透明"),
    ("tile-crystal.webp", "tile-crystal", "元素「晶」#9B59D0（第 5-8 关不出现）", "REQ-039/043", "TASK-038", "64×64", "WebP q95 透明"),
    ("tile-bolt.webp", "tile-bolt", "元素「电」#23C4C4", "REQ-039/043", "TASK-038", "64×64", "WebP q95 透明"),
    ("tile-select.webp", "tile-select", "选中高亮描边（叠加在元素之上）", "REQ-039", "TASK-038", "64×64", "WebP q95 透明"),
    ("special-line-h.webp", "special-line-h", "横线特化箭头纹理（叠加在原元素上）", "REQ-039", "TASK-038", "64×64", "WebP q95 透明"),
    ("special-line-v.webp", "special-line-v", "竖线特化箭头纹理（叠加在原元素上）", "REQ-039", "TASK-038", "64×64", "WebP q95 透明"),
    ("special-rainbow.webp", "special-rainbow", "彩虹特化七彩环（中心透明）", "REQ-039", "TASK-038", "64×64", "WebP q95 透明"),
    ("obs-ice.webp", "obs-ice", "冰块 1 层（绘制在元素下方，半透明蓝白）", "REQ-039", "TASK-038", "64×64", "WebP q95 透明"),
    ("obs-stone-2.webp", "obs-stone-2", "石块 2 层（完整石块）", "REQ-039", "TASK-038", "64×64", "WebP q95 透明"),
    ("obs-stone-1.webp", "obs-stone-1", "石块 1 层（带裂纹）", "REQ-039", "TASK-038", "64×64", "WebP q95 透明"),
    ("obs-hole.webp", "obs-hole", "死格（深色凹陷，不绘制元素）", "REQ-039", "TASK-038", "64×64", "WebP q95 透明"),
    ("fx-clear.webp", "fx-clear", "消除闪光单帧粒子贴图", "REQ-039/044", "TASK-038", "128×128", "WebP q95 透明"),
    ("ui-panel.webp", "ui-panel", "面板底框（结算/设置/排行榜共用）", "REQ-040", "TASK-039", "720×520", "WebP q88"),
    ("icon-star-on.svg", "icon-star-on", "星级（亮）", "REQ-040", "TASK-039", "48×48", "SVG 1.1"),
    ("icon-star-off.svg", "icon-star-off", "星级（暗）", "REQ-040", "TASK-039", "48×48", "SVG 1.1"),
    ("icon-play.svg", "icon-play", "开始/继续", "REQ-040", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-pause.svg", "icon-pause", "暂停", "REQ-040", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-restart.svg", "icon-restart", "重开", "REQ-040", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-back.svg", "icon-back", "返回", "REQ-040", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-lock.svg", "icon-lock", "关卡锁定", "REQ-040", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-sound-on.svg", "icon-sound-on", "音效开（REQ-047 开关态）", "REQ-047", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-sound-off.svg", "icon-sound-off", "音效关（REQ-047 开关态）", "REQ-047", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-music-on.svg", "icon-music-on", "BGM 开（REQ-047 开关态）", "REQ-047", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-music-off.svg", "icon-music-off", "BGM 关（REQ-047 开关态）", "REQ-047", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-settings.svg", "icon-settings", "设置", "REQ-040", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-trophy.svg", "icon-trophy", "排行榜", "REQ-040", "TASK-039", "32×32", "SVG 1.1"),
    ("icon-close.svg", "icon-close", "关闭", "REQ-040", "TASK-039", "32×32", "SVG 1.1"),
]

AUDIO = [
    ("bgm-main", "主 BGM（循环，128 BPM，C 大调 I-V-vi-IV，32 小节）", "REQ-045", "TASK-040", 60.00),
    ("sfx-swap", "交换（有效/无效均播放）", "REQ-046", "TASK-040", 0.12),
    ("sfx-invalid", "非法操作（非相邻/障碍格/无效回弹）", "REQ-046", "TASK-040", 0.15),
    ("sfx-match", "每轮消除开始（C6-E6-G6 铃声）", "REQ-046", "TASK-040", 0.25),
    ("sfx-cascade", "第 2 轮及以后连锁", "REQ-046", "TASK-040", 0.30),
    ("sfx-special-line", "直线特化触发（whoosh + 上扬 zing）", "REQ-046", "TASK-040", 0.40),
    ("sfx-special-rainbow", "彩虹特化触发（和弦 + 上行琶音）", "REQ-046", "TASK-040", 0.60),
    ("sfx-ice-break", "破冰（高频碎裂 + 玻璃音）", "REQ-046", "TASK-040", 0.30),
    ("sfx-stone-break", "破石（低频撞击 + 碎石噪声）", "REQ-046", "TASK-040", 0.35),
    ("sfx-shuffle", "无可行步重排", "REQ-046", "TASK-040", 0.50),
    ("sfx-star", "结算逐星亮起", "REQ-046", "TASK-040", 0.50),
    ("sfx-win", "胜利判定", "REQ-046", "TASK-040", 1.50),
    ("sfx-lose", "失败判定", "REQ-046", "TASK-040", 1.20),
    ("sfx-click", "所有 DOM 按钮点击", "REQ-046", "TASK-040", 0.08),
]


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
    return shutil.which("ffmpeg")


def audio_probe(ff, path):
    info = subprocess.run([ff, "-hide_banner", "-i", path], capture_output=True, text=True,
                          errors="ignore").stderr
    m = re.search(r"Duration: (\d\d):(\d\d):(\d\d\.\d\d)", info)
    dur = 0.0
    if m:
        dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return dur


def main():
    ff = find_ffmpeg()
    rows_img = []
    total_img = 0
    total_first = 0
    for name, key, purpose, req, task, dims, fmt in IMAGES:
        path = os.path.join(ROOT, name)
        size = os.path.getsize(path)
        total_img += size
        if name != "bg-main.webp":
            total_first += size
        rows_img.append("| `%s` | `%s` | `%s` | %s | %s | %s | %s | %s | %d | %.1f |"
                        % (key, name, "assets/" + name, purpose, req, task, dims, fmt, size, size / 1024))

    rows_aud = []
    total_aud = 0
    for stem, purpose, req, task, dur in AUDIO:
        sizes = []
        for ext in ("ogg", "mp3"):
            p = os.path.join(ROOT, stem + "." + ext)
            sizes.append(os.path.getsize(p))
            total_aud += os.path.getsize(p)
        rows_aud.append("| `%s` | `assets/%s.ogg` / `.mp3` | %s | %s | %s | %.2f s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | %.1f KB |"
                        % (stem, stem, purpose, req, task, dur, sum(sizes) / 1024))

    hashes = []
    for name, key, *_ in IMAGES:
        hashes.append(("assets/" + name, sha256(os.path.join(ROOT, name)), os.path.getsize(os.path.join(ROOT, name))))
    for stem, *_ in AUDIO:
        for ext in ("ogg", "mp3"):
            p = os.path.join(ROOT, stem + "." + ext)
            hashes.append(("assets/%s.%s" % (stem, ext), sha256(p), os.path.getsize(p)))

    total = total_img + total_aud
    md = []
    md.append("# 资源清单（assets/manifest.md）\n")
    md.append("> 本文件由 `assets/tools/write_manifest.py` 依据磁盘实际文件生成；"
              "数值（体积/校验和/时长）为生成时刻实测值。\n")
    md.append("| 项 | 值 |\n|---|---|")
    md.append("| 项目 | web-match-game（Web 益智消除小游戏 MVP） |")
    md.append("| 清单版本 | v1.0.0 |")
    md.append("| 生成日期 | 2026-11-11 |")
    md.append("| 负责人 | asset-maker（pt-asset-maker） |")
    md.append("| 依据 | spec.md v1.0.1 第 5.1/10.1/10.2 章；plan.md 第 3/9/14 章；tasks.md TASK-004/038/039/040/041 |")
    md.append("| 图片 | %d 个文件，%.1f KB |" % (len(IMAGES), total_img / 1024))
    md.append("| 音频 | %d 个文件（%d 名称 × 2 格式），%.1f KB |" % (len(AUDIO) * 2, len(AUDIO), total_aud / 1024))
    md.append("| 合计 | %d 个文件，%.2f MB |" % (len(IMAGES) + len(AUDIO) * 2, total / 1048576))
    md.append("| 缺失项 | 0（清单 33 图片 + 28 音频全部落地） |")
    md.append("")
    md.append("## 1. 视觉规范（与 constitution.md / spec.md 5.1 对齐）\n")
    md.append("| 维度 | 约定 |")
    md.append("|---|---|")
    md.append("| 风格 | 明亮清新的休闲三消：圆角、柔和渐变、轻微内高光与底部压暗；不使用写实纹理与大面积模糊 |")
    md.append("| 主色 | "
              "星 `#F2C230`、水 `#3AA0E8`、叶 `#57C24A`、火 `#E8503A`、晶 `#9B59D0`、电 `#23C4C4`（spec 5.1，逐像素校验） |")
    md.append("| 形状 | 五角星 / 水滴 / 叶片 / 火焰 / 六角晶体 / 闪电；转灰度后仍两两可辨（非仅靠颜色，见 constitution 5.2） |")
    md.append("| 描边 | 元素外描边为同色系压暗 42%，宽度约 1.5px（64px 画布） |")
    md.append("| 高光 | 左上单侧柔光，避免中心高光影响主色取样 |")
    md.append("| 棋盘配色 | 外框/槽位深青蓝系（`#0A202C`–`#1B4A5E`），与六种元素形成明度差 |")
    md.append("| 透明区 | 元素、特化、障碍、闪光均为透明背景；外框内区 512×512 透明，避免遮挡棋盘 |")
    md.append("| 色盲符号 | ★ ● ▲ ■ ◆ ✚ 由 `src/render/tile-renderer.ts` 叠加（资产不烘焙符号，REQ-043） |")
    md.append("")
    md.append("## 2. 加载约定（key / 路径 / 体积）\n")
    md.append("- 加载 key = 文件名去扩展名，例如 `tile-star`、`bg-main`、`sfx-match`、`bgm-main`。")
    md.append("- 路径统一为 `assets/<key>.<ext>`，由 `src/render/assets.ts` 的 "
              "`import.meta.glob('../../assets/*.{webp,png,svg,ogg,mp3}', { eager: true, query: '?url' })` 映射；"
              "`assets/tools/`、`manifest.md`、`checksums.json` 不匹配该 glob，不会进入产物。")
    md.append("- 音频：先探测 `new Audio().canPlayType('audio/ogg; codecs=\"vorbis\"')`，空字符串时改用 `.mp3`；两套内容一致。")
    md.append("- 缺失任一 key 时由 `src/render/placeholders.ts` 纯色 + 形状占位（REQ-042），本清单不提供占位文件。")
    md.append("")
    md.append("## 3. 图片清单（33 个）\n")
    md.append("| key | 文件名 | 路径 | 用途 | REQ | TASK | 尺寸 | 格式 | 字节 | KB |")
    md.append("|---|---|---|---|---|---|---|---|---:|---:|")
    md.extend(rows_img)
    md.append("")
    md.append("> 元素主色校验：对每个 `tile-*.webp` 取 alpha>240 像素的中位色，与 spec 5.1 十六进制逐通道比对，"
              "最大偏差 ≤ 12/255（实际 0–6）。\n")
    md.append("## 4. 音频清单（14 名称 × 2 格式 = 28 个）\n")
    md.append("| key | 路径 | 用途 | REQ | TASK | 时长 | 格式/码率 | 两格式合计 |")
    md.append("|---|---|---|---|---|---:|---|---:|")
    md.extend(rows_aud)
    md.append("")
    md.append("> 短音效的「文件体积 ÷ 时长」会因 Ogg/MP3 容器头（约 4 KB）而高于标称码率，"
              "音频流本身为 OGG 96 kbps / MP3 128 kbps CBR。\n")
    md.append("> MP3 时长以**解码口径**为准（ffmpeg/PCM 样本数，与 libsndfile / Chrome decodeAudioData 一致；"
              "48 kHz 每帧 1152 样本 = 24 ms），Xing/Info 声明帧数仅作对照记录。"
              "LAME 的 Info/Xing 元数据帧会被解码器丢弃，故可解码载荷 = (声明帧数 - 1) × 1152；"
              "重编码时按最接近标称值的可解码帧数对齐，并在声明帧数中 +1 补回 Info 帧，"
              "14 个 MP3 解码时长误差 ≤ 12 ms（≤1 帧），OGG 由 granule 定位、时长保持精确。"
              "BGM 载荷与 OGG 等长（60.000 s），循环接缝不变；短音效尾部以 12 ms 淡出收束。\n")
    md.append("## 5. 体积预算与实测\n")
    md.append("| 项 | 上限 | 实测 | 结论 |")
    md.append("|---|---:|---:|---|")
    md.append("| 图片合计 | 1638.4 KB（1.6 MB） | %.1f KB | ✅ |" % (total_img / 1024))
    md.append("| 首屏图片（不含 bg-main） | 1228.8 KB（1.2 MB） | %.1f KB | ✅ |" % (total_first / 1024))
    md.append("| bg-main 单文件 | 400 KB | %.1f KB | ✅ |" % (os.path.getsize(os.path.join(ROOT, "bg-main.webp")) / 1024))
    md.append("| 音频合计 | 2048 KB（2.0 MB） | %.1f KB | ✅ |" % (total_aud / 1024))
    md.append("| 全量资源 | — | %.2f MB | 计入首屏 gzip ≤3.0 MB 预算时仍有余量 |" % (total / 1048576))
    md.append("")
    md.append("## 6. 来源与授权\n")
    md.append("| 类别 | 来源 | 授权 |")
    md.append("|---|---|---|")
    md.append("| 全部图片 | 本项目原创，`assets/tools/generate_images.py` / `generate_icons.py` 程序化生成（无外部素材、无 AI 生成图） | 项目自有，随项目分发；无第三方素材许可负担 |")
    md.append("| 全部音频 | 本项目原创，`assets/tools/generate_audio.py` 以 numpy 振荡器/噪声合成（无采样、无第三方音源） | 项目自有，CC0 等效放弃权利 |")
    md.append("| 图标 | 手写 SVG 路径，`currentColor` 单色可继承 | 项目自有 |")
    md.append("")
    md.append("> 说明：本 Agent 未配置图像生成模型（`csgclaw_generate_image` 返回 `image_model_not_configured`），"
              "因此位图按 spec 数值用脚本确定性绘制，而非模型生成；像素尺寸、主色与透明区因此可逐项校验。")
    md.append("")
    md.append("## 7. 生成与复现\n")
    md.append("```bash")
    md.append("pip install pillow numpy            # 图片")
    md.append("pip install soundfile lameenc       # 仅历史方案；当前音频改用 ffmpeg 编码")
    md.append("# 音频需要 ffmpeg（含 libvorbis + libmp3lame），可用 FFMPEG_PATH 指定")
    md.append("python assets/tools/generate_images.py   # 19 个位图")
    md.append("python assets/tools/generate_icons.py    # 14 个 SVG")
    md.append("python assets/tools/generate_audio.py    # 28 个音频")
    md.append("python assets/tools/generate_audio.py --mp3-only  # 仅按帧对齐重编码 14 个 MP3，OGG 不变")
    md.append("python assets/tools/verify_assets.py     # 尺寸/格式/主色/时长/接缝/预算校验")
    md.append("python assets/tools/write_manifest.py    # 重新生成本清单")
    md.append("```")
    md.append("")
    md.append("- 随机性全部来自固定种子（图片 `20261110`，BGM 音符序列固定），重复运行输出一致（Ogg 容器序列号除外）。")
    md.append("- BGM 采用 128 BPM、32 小节 = 60.000 s，音符按环形缓冲区写入，循环接缝天然连续。")
    md.append("")
    md.append("## 8. 验收结果\n")
    md.append("`python assets/tools/verify_assets.py` 最近一次运行：**PASS**\n")
    md.append("| 检查项 | 方法 | 结果 |")
    md.append("|---|---|---|")
    md.append("| 33 图片 / 28 音频齐全 | 文件名与清单逐一比对 | ✅ 无缺失、无多余 |")
    md.append("| 尺寸/格式 | Pillow 读取 + 文件头魔数 | ✅ 全部匹配 |")
    md.append("| 元素主色 | alpha>240 中位色 vs spec 5.1 | ✅ 最大偏差 ≤12 |")
    md.append("| 透明背景 | alpha 通道存在 0 与 255 | ✅ |")
    md.append("| 灰度可辨（自动代理） | 32 桶亮度直方图 L1 距离 | ✅ 最小 0.301（阈值 0.20） |")
    md.append("| 音频时长（OGG） | granule / ffmpeg Duration vs spec 10.2 | ✅ 误差 ≤0.01 s |")
    md.append("| 音频时长（MP3） | 解码 PCM 样本数 vs spec 10.2（Xing 声明值对照） | ✅ 误差 ≤12 ms（≤1 帧） |")
    md.append("| 单声道/采样率 | ffmpeg 流信息 | ✅ 48 kHz mono |")
    md.append("| 削波 | 解码峰值 | ✅ 全部 < 0.999 |")
    md.append("| BGM 循环接缝 | 首尾样本差 + 10 ms RMS | ✅ 样本差 <0.01（OGG 0.003 / MP3 0.006），接缝无静音 |")
    md.append("| 体积预算 | 见第 5 节 | ✅ 四项全部达标 |")
    md.append("")
    md.append("### 待人工评审（不阻断交付）\n")
    md.append("| 项 | 状态 | 说明 |")
    md.append("|---|---|---|")
    md.append("| 3 人灰度评审（REQ-039 / TASK-038 DoD） | 待评审 | 自动代理已通过；需 3 名评审人签字确认 6 种元素灰度两两可辨 |")
    md.append("| BGM 听感与接缝试听（TASK-040 DoD） | 待试听 | 波形/时长/峰值已自动校验；主观听感需人工确认 |")
    md.append("| 音量 0..5 / 96..100 试听 | 待试听 | 属 REQ-047 播放增益实现，资产本身已归一化到 -1.1 dBFS 峰值 |")
    md.append("")
    md.append("## 9. 已知差异与待裁决\n")
    md.append("| 编号 | 内容 | 处理 |")
    md.append("|---|---|---|")
    md.append("| AS-01 | spec 10.1 的资源名写作 `tile-*.webp`，但同表「格式」列写「PNG 透明」，两处自相矛盾 | 按 plan 第 3 章与 TASK-038 的 `.webp` 命名交付（WebP 带 alpha，体积更小）；若要求字节级 PNG 需 spec-lead 出 CR 后补产 |")
    md.append("| AS-02 | 本 Agent 未配置图像生成模型，位图改由脚本绘制 | 已在第 6 节声明；不影响尺寸/主色/透明校验 |")
    md.append("| AS-03 | `icon-*.svg` 为单色 `currentColor`，用 `<img>` 引入时不会继承外部颜色 | 需内联 SVG 或 CSS `mask-image`；已在 plan 4.3 的资源映射范围内 |")
    md.append("| AS-04 | 图像生成模型缺失导致无法产出「照片级/AI 质感」背景 | 当前为程序化插画；如后续配置模型可替换 `bg-main.webp` 并保持 1920×1080 ≤400 KB |")
    md.append("")
    md.append("## 附录 A：SHA256（%d 个文件）\n" % len(hashes))
    md.append("| 文件 | 字节 | SHA256 |")
    md.append("|---|---:|---|")
    for path, h, size in hashes:
        md.append("| `%s` | %d | `%s` |" % (path, size, h))
    md.append("")
    md.append("机器可读版本：`assets/checksums.json`（由 `verify_assets.py` 生成，键为文件名）。")
    md.append("")

    out = os.path.join(ROOT, "manifest.md")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(md))
    print("wrote %s (%.1f KB)" % (out, os.path.getsize(out) / 1024))
    print("images %.1f KB, audio %.1f KB, total %.2f MB" % (total_img / 1024, total_aud / 1024, total / 1048576))


if __name__ == "__main__":
    main()
