@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title 三消小游戏 - 停止服务
set "PIDFILE=%~dp0.game-server.pid"
set "KILLED=0"

echo ============================================================
echo   三消小游戏 停止器
echo   项目目录: %~dp0
echo ============================================================
echo.

rem ---------- 1. 优先按 PID 文件精准停止 ----------
if not exist "%PIDFILE%" goto :scan_ports
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

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-Process -Id %OLDPID% -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -like 'python*') { exit 0 } else { exit 1 }"
if errorlevel 1 goto :pid_stale

echo [停止] 结束游戏服务进程 PID=%OLDPID%（端口 %OLDPORT%）...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-Process -Id %OLDPID% -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id %OLDPID% -Force -ErrorAction SilentlyContinue; try { $p.WaitForExit(5000) | Out-Null } catch { } }"
set "KILLED=1"
del "%PIDFILE%" >nul 2>nul
goto :scan_ports

:pid_invalid
echo [提示] .game-server.pid 内容无效，忽略并改为按端口清理。
del "%PIDFILE%" >nul 2>nul
goto :scan_ports

:pid_stale
echo [提示] PID=%OLDPID% 已不在运行，删除 PID 文件后按端口复查。
del "%PIDFILE%" >nul 2>nul
goto :scan_ports

rem ---------- 2. 回退：按端口找 LISTENING 进程 ----------
:scan_ports
for %%P in (4173 5173 8080) do (
  for /f "tokens=5" %%B in ('netstat -ano ^| findstr /c:":%%P " ^| findstr /i "LISTENING"') do (
    echo [停止] 端口 %%P 被 PID=%%B 占用，正在结束 ...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Stop-Process -Id %%B -Force -ErrorAction SilentlyContinue"
    set "KILLED=1"
  )
)

rem ---------- 3. 停止后验证 ----------
echo [验证] 检查端口释放与 HTTP 不可访问（超时 2 秒）...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$bad = 0; foreach ($p in 4173,5173,8080) { $listen = netstat -ano | Select-String ('[:]' + $p + '\s') | Select-String 'LISTENING'; if ($listen) { Write-Output ('[警告] 端口 ' + $p + ' 仍有 LISTENING 连接'); $bad++ } else { try { Invoke-WebRequest -Uri ('http://127.0.0.1:' + $p + '/') -UseBasicParsing -TimeoutSec 2 | Out-Null; Write-Output ('[警告] 端口 ' + $p + ' 仍可访问（HTTP 未失败）'); $bad++ } catch { Write-Output ('[OK] 端口 ' + $p + ' 已无监听，HTTP 请求失败'); } } }; exit $bad"
set "VERIFY_FAIL=%errorlevel%"

if "%KILLED%"=="1" goto :stopped

if not "%VERIFY_FAIL%"=="0" goto :verify_failed
echo.
echo [未在运行] 未检测到游戏服务：4173/5173/8080 均无监听，HTTP 请求失败。
if exist "%PIDFILE%" del "%PIDFILE%" >nul 2>nul
goto :finish

:stopped
if not "%VERIFY_FAIL%"=="0" goto :verify_failed
if exist "%PIDFILE%" del "%PIDFILE%" >nul 2>nul
echo.
echo [完成] 游戏服务已停止：进程已结束、端口已释放、HTTP 不可访问、PID 文件已删除。
goto :finish

:verify_failed
echo.
echo [错误] 停止后验证失败（见上方警告），请检查端口占用后重试。
goto :fail

:fail
echo 按任意键关闭窗口 ...
pause >nul
exit /b 1

:finish
echo 按任意键关闭窗口 ...
pause >nul
exit /b 0
