@echo off
setlocal
cd /d "%~dp0"

set "PY311=C:\Users\琪哥\AppData\Local\Programs\Python\Python311\python.exe"

echo [Pickleball Motion Analyzer] Rebuilding Python 3.11 environment
echo Project: %cd%
echo Python 3.11: %PY311%
echo.

if not exist "%PY311%" (
  echo ERROR: Python 3.11 was not found at:
  echo %PY311%
  pause
  exit /b 1
)

if exist ".venv" (
  echo Removing old root .venv...
  rmdir /s /q ".venv"
)

if exist "backend\.venv" (
  echo Removing old backend .venv...
  rmdir /s /q "backend\.venv"
)

echo Creating .venv with Python 3.11...
"%PY311%" -m venv .venv
if errorlevel 1 (
  echo ERROR: Failed to create .venv.
  pause
  exit /b 1
)

echo.
echo Python path:
".venv\Scripts\python.exe" -c "import sys; print(sys.executable)"
echo Python version:
".venv\Scripts\python.exe" --version

echo.
echo Upgrading pip, setuptools, wheel...
".venv\Scripts\python.exe" -m pip install --upgrade pip setuptools wheel
if errorlevel 1 (
  echo ERROR: Failed to upgrade pip tools.
  pause
  exit /b 1
)

if not exist "backend\requirements.txt" (
  echo Creating backend\requirements.txt...
  > "backend\requirements.txt" echo fastapi
  >> "backend\requirements.txt" echo uvicorn[standard]
  >> "backend\requirements.txt" echo python-multipart
  >> "backend\requirements.txt" echo mediapipe
  >> "backend\requirements.txt" echo opencv-python
  >> "backend\requirements.txt" echo ultralytics
  >> "backend\requirements.txt" echo numpy
  >> "backend\requirements.txt" echo pandas
  >> "backend\requirements.txt" echo matplotlib
)

echo.
echo Installing backend requirements...
".venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 (
  echo ERROR: Failed to install requirements.
  pause
  exit /b 1
)

echo.
echo Verifying analysis imports...
".venv\Scripts\python.exe" -c "import cv2, mediapipe, ultralytics, numpy, pandas, fastapi, uvicorn; print('All imports OK')"
if errorlevel 1 (
  echo ERROR: Some imports failed.
  pause
  exit /b 1
)

echo.
echo Environment is ready. Run start_server.bat next.
pause
