@echo off
chcp 65001 >nul
title Never Retreat 客户端 (18081)
cd /d "%~dp0client"
set PORT=18081
netstat -ano | findstr /r /c:":18081 .*LISTENING" >nul
if not errorlevel 1 (
  echo 客户端已经在运行： http://localhost:18081
  pause
  exit /b 0
)
echo 正在启动客户端静态服务...
echo 打开游戏： http://localhost:18081
echo 联机服务端地址会自动取同主机的 18080，无需改配置。
echo 请保持这个窗口打开。
echo.
node serve.js
pause
