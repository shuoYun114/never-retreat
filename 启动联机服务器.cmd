@echo off
chcp 65001 >nul
title Never Retreat 联机服务端 (18080)
cd /d "%~dp0server"
set PORT=18080
netstat -ano | findstr /r /c:":18080 .*LISTENING" >nul
if not errorlevel 1 (
  echo 联机服务端已经在运行： http://localhost:18080/api/health
  echo 不要重复启动。
  pause
  exit /b 0
)
echo 正在启动联机服务端（账号 / 房间 / 伤害裁定）...
echo 本机地址： http://localhost:18080
echo 健康检查： http://localhost:18080/api/health
echo 客户端请另外运行「启动客户端.cmd」（18081）。
echo 请保持这个窗口打开。
echo.
node server.js
pause
