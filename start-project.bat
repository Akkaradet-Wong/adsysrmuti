@echo off
title Project Auto Starter
echo ===================================================
echo Starting Project-end (Backend and Frontend)
echo ===================================================

echo [1/2] Starting Backend...
start "Backend Server" cmd /k "cd backend && npm start"

echo [2/2] Starting Frontend...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo Done! Both servers are starting in new windows.
echo You can now close this window.
timeout /t 3 >nul
