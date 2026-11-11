@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title 三消小游戏 - 启动服务
set "PIDFILE=%~dp0.game-server.pid"
set "PORT="
set "NEED_BUILD=0"

echo ============================================================
echo   三消小游戏 本地启动器
echo   项目目录: %~dp0
echo ============================================================
echo.

rem ---------- 1. 已有实例检测 ----------
if not exist "%PIDFILE%" goto :check_dist
set "OLDPID="
set "OLDPORT="
for /f "usebackq delims=" %%A in ("%PIDFILE%") do (
  if not defined OLDPID (
    set "OLDPID=%%A"
  ) else if not defined OLDPORT (
    set "OLDPORT=%%A"
  )
)
if not defined OLDPID goto :pid_invalid
echo %OLDPID%| findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 goto :pid_invalid
if not defined OLDPORT goto :pid_invalid
echo %OLDPORT%| findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 goto :pid_invalid

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-Process -Id %OLDPID% -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -like 'python*') { exit 0 } else { exit 1 }"
if errorlevel 1 goto :pid_stale

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri ('http://127.0.0.1:%OLDPORT%/') -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto :pid_unhealthy

echo [已在运行] 检测到游戏服务正在运行（PID=%OLDPID%，端口=%OLDPORT%），不重复启动。
echo            地址: http://127.0.0.1:%OLDPORT%/
call :open_browser "http://127.0.0.1:%OLDPORT%/"
echo            如需停止，请双击 stop-game.cmd
goto :finish

:pid_invalid
echo [清理] .game-server.pid 内容无效，删除后重新启动。
del "%PIDFILE%" >nul 2>nul
goto :check_dist

:pid_stale
echo [清理] PID=%OLDPID% 已不在运行，删除过期记录后重新启动。
del "%PIDFILE%" >nul 2>nul
goto :check_dist

:pid_unhealthy
echo [清理] PID=%OLDPID% 进程存在但 HTTP 自检失败，先结束它再重新启动。
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-Process -Id %OLDPID% -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -like 'python*') { Stop-Process -Id %OLDPID% -Force }"
del "%PIDFILE%" >nul 2>nul
goto :check_dist

rem ---------- 2. dist 过期检测 ----------
:check_dist
echo [检查] 校验 dist 是否为最新构建 ...
if not exist "dist\index.html" set "NEED_BUILD=1"
if "%NEED_BUILD%"=="1" goto :do_build
powershell -NoProfile -ExecutionPolicy Bypass -Command "$dist = (Get-Item -LiteralPath 'dist\index.html').LastWriteTime; $newest = (Get-ChildItem -LiteralPath 'src' -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime; foreach ($f in @('index.html','vite.config.ts','package.json')) { $i = Get-Item -LiteralPath $f -ErrorAction SilentlyContinue; if ($i -and $i.LastWriteTime -gt $newest) { $newest = $i.LastWriteTime } }; if ($newest -gt $dist) { Write-Output ('[过期] 源码最新修改 ' + $newest.ToString('yyyy-MM-dd HH:mm:ss') + '，dist 构建于 ' + $dist.ToString('yyyy-MM-dd HH:mm:ss')); exit 1 } else { Write-Output ('[最新] dist 构建于 ' + $dist.ToString('yyyy-MM-dd HH:mm:ss')); exit 0 }"
if errorlevel 1 set "NEED_BUILD=1"
if "%NEED_BUILD%"=="1" goto :do_build
goto :pick_port

:do_build
echo [构建] dist 缺失或已过期，执行 npm run build ...
where npm >nul 2>nul
if errorlevel 1 goto :no_npm
call npm run build
if errorlevel 1 goto :build_failed
echo [构建] 构建完成: dist\index.html
goto :pick_port

:no_npm
echo [错误] 未找到 npm 命令。请先安装 Node.js（建议 LTS 版本，https://nodejs.org/），安装后重新打开本脚本。
goto :fail

:build_failed
echo [错误] npm run build 失败，已停止启动（不会用旧的 dist 目录顶替）。
goto :fail

