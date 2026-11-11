# 资源清单（assets/manifest.md）

> 本文件由 `assets/tools/write_manifest.py` 依据磁盘实际文件生成；数值（体积/校验和/时长）为生成时刻实测值。

| 项 | 值 |
|---|---|
| 项目 | web-match-game（Web 益智消除小游戏 MVP） |
| 清单版本 | v1.0.0 |
| 生成日期 | 2026-11-11 |
| 负责人 | asset-maker（pt-asset-maker） |
| 依据 | spec.md v1.0.1 第 5.1/10.1/10.2 章；plan.md 第 3/9/14 章；tasks.md TASK-004/038/039/040/041 |
| 图片 | 33 个文件，77.4 KB |
| 音频 | 28 个文件（14 名称 × 2 格式），1878.1 KB |
| 合计 | 61 个文件，1.91 MB |
| 缺失项 | 0（清单 33 图片 + 28 音频全部落地） |

## 1. 视觉规范（与 constitution.md / spec.md 5.1 对齐）

| 维度 | 约定 |
|---|---|
| 风格 | 明亮清新的休闲三消：圆角、柔和渐变、轻微内高光与底部压暗；不使用写实纹理与大面积模糊 |
| 主色 | 星 `#F2C230`、水 `#3AA0E8`、叶 `#57C24A`、火 `#E8503A`、晶 `#9B59D0`、电 `#23C4C4`（spec 5.1，逐像素校验） |
| 形状 | 五角星 / 水滴 / 叶片 / 火焰 / 六角晶体 / 闪电；转灰度后仍两两可辨（非仅靠颜色，见 constitution 5.2） |
| 描边 | 元素外描边为同色系压暗 42%，宽度约 1.5px（64px 画布） |
| 高光 | 左上单侧柔光，避免中心高光影响主色取样 |
| 棋盘配色 | 外框/槽位深青蓝系（`#0A202C`–`#1B4A5E`），与六种元素形成明度差 |
| 透明区 | 元素、特化、障碍、闪光均为透明背景；外框内区 512×512 透明，避免遮挡棋盘 |
| 色盲符号 | ★ ● ▲ ■ ◆ ✚ 由 `src/render/tile-renderer.ts` 叠加（资产不烘焙符号，REQ-043） |

## 2. 加载约定（key / 路径 / 体积）

- 加载 key = 文件名去扩展名，例如 `tile-star`、`bg-main`、`sfx-match`、`bgm-main`。
- 路径统一为 `assets/<key>.<ext>`，由 `src/render/assets.ts` 的 `import.meta.glob('../../assets/*.{webp,png,svg,ogg,mp3}', { eager: true, query: '?url' })` 映射；`assets/tools/`、`manifest.md`、`checksums.json` 不匹配该 glob，不会进入产物。
- 音频：先探测 `new Audio().canPlayType('audio/ogg; codecs="vorbis"')`，空字符串时改用 `.mp3`；两套内容一致。
- 缺失任一 key 时由 `src/render/placeholders.ts` 纯色 + 形状占位（REQ-042），本清单不提供占位文件。

## 3. 图片清单（33 个）

