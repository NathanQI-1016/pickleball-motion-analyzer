@echo off
setlocal
cd /d "%~dp0"
set "GH=C:\Program Files\GitHub CLI\gh.exe"
set "REPO_NAME=pickleball-motion-analyzer"

if not exist "%GH%" (
  echo ERROR: GitHub CLI was not found at:
  echo %GH%
  pause
  exit /b 1
)

"%GH%" auth status
if errorlevel 1 (
  echo ERROR: GitHub CLI is not logged in. Run github_login.bat first.
  pause
  exit /b 1
)

git -c safe.directory=* status --short
git -c safe.directory=* branch -M main

"%GH%" repo view "%REPO_NAME%" >nul 2>nul
if errorlevel 1 (
  "%GH%" repo create "%REPO_NAME%" --public --source . --remote origin --push
) else (
  git remote remove origin >nul 2>nul
  "%GH%" repo set-default "%REPO_NAME%"
  git remote add origin "https://github.com/%USERNAME%/%REPO_NAME%.git"
  git -c safe.directory=* push -u origin main
)

pause
