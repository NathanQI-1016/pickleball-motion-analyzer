@echo off
setlocal

set "PROJECT_REAL=%~dp0"
set "APP_DRIVE=P:"

echo [Pickleball Motion Analyzer] Preparing ASCII runtime path
subst %APP_DRIVE% >nul 2>nul
if not errorlevel 1 (
  subst %APP_DRIVE% /d >nul 2>nul
)
subst %APP_DRIVE% "%PROJECT_REAL%"
if errorlevel 1 (
  echo ERROR: Failed to map project folder to %APP_DRIVE%.
  echo If %APP_DRIVE% is already used, disconnect it or change APP_DRIVE in this file.
  pause
  exit /b 1
)

cd /d %APP_DRIVE%\

set "PYTHON=.venv\Scripts\python.exe"

echo [Pickleball Motion Analyzer] Starting backend
echo Project: %cd%
echo.

if not exist "%PYTHON%" (
  echo ERROR: %PYTHON% was not found.
  echo Run rebuild_env_py311.bat first.
  pause
  exit /b 1
)

echo Python path:
"%PYTHON%" -c "import sys; print(sys.executable)"
if errorlevel 1 (
  echo ERROR: Could not run venv Python.
  echo Run rebuild_env_py311.bat first.
  pause
  exit /b 1
)

echo Python version:
"%PYTHON%" --version

echo.
echo Checking mediapipe import...
"%PYTHON%" -c "import mediapipe as mp; print('mediapipe OK:', mp.__version__)"
if errorlevel 1 (
  echo ERROR: mediapipe import failed.
  echo Run rebuild_env_py311.bat, then start this file again.
  pause
  exit /b 1
)

echo.
echo Backend URL: http://127.0.0.1:8000
echo Frontend URL: http://127.0.0.1:8000
echo.
"%PYTHON%" -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
subst %APP_DRIVE% /d >nul 2>nul
pause