| key | 文件名 | 路径 | 用途 | REQ | TASK | 尺寸 | 格式 | 字节 | KB |
|---|---|---|---|---|---|---|---|---:|---:|
| `bg-main` | `bg-main.webp` | `assets/bg-main.webp` | 主背景（L0，1920×1080，cover 裁切到 960×720） | REQ-040 | TASK-039 | 1920×1080 | WebP q82 | 16264 | 15.9 |
| `board-frame` | `board-frame.webp` | `assets/board-frame.webp` | 棋盘外框，含 24px 内边距（内区 512×512 透明） | REQ-040 | TASK-039 | 560×560 | WebP q88 | 6248 | 6.1 |
| `cell-empty` | `cell-empty.webp` | `assets/cell-empty.webp` | 棋盘空槽底（可平铺） | REQ-040 | TASK-039 | 64×64 | WebP q95 | 1852 | 1.8 |
| `tile-star` | `tile-star.webp` | `assets/tile-star.webp` | 元素「星」#F2C230 | REQ-039/043 | TASK-038 | 64×64 | WebP q95 透明 | 2836 | 2.8 |
| `tile-water` | `tile-water.webp` | `assets/tile-water.webp` | 元素「水滴」#3AA0E8 | REQ-039/043 | TASK-038 | 64×64 | WebP q95 透明 | 2230 | 2.2 |
| `tile-leaf` | `tile-leaf.webp` | `assets/tile-leaf.webp` | 元素「叶」#57C24A | REQ-039/043 | TASK-038 | 64×64 | WebP q95 透明 | 2146 | 2.1 |
| `tile-flame` | `tile-flame.webp` | `assets/tile-flame.webp` | 元素「火」#E8503A | REQ-039/043 | TASK-038 | 64×64 | WebP q95 透明 | 2290 | 2.2 |
| `tile-crystal` | `tile-crystal.webp` | `assets/tile-crystal.webp` | 元素「晶」#9B59D0（第 5-8 关不出现） | REQ-039/043 | TASK-038 | 64×64 | WebP q95 透明 | 1584 | 1.5 |
| `tile-bolt` | `tile-bolt.webp` | `assets/tile-bolt.webp` | 元素「电」#23C4C4 | REQ-039/043 | TASK-038 | 64×64 | WebP q95 透明 | 2068 | 2.0 |
| `tile-select` | `tile-select.webp` | `assets/tile-select.webp` | 选中高亮描边（叠加在元素之上） | REQ-039 | TASK-038 | 64×64 | WebP q95 透明 | 2022 | 2.0 |
| `special-line-h` | `special-line-h.webp` | `assets/special-line-h.webp` | 横线特化箭头纹理（叠加在原元素上） | REQ-039 | TASK-038 | 64×64 | WebP q95 透明 | 1128 | 1.1 |
| `special-line-v` | `special-line-v.webp` | `assets/special-line-v.webp` | 竖线特化箭头纹理（叠加在原元素上） | REQ-039 | TASK-038 | 64×64 | WebP q95 透明 | 1102 | 1.1 |
| `special-rainbow` | `special-rainbow.webp` | `assets/special-rainbow.webp` | 彩虹特化七彩环（中心透明） | REQ-039 | TASK-038 | 64×64 | WebP q95 透明 | 2918 | 2.8 |
| `obs-ice` | `obs-ice.webp` | `assets/obs-ice.webp` | 冰块 1 层（绘制在元素下方，半透明蓝白） | REQ-039 | TASK-038 | 64×64 | WebP q95 透明 | 1934 | 1.9 |
| `obs-stone-2` | `obs-stone-2.webp` | `assets/obs-stone-2.webp` | 石块 2 层（完整石块） | REQ-039 | TASK-038 | 64×64 | WebP q95 透明 | 2872 | 2.8 |
| `obs-stone-1` | `obs-stone-1.webp` | `assets/obs-stone-1.webp` | 石块 1 层（带裂纹） | REQ-039 | TASK-038 | 64×64 | WebP q95 透明 | 3280 | 3.2 |
| `obs-hole` | `obs-hole.webp` | `assets/obs-hole.webp` | 死格（深色凹陷，不绘制元素） | REQ-039 | TASK-038 | 64×64 | WebP q95 透明 | 1844 | 1.8 |
| `fx-clear` | `fx-clear.webp` | `assets/fx-clear.webp` | 消除闪光单帧粒子贴图 | REQ-039/044 | TASK-038 | 128×128 | WebP q95 透明 | 8554 | 8.4 |
| `ui-panel` | `ui-panel.webp` | `assets/ui-panel.webp` | 面板底框（结算/设置/排行榜共用） | REQ-040 | TASK-039 | 720×520 | WebP q88 | 10446 | 10.2 |
| `icon-star-on` | `icon-star-on.svg` | `assets/icon-star-on.svg` | 星级（亮） | REQ-040 | TASK-039 | 48×48 | SVG 1.1 | 389 | 0.4 |
| `icon-star-off` | `icon-star-off.svg` | `assets/icon-star-off.svg` | 星级（暗） | REQ-040 | TASK-039 | 48×48 | SVG 1.1 | 377 | 0.4 |
| `icon-play` | `icon-play.svg` | `assets/icon-play.svg` | 开始/继续 | REQ-040 | TASK-039 | 32×32 | SVG 1.1 | 291 | 0.3 |
| `icon-pause` | `icon-pause.svg` | `assets/icon-pause.svg` | 暂停 | REQ-040 | TASK-039 | 32×32 | SVG 1.1 | 394 | 0.4 |
| `icon-restart` | `icon-restart.svg` | `assets/icon-restart.svg` | 重开 | REQ-040 | TASK-039 | 32×32 | SVG 1.1 | 298 | 0.3 |
| `icon-back` | `icon-back.svg` | `assets/icon-back.svg` | 返回 | REQ-040 | TASK-039 | 32×32 | SVG 1.1 | 287 | 0.3 |
| `icon-lock` | `icon-lock.svg` | `assets/icon-lock.svg` | 关卡锁定 | REQ-040 | TASK-039 | 32×32 | SVG 1.1 | 369 | 0.4 |
| `icon-sound-on` | `icon-sound-on.svg` | `assets/icon-sound-on.svg` | 音效开（REQ-047 开关态） | REQ-047 | TASK-039 | 32×32 | SVG 1.1 | 385 | 0.4 |
| `icon-sound-off` | `icon-sound-off.svg` | `assets/icon-sound-off.svg` | 音效关（REQ-047 开关态） | REQ-047 | TASK-039 | 32×32 | SVG 1.1 | 371 | 0.4 |
| `icon-music-on` | `icon-music-on.svg` | `assets/icon-music-on.svg` | BGM 开（REQ-047 开关态） | REQ-047 | TASK-039 | 32×32 | SVG 1.1 | 497 | 0.5 |
| `icon-music-off` | `icon-music-off.svg` | `assets/icon-music-off.svg` | BGM 关（REQ-047 开关态） | REQ-047 | TASK-039 | 32×32 | SVG 1.1 | 468 | 0.5 |
| `icon-settings` | `icon-settings.svg` | `assets/icon-settings.svg` | 设置 | REQ-040 | TASK-039 | 32×32 | SVG 1.1 | 750 | 0.7 |
| `icon-trophy` | `icon-trophy.svg` | `assets/icon-trophy.svg` | 排行榜 | REQ-040 | TASK-039 | 32×32 | SVG 1.1 | 441 | 0.4 |
| `icon-close` | `icon-close.svg` | `assets/icon-close.svg` | 关闭 | REQ-040 | TASK-039 | 32×32 | SVG 1.1 | 286 | 0.3 |

