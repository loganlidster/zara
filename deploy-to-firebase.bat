@echo off
echo ========================================
echo   Deploying TRADIAC to Firebase
echo ========================================
echo.

REM Build the web UI
echo Building Web UI...
cd web-ui
call npm install
call npm run build
cd ..

echo.
echo Build complete! Deploying to Firebase...
echo.

REM Deploy to Firebase
firebase deploy --only hosting

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo Your site is live at:
echo https://tradiac-testing.web.app
echo.
echo Next step: Connect custom domain tradiac.co
echo.
pause