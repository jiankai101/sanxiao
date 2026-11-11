# 性能与发布验收（TASK-037）

日期：2026-11-11 ｜ 环境：Windows / Node v24.15.0 / Chromium（系统 Chrome，Playwright channel=chrome）/ 视口 1280×800

## 1. 构建体积（生产构建）

| 指标 | 实测 | 上限 | 结论 |
|---|---:|---:|---|
| 初始 JS（gzip） | 66.9 KB | 200 KB | PASS |
| CSS（gzip） | 2.0 KB | — | — |
| 首屏图片合计 | 40.5 KB | 1.2 MB | PASS |
| 首屏 gzip 估算（JS+CSS+首屏图片） | ≈ 109.4 KB | 3.0 MB | PASS |
| `dist/` 总大小（含 BGM/SFX 全部音频） | 2.06 MB | — | — |
| 第三方域名请求 | 0 | 0 | PASS |

> BGM 在首次用户手势后才 fetch/decode，不计入首屏传输。

## 2. 帧率（3 秒对局采样，环形缓冲 600 帧）

| 指标 | 实测 | 预算 | 结论 |
|---|---:|---:|---|
| p95 帧间隔 | 4.3 ms | ≤ 20 ms | PASS |
| < 50fps 帧占比 | 0 | ≤ 5% | PASS |
| 样本数 | 600 | ≥ 100 | PASS |

命令：`npx playwright test tests/e2e/audio-network.spec.ts`
断言：`p95 <= 20`、`samples > 60`。

## 3. 覆盖率（CR-005）

`npm run test:coverage`（provider v8，`include = src/core/**`，阈值行 80 / 分支 70）：

| 指标 | 实测 | 门槛 |
|---|---:|---:|
| 行覆盖率 | 91.47% | ≥ 80% |
| 分支覆盖率 | 88.76% | ≥ 70% |

原始数据：`coverage/coverage-summary.json`。

## 4. 静态托管

- `npm run build` → `dist/`；`npx vite preview --host 127.0.0.1 --port 4173` 可打开。
- E2E 全流程无 console error（已修复 favicon 404）。
- `dist/index.html` 使用相对路径 `./assets/...`，可部署到任意子目录。

## 5. 与 spec 的偏差/限制

- Lighthouse Performance/Accessibility/Best Practices 未在本机执行（未安装 Lighthouse CLI），需补跑后归档截图。
- 帧率数据来自无头 Chrome，真机移动端需按 plan 17.4 手工复核。