> 元素主色校验：对每个 `tile-*.webp` 取 alpha>240 像素的中位色，与 spec 5.1 十六进制逐通道比对，最大偏差 ≤ 12/255（实际 0–6）。

## 4. 音频清单（14 名称 × 2 格式 = 28 个）

| key | 路径 | 用途 | REQ | TASK | 时长 | 格式/码率 | 两格式合计 |
|---|---|---|---|---|---:|---|---:|
| `bgm-main` | `assets/bgm-main.ogg` / `.mp3` | 主 BGM（循环，128 BPM，C 大调 I-V-vi-IV，32 小节） | REQ-045 | TASK-040 | 60.00 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 1650.6 KB |
| `sfx-swap` | `assets/sfx-swap.ogg` / `.mp3` | 交换（有效/无效均播放） | REQ-046 | TASK-040 | 0.12 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 7.4 KB |
| `sfx-invalid` | `assets/sfx-invalid.ogg` / `.mp3` | 非法操作（非相邻/障碍格/无效回弹） | REQ-046 | TASK-040 | 0.15 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 8.5 KB |
| `sfx-match` | `assets/sfx-match.ogg` / `.mp3` | 每轮消除开始（C6-E6-G6 铃声） | REQ-046 | TASK-040 | 0.25 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 11.3 KB |
| `sfx-cascade` | `assets/sfx-cascade.ogg` / `.mp3` | 第 2 轮及以后连锁 | REQ-046 | TASK-040 | 0.30 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 13.0 KB |
| `sfx-special-line` | `assets/sfx-special-line.ogg` / `.mp3` | 直线特化触发（whoosh + 上扬 zing） | REQ-046 | TASK-040 | 0.40 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 15.8 KB |
| `sfx-special-rainbow` | `assets/sfx-special-rainbow.ogg` / `.mp3` | 彩虹特化触发（和弦 + 上行琶音） | REQ-046 | TASK-040 | 0.60 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 21.0 KB |
| `sfx-ice-break` | `assets/sfx-ice-break.ogg` / `.mp3` | 破冰（高频碎裂 + 玻璃音） | REQ-046 | TASK-040 | 0.30 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 13.0 KB |
| `sfx-stone-break` | `assets/sfx-stone-break.ogg` / `.mp3` | 破石（低频撞击 + 碎石噪声） | REQ-046 | TASK-040 | 0.35 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 14.4 KB |
| `sfx-shuffle` | `assets/sfx-shuffle.ogg` / `.mp3` | 无可行步重排 | REQ-046 | TASK-040 | 0.50 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 18.5 KB |
| `sfx-star` | `assets/sfx-star.ogg` / `.mp3` | 结算逐星亮起 | REQ-046 | TASK-040 | 0.50 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 17.7 KB |
| `sfx-win` | `assets/sfx-win.ogg` / `.mp3` | 胜利判定 | REQ-046 | TASK-040 | 1.50 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 44.4 KB |
| `sfx-lose` | `assets/sfx-lose.ogg` / `.mp3` | 失败判定 | REQ-046 | TASK-040 | 1.20 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 35.7 KB |
| `sfx-click` | `assets/sfx-click.ogg` / `.mp3` | 所有 DOM 按钮点击 | REQ-046 | TASK-040 | 0.08 s | OGG 96 kbps / MP3 128 kbps · 48 kHz 单声道 | 6.7 KB |