rem ---------- 3. 端口选择 ----------
:pick_port
echo [检查] 从 4173 / 5173 / 8080 中选择可用端口 ...
for %%P in (4173 5173 8080) do (
  if not defined PORT (
    netstat -ano | findstr /c:":%%P " | findstr /i "LISTENING" >nul 2>nul
    if errorlevel 1 set "PORT=%%P"
  )
)
if not defined PORT goto :no_port
echo [端口] 使用端口 %PORT%

rem ---------- 4. 定位 python ----------
set "PYEXE="
set "PYARG="
where python >nul 2>nul
if errorlevel 1 goto :try_py
python -c "import sys" >nul 2>nul
if not errorlevel 1 set "PYEXE=python"
if defined PYEXE goto :have_python

:try_py
where py >nul 2>nul
if errorlevel 1 goto :no_python
py -3 -c "import sys" >nul 2>nul
if errorlevel 1 goto :no_python
set "PYEXE=py"
set "PYARG=-3"

:have_python
rem ---------- 5. 后台启动服务器 ----------
echo [启动] 用 %PYEXE% 后台启动静态服务器（目录 dist，绑定 127.0.0.1）...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$argList = @('%PYARG%','-m','http.server','%PORT%','--directory','dist','--bind','127.0.0.1') | Where-Object { $_ -ne '' }; $p = Start-Process -FilePath '%PYEXE%' -ArgumentList $argList -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru; Set-Content -LiteralPath '.game-server.pid' -Value @($p.Id, '%PORT%') -Encoding ASCII; Write-Output ('[进程] PID=' + $p.Id)"
if errorlevel 1 goto :start_failed

echo [自检] 等待 http://127.0.0.1:%PORT%/ 返回 200 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(15); $ok = $false; $code = 0; while ((Get-Date) -lt $deadline) { try { $r = Invoke-WebRequest -Uri ('http://127.0.0.1:%PORT%/') -UseBasicParsing -TimeoutSec 2; $code = [int]$r.StatusCode; if ($code -eq 200) { $ok = $true; break } } catch { }; Start-Sleep -Milliseconds 300 }; if ($ok) { Write-Output ('[自检] HTTP ' + $code + ' OK'); exit 0 } else { Write-Output '[自检] 15 秒内未拿到 HTTP 200'; exit 1 }"
if errorlevel 1 goto :http_failed

set "NEWPID="
for /f "usebackq delims=" %%A in ("%PIDFILE%") do if not defined NEWPID set "NEWPID=%%A"

echo.
echo [成功] 游戏服务已启动
echo        地址: http://127.0.0.1:%PORT%/
echo        PID : %NEWPID%
echo        停止: 双击 stop-game.cmd
echo.
call :open_browser "http://127.0.0.1:%PORT%/"
goto :finish

:http_failed
echo [错误] 启动后 HTTP 自检失败，结束进程并清理。
powershell -NoProfile -ExecutionPolicy Bypass -Command "$id = Get-Content -LiteralPath '.game-server.pid' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($id) { Stop-Process -Id ([int]$id) -Force -ErrorAction SilentlyContinue }"
del "%PIDFILE%" >nul 2>nul
goto :fail

:start_failed
echo [错误] 无法启动 python 进程，请检查 python 是否可用。
goto :fail

:no_port
echo [错误] 端口 4173、5173、8080 全部被占用，请先关闭占用这些端口的程序后重试。
goto :fail

:no_python
echo [错误] 未找到可用的 python。请安装 Python 3（安装时勾选 Add Python to PATH），或确认 py -3 可用，然后重新运行本脚本。
goto :fail

:fail
echo.
echo 按任意键关闭窗口 ...
pause >nul
exit /b 1

:finish
echo.
echo 按任意键关闭窗口 ...
pause >nul
exit /b 0

:open_browser
if /i "%GAME_NO_BROWSER%"=="1" (
  echo [信息] 已设置 GAME_NO_BROWSER=1，跳过自动打开浏览器。
) else (
  start "" %~1
)
exit /b 0
