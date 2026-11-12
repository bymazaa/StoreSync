@echo off
setlocal
title StockPilot POS Server
cd /d "%~dp0"

:: 1. Free port 3000 if an old instance was left running
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)

:: 2. Detect pnpm or npm
where pnpm >nul 2>&1
if not errorlevel 1 (
  set "RUNNER=pnpm"
) else (
  set "RUNNER=npm"
)

:: 3. Check if production build exists
if not exist ".next" (
  cls
  echo ===================================================
  echo          StockPilot First-time Setup
  echo ===================================================
  echo [INFO] Production build not found. Building project...
  echo Please wait a moment...
  echo.
  call %RUNNER% run build
  if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Please check errors above.
    pause
    exit /b 1
  )
  echo.
  echo [OK] Build completed!
  echo.
)

:: 4. Check Database Connection
:check_db
echo [*] Checking database connection...
node scripts\check-db.js > "%TEMP%\stockpilot_db_err.tmp" 2>&1
if not errorlevel 1 (
  del "%TEMP%\stockpilot_db_err.tmp" >nul 2>&1
  goto db_ok
)

cls
echo =====================================================================
echo                  [!] DATABASE CONNECTION FAILED
echo =====================================================================
echo.
echo  Could not connect to your Cloud Database (MongoDB Atlas).
echo.
echo  Technical details:
type "%TEMP%\stockpilot_db_err.tmp"
echo.
echo ---------------------------------------------------------------------
echo  SOLUTIONS FOR MOBILE HOTSPOT / WIFI:
echo.
echo  1. (MOST COMMON) Whitelist All IPs in MongoDB Atlas:
echo     - Log in to https://cloud.mongodb.com
echo     - Go to: Security -^> Network Access
echo     - Click "Add IP Address"
echo     - Click "Allow Access From Anywhere" (IP: 0.0.0.0/0)
echo     - Click "Confirm"
echo.
echo  2. Mobile Hotspot DNS issue:
echo     - Mobile SIM internet often blocks MongoDB SRV records.
echo     - Change your Wi-Fi/adapter DNS to Google DNS (8.8.8.8 and 8.8.4.4).
echo =====================================================================
echo.
echo   [R] Press R to Retry connection
echo   [E] Press E to Exit
echo.
choice /c RE /n /m "Choose [R to Retry, E to Exit]: "
if errorlevel 2 exit /b 1
cls
goto check_db

:db_ok
cls
echo ===================================================
echo               StockPilot POS Server
echo ===================================================
echo  Database: CONNECTED (MongoDB Atlas)
echo  Status:   RUNNING at http://localhost:3000
echo  Browser:  Opened automatically!
echo.
echo  TO STOP THE APP:
echo   - Press Ctrl + C in this terminal, OR
echo   - Simply close this window
echo ===================================================
echo.

:: Open browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Start the server in this window
call %RUNNER% start

:: Cleanup when server exits
echo.
echo Stopping server and freeing port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo StockPilot stopped.
echo.
pause