> 短音效的「文件体积 ÷ 时长」会因 Ogg/MP3 容器头（约 4 KB）而高于标称码率，音频流本身为 OGG 96 kbps / MP3 128 kbps CBR。

> MP3 时长以**解码口径**为准（ffmpeg/PCM 样本数，与 libsndfile / Chrome decodeAudioData 一致；48 kHz 每帧 1152 样本 = 24 ms），Xing/Info 声明帧数仅作对照记录。LAME 的 Info/Xing 元数据帧会被解码器丢弃，故可解码载荷 = (声明帧数 - 1) × 1152；重编码时按最接近标称值的可解码帧数对齐，并在声明帧数中 +1 补回 Info 帧，14 个 MP3 解码时长误差 ≤ 12 ms（≤1 帧），OGG 由 granule 定位、时长保持精确。BGM 载荷与 OGG 等长（60.000 s），循环接缝不变；短音效尾部以 12 ms 淡出收束。

## 5. 体积预算与实测

| 项 | 上限 | 实测 | 结论 |
|---|---:|---:|---|
| 图片合计 | 1638.4 KB（1.6 MB） | 77.4 KB | ✅ |
| 首屏图片（不含 bg-main） | 1228.8 KB（1.2 MB） | 61.5 KB | ✅ |
| bg-main 单文件 | 400 KB | 15.9 KB | ✅ |
| 音频合计 | 2048 KB（2.0 MB） | 1878.1 KB | ✅ |
| 全量资源 | — | 1.91 MB | 计入首屏 gzip ≤3.0 MB 预算时仍有余量 |

