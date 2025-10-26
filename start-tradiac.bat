@echo off
echo ========================================
echo   TRADIAC Platform Launcher
echo ========================================
echo.
echo Starting API Server and Web UI...
echo.

REM Start API Server in new window
start "TRADIAC API Server" cmd /k "cd api-server && npm install && node server.js"

REM Wait 3 seconds for API to start
timeout /t 3 /nobreak > nul

REM Start Web UI in new window
start "TRADIAC Web UI" cmd /k "cd web-ui && npm install && npm run dev"

echo.
echo ========================================
echo   TRADIAC is starting!
echo ========================================
echo.
echo API Server: http://localhost:3001
echo Web UI: http://localhost:3000
echo.
echo Press any key to open Web UI in browser...
pause > nul

REM Open browser
start http://localhost:3000

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause