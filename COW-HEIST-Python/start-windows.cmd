@echo off
cd /d "%~dp0"
if exist "runtime\python.exe" if /I not "%~1"=="--camera" (
  "runtime\python.exe" -E -s -B main.py
  if errorlevel 1 goto failed
  exit /b 0
)
if not exist ".venv\Scripts\python.exe" (
  py -3.12 -m venv .venv
  if errorlevel 1 goto failed
)
set "DEPS=requirements.txt"
set "CHECK=import pygame"
if /I "%~1"=="--camera" (
  set "DEPS=requirements-camera.txt"
  set "CHECK=import pygame, cv2, mediapipe"
)
".venv\Scripts\python.exe" -c "%CHECK%" >nul 2>nul
if errorlevel 1 (
  ".venv\Scripts\python.exe" -m pip install -r "%DEPS%"
  if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" main.py %*
if errorlevel 1 goto failed
exit /b 0
:failed
echo Startup failed. Review the error above and see README.md.
pause
exit /b 1