## 6. 来源与授权

| 类别 | 来源 | 授权 |
|---|---|---|
| 全部图片 | 本项目原创，`assets/tools/generate_images.py` / `generate_icons.py` 程序化生成（无外部素材、无 AI 生成图） | 项目自有，随项目分发；无第三方素材许可负担 |
| 全部音频 | 本项目原创，`assets/tools/generate_audio.py` 以 numpy 振荡器/噪声合成（无采样、无第三方音源） | 项目自有，CC0 等效放弃权利 |
| 图标 | 手写 SVG 路径，`currentColor` 单色可继承 | 项目自有 |

> 说明：本 Agent 未配置图像生成模型（`csgclaw_generate_image` 返回 `image_model_not_configured`），因此位图按 spec 数值用脚本确定性绘制，而非模型生成；像素尺寸、主色与透明区因此可逐项校验。

## 7. 生成与复现

```bash
pip install pillow numpy            # 图片
pip install soundfile lameenc       # 仅历史方案；当前音频改用 ffmpeg 编码
# 音频需要 ffmpeg（含 libvorbis + libmp3lame），可用 FFMPEG_PATH 指定
python assets/tools/generate_images.py   # 19 个位图
python assets/tools/generate_icons.py    # 14 个 SVG
python assets/tools/generate_audio.py    # 28 个音频
python assets/tools/generate_audio.py --mp3-only  # 仅按帧对齐重编码 14 个 MP3，OGG 不变
python assets/tools/verify_assets.py     # 尺寸/格式/主色/时长/接缝/预算校验
python assets/tools/write_manifest.py    # 重新生成本清单
```

- 随机性全部来自固定种子（图片 `20261110`，BGM 音符序列固定），重复运行输出一致（Ogg 容器序列号除外）。
- BGM 采用 128 BPM、32 小节 = 60.000 s，音符按环形缓冲区写入，循环接缝天然连续。

## 8. 验收结果

`python assets/tools/verify_assets.py` 最近一次运行：**PASS**

| 检查项 | 方法 | 结果 |
|---|---|---|
| 33 图片 / 28 音频齐全 | 文件名与清单逐一比对 | ✅ 无缺失、无多余 |
| 尺寸/格式 | Pillow 读取 + 文件头魔数 | ✅ 全部匹配 |
| 元素主色 | alpha>240 中位色 vs spec 5.1 | ✅ 最大偏差 ≤12 |
| 透明背景 | alpha 通道存在 0 与 255 | ✅ |
| 灰度可辨（自动代理） | 32 桶亮度直方图 L1 距离 | ✅ 最小 0.301（阈值 0.20） |
| 音频时长（OGG） | granule / ffmpeg Duration vs spec 10.2 | ✅ 误差 ≤0.01 s |
| 音频时长（MP3） | 解码 PCM 样本数 vs spec 10.2（Xing 声明值对照） | ✅ 误差 ≤12 ms（≤1 帧） |
| 单声道/采样率 | ffmpeg 流信息 | ✅ 48 kHz mono |
| 削波 | 解码峰值 | ✅ 全部 < 0.999 |
| BGM 循环接缝 | 首尾样本差 + 10 ms RMS | ✅ 样本差 <0.01（OGG 0.003 / MP3 0.006），接缝无静音 |
| 体积预算 | 见第 5 节 | ✅ 四项全部达标 |

### 待人工评审（不阻断交付）

| 项 | 状态 | 说明 |
|---|---|---|
| 3 人灰度评审（REQ-039 / TASK-038 DoD） | 待评审 | 自动代理已通过；需 3 名评审人签字确认 6 种元素灰度两两可辨 |
| BGM 听感与接缝试听（TASK-040 DoD） | 待试听 | 波形/时长/峰值已自动校验；主观听感需人工确认 |
| 音量 0..5 / 96..100 试听 | 待试听 | 属 REQ-047 播放增益实现，资产本身已归一化到 -1.1 dBFS 峰值 |

