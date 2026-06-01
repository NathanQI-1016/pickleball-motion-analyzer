@echo off
setlocal
cd /d "%~dp0"

echo Building frontend...
npm.cmd run build
if errorlevel 1 (
  echo ERROR: Build failed.
  pause
  exit /b 1
)

where vercel >nul 2>nul
if errorlevel 1 (
  echo Vercel CLI not found in PATH. Using npx vercel...
  npx.cmd vercel --prod
) else (
  vercel --prod
)

pause
