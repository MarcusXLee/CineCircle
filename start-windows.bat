@echo off
rem Double-click to set up (first time) and open CineCircle.
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org, then run this file again.
  pause
  exit /b 1
)
call npm start
if errorlevel 1 pause