## 9. 已知差异与待裁决

| 编号 | 内容 | 处理 |
|---|---|---|
| AS-01 | spec 10.1 的资源名写作 `tile-*.webp`，但同表「格式」列写「PNG 透明」，两处自相矛盾 | 按 plan 第 3 章与 TASK-038 的 `.webp` 命名交付（WebP 带 alpha，体积更小）；若要求字节级 PNG 需 spec-lead 出 CR 后补产 |
| AS-02 | 本 Agent 未配置图像生成模型，位图改由脚本绘制 | 已在第 6 节声明；不影响尺寸/主色/透明校验 |
| AS-03 | `icon-*.svg` 为单色 `currentColor`，用 `<img>` 引入时不会继承外部颜色 | 需内联 SVG 或 CSS `mask-image`；已在 plan 4.3 的资源映射范围内 |
| AS-04 | 图像生成模型缺失导致无法产出「照片级/AI 质感」背景 | 当前为程序化插画；如后续配置模型可替换 `bg-main.webp` 并保持 1920×1080 ≤400 KB |

## 附录 A：SHA256（61 个文件）

| 文件 | 字节 | SHA256 |
|---|---:|---|
| `assets/bg-main.webp` | 16264 | `034479de6d9c423aa859745a6e4a76d772ae971848f5381d4d70d9133580af54` |
| `assets/board-frame.webp` | 6248 | `aeb9dd83680cc6c01eef1a6ce70220eb785039197cd4cd12112b0b6211339538` |
| `assets/cell-empty.webp` | 1852 | `cc266105160b8df117042d3c3c760a36d7d68385d77259c4e3cc48027298040a` |
| `assets/tile-star.webp` | 2836 | `b265c5ba6102dfa335ba7553a4f4ee539656a4b9a5bcd1705a4e881c57f1625a` |
| `assets/tile-water.webp` | 2230 | `3617fa635663f4bf204b0adcc961a515b50a059df9f3a1d2317394df6f51710b` |
| `assets/tile-leaf.webp` | 2146 | `4824d7c27db45b5940f05db7c6fec0317d95c33bac3b94ba2bf006b80c2ef2a6` |
| `assets/tile-flame.webp` | 2290 | `e8543094f484d224fd4e4ee8e100df2ae5d6bab33b3a25a6f9f26396dcce5321` |
| `assets/tile-crystal.webp` | 1584 | `b4b1b35a3bca2912248b70922a01c8b072642b7d21a25a56b2d787847008bebd` |
| `assets/tile-bolt.webp` | 2068 | `b23b71b7e57eca1acd1e479495cc1b5481bc6067340518bc129db37f49beaaac` |
| `assets/tile-select.webp` | 2022 | `32ad0c708b3d5332dad1f7f8b0277a53ee1305a3509655bf702d89e405b5770e` |
| `assets/special-line-h.webp` | 1128 | `d97fe200b90a4350eef46aa4c4c474c7620974f4d07438cf3a9d1874236ce127` |
| `assets/special-line-v.webp` | 1102 | `d410bcaec11595cefd242413daf481380477104a5af3c5bfc7567b3f4f77baa9` |
| `assets/special-rainbow.webp` | 2918 | `b6ad79c60efe884f2cd60ec1df2527c5553ef405532609d3e56182bd7d5ecc38` |
| `assets/obs-ice.webp` | 1934 | `1176e2ac7bce449deab78d6ff5b59412a4b0e60cd8ac27f078a56f2293f6aae4` |
| `assets/obs-stone-2.webp` | 2872 | `15172bf0bf8fd4ca7216b5641fe9878cfc7b99bbbf4e1cd95f37720457f79c86` |
| `assets/obs-stone-1.webp` | 3280 | `54943c7407472b70cfcd0a2576e9f53217e041462c857513c11664d600460d7e` |
| `assets/obs-hole.webp` | 1844 | `583e9e08a30d333a913e2f050400a1eb8812cf6a71b801103f8c385f40261fb0` |
| `assets/fx-clear.webp` | 8554 | `81acd7e3a7bba912b8d09cb398787865f56bc5547a694dafde29204075de6b06` |
| `assets/ui-panel.webp` | 10446 | `6bebcdeb9bc492a577ccc3a55e2fc6a219d2d79eb9364510d32a4b7b1f77df91` |
| `assets/icon-star-on.svg` | 389 | `18e6b51ef98b2d007187e5c84a0d1fce8303e593af6c65c9b1117f05d4b29628` |
| `assets/icon-star-off.svg` | 377 | `1c63bfab3216ac9ae05115e460e1ed42bae3ef26b0150de2a70ca2937b6d0a0e` |
| `assets/icon-play.svg` | 291 | `a361231a78f8cd140203c35590e202ca222a55b6c8ba038773d772147b101619` |
| `assets/icon-pause.svg` | 394 | `2280b4083c72354f2d819bf37385bbabf7df3544ce30fb4b62379c713666bb0a` |
| `assets/icon-restart.svg` | 298 | `5bd3541fdfa122e85427d7142f5d6f54a24c5a5952f8ec4cfdfdbdd95045e61a` |
| `assets/icon-back.svg` | 287 | `8850d07bd085393d096114ca3a9977f756cda26ced84fa8a5c183975d60cbcc2` |
| `assets/icon-lock.svg` | 369 | `08ac2524969aba48c48a03f86d007df0a9b3c1a625806d3d64603bf062bdc718` |
| `assets/icon-sound-on.svg` | 385 | `a10a9fe9f6205880ed513b7afd09ee7ac49af16f20e5fbdf9ade9369051770dd` |
| `assets/icon-sound-off.svg` | 371 | `aa0e70c8451bc97f9f043ee91d76eb153bb6e456062f3e4b723ea59e41d62b4b` |
| `assets/icon-music-on.svg` | 497 | `a151bd472b180fbd7ecb6403b233efa7d8653306cdde6afa79f4bd5d43f0e389` |
| `assets/icon-music-off.svg` | 468 | `57a94b24209d1098303443f3bd6c9217df73d0febc2d95071df238484ec1b12f` |
| `assets/icon-settings.svg` | 750 | `9bc3df43c4d34ac2400ab7da63c800af49489bfa4c9e8e7c14fc8f88e61e6be1` |
| `assets/icon-trophy.svg` | 441 | `8aecb8c9d897ca9d8138565306e9cfaaaeb40972b0a463fe48de2eef24209fa1` |
| `assets/icon-close.svg` | 286 | `5c91eaad4890662bb36e3aeecfee404e5c4a843ffb8c9eacad4f19826468d9ea` |
| `assets/bgm-main.ogg` | 729415 | `dcbce4594643f96b54fcecdb68f313ed2ca3ffa06519c959e25f9bfbb39f1bea` |
| `assets/bgm-main.mp3` | 960788 | `ed9a3d354db936013f342e6b4b3c252d58f4dd3d5e07df1d61d09914686b192d` |
| `assets/sfx-swap.ogg` | 4907 | `887da1a8b7bb60526ad1e058fcaca55c45a00610c72bfa43df262c55333186a4` |
| `assets/sfx-swap.mp3` | 2708 | `eb000677fd0db092d549a0c99fc104c1ebe9c10298060f9916c837da71601ec3` |
| `assets/sfx-invalid.ogg` | 5571 | `a5194bddba798d95cecd936e9d8699ab6730e6758677bbb783257c694e44ec26` |
| `assets/sfx-invalid.mp3` | 3092 | `5b85a088dc5c4482d98ccb6674d817ddec16fd6e747c41688832dc7533cc273b` |
| `assets/sfx-match.ogg` | 6958 | `c5a402a5e0525c6e8ac72d857f7cf3b3b2fd1179ab391e75cbcf90528b7da672` |
| `assets/sfx-match.mp3` | 4628 | `6bdf36a273ce2e2824e2467416d8bc15a6bb1dd327a826fa2b777271f5d130b9` |
| `assets/sfx-cascade.ogg` | 7540 | `6ea7c0aa516491416630249e22bf43f5b14610cf162b84265d2acc2faba4a6f4` |
| `assets/sfx-cascade.mp3` | 5780 | `e7ec724fa558a2b5ae3b5fe51c136b04aff22128367e02135e76f27a6991dc70` |
| `assets/sfx-special-line.ogg` | 8862 | `e2960b118e174a9d069c4647e006c58f53369680e2a9a3e09f79133c5b10d8b0` |
| `assets/sfx-special-line.mp3` | 7316 | `a32dee5eb029820fe4962051dd1a82a4c92ad447f8af4b939082a192566f143a` |
| `assets/sfx-special-rainbow.ogg` | 11160 | `984588980d675dad30f28f65de7feff50543ddc35a4ab71947ce51afc938a56f` |
| `assets/sfx-special-rainbow.mp3` | 10388 | `6382b765cefdbf15bd5ecf6d57b524755ef9a60509951346e93481e38f71c836` |
| `assets/sfx-ice-break.ogg` | 7519 | `2c3f090b39682cfe9156e8895eeaa4b5d8f822c57a63fe65133e2a9c437747b1` |
| `assets/sfx-ice-break.mp3` | 5780 | `96738373c43982e02ca0f159e31ccf2ecd77463c344f872bdafc0a20ebe8f5aa` |
| `assets/sfx-stone-break.ogg` | 8209 | `3b133f516f2dd5d21dd5b8c0c997953fdf27997682e905f84fd9260b4b8a9652` |
| `assets/sfx-stone-break.mp3` | 6548 | `722f42de7b7aedba3aec405e26d7de3f669b4798245db5dd3f46299ea9c70188` |
| `assets/sfx-shuffle.ogg` | 10135 | `c237c2889fdca45f68cc17343b167ad15be9a16929af24709fc669987707105d` |
| `assets/sfx-shuffle.mp3` | 8852 | `b5e208829dc5f5595194ece684479243c42ec8c0d6428d49c861817e8b394ae8` |
| `assets/sfx-star.ogg` | 9315 | `d3551be466ad6ff5b5c45514e9e5bef14fee25038b3ffd27d3630f37a430d082` |
| `assets/sfx-star.mp3` | 8852 | `477b9ccad49f70199127ecce107733045a84fb9764c59f52f98c06718dd234eb` |
| `assets/sfx-win.ogg` | 20525 | `43220094c34cbbb8cfb109a3d98c8bb43188e36d7ea3b91cb9bc280934a57961` |
| `assets/sfx-win.mp3` | 24980 | `42b96131dc5f62bb844cf16c6499b8b08673c4fe016c98c9142fe3d6ff4a3748` |
| `assets/sfx-lose.ogg` | 16524 | `adf6f35fd29958a4af11a2046576d733d8fb54d575deba9b706ba4d4248a48dd` |
| `assets/sfx-lose.mp3` | 19988 | `9903cbd7cfd1a7b72157ba4bcd017c35d7bd5334a22f1e68e7fa641524ff1c43` |
| `assets/sfx-click.ogg` | 4909 | `b8a560c71173ee90624095a7be0d4f81776cb41a84b349d865a853f38bb95db0` |
| `assets/sfx-click.mp3` | 1940 | `a45dd27c375d9869c2100ae4a477476035e949a350190a8a776873dfbb792bfd` |

机器可读版本：`assets/checksums.json`（由 `verify_assets.py` 生成，键为文件名）。
