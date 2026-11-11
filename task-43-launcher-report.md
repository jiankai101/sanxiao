# TASK-43 交付：start-game.cmd / stop-game.cmd

范围：仅新增启动/停止脚本（+ `.gitignore` 一行、`.game-server.pid` 运行时文件）；未修改 src/specs/tests/assets/构建配置。

## 1. 修改文件清单

| 文件 | 说明 |
| --- | --- |
| `start-game.cmd`（新增，7401 B） | UTF-8 无 BOM + CRLF；`chcp 65001` → `cd /d "%~dp0"`；已有实例检测、dist 过期检测与构建、端口选择、后台启动、HTTP 自检、打开浏览器 |
| `stop-game.cmd`（新增，3637 B） | 同上编码约定；按 PID 精准停止 → 端口回退扫描 → 停止后验证（无 LISTENING + HTTP 失败）→ 删除 PID 文件 |
| `.gitignore`（追加一行） | `.game-server.pid` |
| `dist/`（重新生成） | 实测第 7 步触发 `npm run build` 的构建产物，git 忽略目录，不属于源码改动 |

未改动：`src/`、`specs/`、`tests/`、`assets/`、`package.json`、`vite.config.ts`、`vitest.config.ts`、`playwright.config.ts`。

## 2. 实测记录（命令均为 `cmd /c <脚本>`）

> 为不在测试期间抢占桌面焦点，实测统一设置 `GAME_NO_BROWSER=1`（仅跳过 `start "" <url>`，其余流程完全一致）。

### 2.1 首次启动（dist 已最新）

```
[最新] dist 构建于 2026-11-11 05:15:04
[端口] 使用端口 4173
[进程] PID=12868
[自检] HTTP 200 OK
[成功] 地址: http://127.0.0.1:4173/   PID : 12868
EXITCODE=0
```

旁证：`.game-server.pid` = `12868` / `4173`；`netstat -ano` 显示 `127.0.0.1:4173 LISTENING 12868`；`Invoke-WebRequest` 返回 `status=200 bytes=2651`（即 `dist\index.html`）。

### 2.2 重复启动（关键行）

```
[已在运行] 检测到游戏服务正在运行（PID=12868，端口=4173），不重复启动。
           地址: http://127.0.0.1:4173/
EXITCODE=0
```

旁证：python 进程数量仍为 1，PID 文件未被改写。

### 2.3 停止（关键行）

```
[停止] 结束游戏服务进程 PID=12868（端口 4173）...
[OK] 端口 4173 已无监听，HTTP 请求失败
[OK] 端口 5173 已无监听，HTTP 请求失败
[OK] 端口 8080 已无监听，HTTP 请求失败
[完成] 游戏服务已停止：进程已结束、端口已释放、HTTP 不可访问、PID 文件已删除。
EXITCODE=0
```

旁证：进程数 0；`.game-server.pid` 不存在；HTTP 请求 2s 内失败；端口无 LISTENING。

### 2.4 未运行时执行 stop

```
[未在运行] 未检测到游戏服务：4173/5173/8080 均无监听，HTTP 请求失败。
EXITCODE=0
```

### 2.5 端口回退（先用 python 占用 4173，PID=38108）

```
[端口] 使用端口 5173
[进程] PID=40568
[自检] HTTP 200 OK
```

随后 stop：

```
[停止] 结束游戏服务进程 PID=40568（端口 5173）...
[停止] 端口 4173 被 PID=38108 占用，正在结束 ...
[OK] 端口 4173 已无监听，HTTP 请求失败
[OK] 端口 5173 已无监听，HTTP 请求失败
[OK] 端口 8080 已无监听，HTTP 请求失败
EXITCODE=0
```

### 2.6 dist 过期 → 构建失败保护

把 `dist\index.html` 修改时间回拨到 2026-11-01 后启动：

```
[过期] 源码最新修改 2026-11-11 04:33:19，dist 构建于 2026-11-01 00:00:00
[构建] dist 缺失或已过期，执行 npm run build ...
（沙箱内 esbuild 报 spawn EPERM）
[错误] npm run build 失败，已停止启动（不会用旧的 dist 目录顶替）。
EXITCODE=1
```

未启动服务、未写 PID 文件 —— 构建失败保护有效。

### 2.7 dist 过期 → 构建成功（授权沙箱外执行 npm）

```
[构建] 构建完成: dist\index.html
[自检] HTTP 200 OK
[进程] PID=3444
EXITCODE=0
```

`dist\index.html` 更新为 2026-11-11 09:39:17（bundle `index-BYy1LG2g.js`），vite 输出 `✓ built in 686ms`。

### 2.8 浏览器可用性旁证（Playwright + 系统 Chrome headless 访问 4173）

```json
{"status":200,"title":"三消小游戏 · 8 关","heading":"选择关卡","cards":8,"canvas":1,"errors":[]}
```

页面 200、标题正确、8 张关卡卡片、canvas 存在、无 console 报错。

## 3. 使用说明（一段话）

双击 `start-game.cmd`：脚本自动切到自身目录，校验 `dist`（缺失/过期则 `npm run build`，构建失败直接报错退出，不会用旧包启动），按 4173→5173→8080 选空闲端口，用 `python -m http.server` 后台隐藏运行并写入 `.game-server.pid`（PID + 端口），自检 HTTP 200 后用默认浏览器打开；再次双击只提示“已在运行”。停止双击 `stop-game.cmd`：优先按 PID 精准 `Stop-Process`，PID 文件缺失/失效时回退按三个端口的 LISTENING 进程清理，最后验证端口无监听且 HTTP 失败并删除 PID 文件；本来没运行会提示“未在运行”并成功退出。常见问题：① 构建报“未找到 npm”→ 安装 Node.js LTS 后重开脚本；② 报“未找到可用的 python”→ 安装 Python 3 并勾选 Add to PATH，或确保 `py -3` 可用；③ 三端口全被占用→ 关闭占用程序再启动；④ 自动化/远程调试时设 `GAME_NO_BROWSER=1` 跳过自动打开浏览器；⑤ 手工删除 `.game-server.pid` 后再点 start 可能在下一个端口起第二个实例，先跑一次 `stop-game.cmd` 用端口回退清理即可。

## 4. 已知限制

- `GAME_NO_BROWSER=1` 为测试便利开关，仅跳过 `start "" <url>`，不影响其他流程。
- 毫秒级并发双击存在理论竞态：PID 文件在进程启动后才写入；顺序重复启动已验证不会起第二个实例。
- stop 的端口回退按任务要求会结束 4173/5173/8080 上任意 LISTENING 进程（实测中清理了测试用 4173 服务），这些端口若被其他程序占用需注意。
- 停止后端口处于 TIME_WAIT，个别情况下 HTTP 探测表现为 2s 超时而非立即拒绝，同样判定为“HTTP 失败”。