@echo off
echo ========================================
echo   Stopping TRADIAC Platform
echo ========================================
echo.

REM Kill Node.js processes
taskkill /F /IM node.exe /T 2>nul

echo.
echo All TRADIAC servers stopped.
echo.
pause