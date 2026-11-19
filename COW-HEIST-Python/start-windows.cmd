@echo off
cd /d "%~dp0"
if exist "runtime\python.exe" (
  "runtime\python.exe" -E -s -B main.py
  if errorlevel 1 goto failed
  exit /b 0
)
where py.exe >nul 2>nul
if errorlevel 1 (
  echo Install Python 3.12 from https://www.python.org/downloads/windows/
  echo Keep the Python launcher enabled, then open this file again.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  py -3.12 -m venv .venv
  if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" -c "import pygame" >nul 2>nul
if errorlevel 1 (
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" main.py
if errorlevel 1 goto failed
exit /b 0
:failed
echo Startup failed. Review the error above and see README.md.
pause
exit /b 1
