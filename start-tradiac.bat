@echo off
echo.
echo ========================================
echo   Starting TRADIAC Platform
echo ========================================
echo.

REM Start API Server in new window
echo Starting API Server (Port 3001)...
start "TRADIAC API Server" cmd /k "cd /d %~dp0api-server && npm start"

REM Wait 3 seconds for API to start
timeout /t 3 /nobreak >nul

REM Start Frontend in new window
echo Starting Frontend (Port 3000)...
start "TRADIAC Frontend" cmd /k "cd /d %~dp0web-ui && npm run dev"

REM Wait 2 seconds
timeout /t 2 /nobreak >nul

REM Open browser
echo Opening browser...
start http://localhost:3000

echo.
echo ========================================
echo   TRADIAC Platform Started!
echo ========================================
echo.
echo API Server: http://localhost:3001
echo Frontend:   http://localhost:3000
echo.
echo Press any key to exit this window...
echo (The API and Frontend will keep running)
pause >nul