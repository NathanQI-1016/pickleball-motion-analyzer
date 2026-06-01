@echo off
setlocal
set "GH=C:\Program Files\GitHub CLI\gh.exe"

if not exist "%GH%" (
  echo ERROR: GitHub CLI was not found at:
  echo %GH%
  pause
  exit /b 1
)

"%GH%" auth login
pause
