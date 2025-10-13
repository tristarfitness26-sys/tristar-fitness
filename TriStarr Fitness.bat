@echo off
title TriStar Fitness Application
REM Set custom icon for the batch file window
if exist "tristar_icon.ico" (
    powershell -Command "& {Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)}" 2>nul
)
echo.
echo ========================================
echo    TriStar Fitness Application
echo ========================================
echo.
echo Starting TriStar Fitness...
echo.
echo IMPORTANT: This will start the application.
echo Make sure you have Node.js installed!
echo.
echo Login: manager@tristar / manager@tristarfitness
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak >nul
echo.
echo Starting application...
echo.
python tristar.py
echo.
echo Application stopped.
pause
