@echo off
setlocal
title StockPilot POS Control Hub
cd /d "%~dp0\.."

:: Detect pnpm or npm
where pnpm >nul 2>&1
if not errorlevel 1 (
  set "RUNNER=pnpm"
) else (
  set "RUNNER=npm"
)

:main_menu
cls
echo =====================================================================
echo                   STOCKPILOT POS CONTROL HUB
echo =====================================================================
echo.
echo   [1] Start StockPilot POS Application
echo   [2] View Admin and Staff Account Details (Read-only)
echo   [3] Reset Admin Password
echo   [4] Change Admin / Staff Email
echo   [5] Database Reset (Fresh DB or Demo Data)
echo   [6] Exit
echo.
echo =====================================================================
choice /c 123456 /n /m "Please select an option [1-6]: "
if errorlevel 6 goto exit_app
if errorlevel 5 goto reset_database
if errorlevel 4 goto change_email
if errorlevel 3 goto reset_password
if errorlevel 2 goto view_accounts
if errorlevel 1 goto start_app
goto main_menu

:view_accounts
cls
node scripts\view-accounts.js
echo.
echo Press any key to return to the main menu...
pause >nul
goto main_menu

:reset_password
cls
node scripts\reset-admin-password.js
echo.
echo Press any key to return to the main menu...
pause >nul
goto main_menu

:change_email
cls
node scripts\change-email.js
echo.
echo Press any key to return to the main menu...
pause >nul
goto main_menu

:reset_database
cls
echo =====================================================================
echo                   DATABASE RESET UTILITY
echo =====================================================================
echo.
echo   [!] WARNING: Database reset will PERMANENTLY DELETE all current
echo       collections, transactions, sales, and accounts in the database!
echo.
echo   Please select a reset mode:
echo.
echo   [1] Fresh Clean Reset (db:reset)
echo       - Deletes all data and prepares DB for fresh setup via /setup
echo.
echo   [2] Demo Seed Reset (db:demo)
echo       - Deletes all data and seeds full demo store with sample products,
echo         customers, and demo logins (Password: Test@123456)
echo.
echo   [3] Cancel and return to Main Menu
echo.
echo =====================================================================
choice /c 123 /n /m "Please select an option [1-3]: "
if errorlevel 3 goto main_menu
if errorlevel 2 goto confirm_demo_reset
if errorlevel 1 goto confirm_clean_reset
goto main_menu

:confirm_clean_reset
cls
echo =====================================================================
echo                   CONFIRM FRESH CLEAN RESET
echo =====================================================================
echo.
echo   ARE YOU ABSOLUTELY SURE?
echo   All products, stock, sales, expenses, and users will be erased!
echo.
choice /c YN /n /m "Type Y to CONFIRM or N to CANCEL [Y/N]: "
if errorlevel 2 goto main_menu
echo.
echo [*] Running Fresh Clean Database Reset (call %RUNNER% run db:reset)...
echo.
call %RUNNER% run db:reset
echo.
echo Press any key to return to the main menu...
pause >nul
goto main_menu

:confirm_demo_reset
cls
echo =====================================================================
echo                   CONFIRM DEMO SEED RESET
echo =====================================================================
echo.
echo   ARE YOU SURE?
echo   Current data will be erased and replaced with demo sample shop data!
echo.
choice /c YN /n /m "Type Y to CONFIRM or N to CANCEL [Y/N]: "
if errorlevel 2 goto main_menu
echo.
echo [*] Running Demo Seed Database Reset (call %RUNNER% run db:demo)...
echo.
call %RUNNER% run db:demo
echo.
echo Press any key to return to the main menu...
pause >nul
goto main_menu

:start_app
cls
echo =====================================================================
echo                 Starting StockPilot POS Server...
echo =====================================================================
echo.

:: 1. Free port 3000 if an old instance was left running
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)

:: 2. Check if production build exists
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
    goto main_menu
  )
  echo.
  echo [OK] Build completed!
  echo.
)

:: 3. Check Database Connection
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
echo   [M] Press M to return to Main Menu
echo.
choice /c RM /n /m "Choose [R to Retry, M for Main Menu]: "
if errorlevel 2 goto main_menu
cls
goto check_db

:db_ok
cls
echo ===================================================
echo               StockPilot POS Server
echo ===================================================
echo  Database: CONNECTED (MongoDB Atlas)
echo  Status:   RUNNING at http://localhost:3000
echo  Browser:  Opening automatically...
echo.
echo  TO STOP THE SERVER:
echo   - Press Ctrl + C in this terminal window
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
echo StockPilot server stopped.
echo.
pause
goto main_menu

:exit_app
cls
echo Exiting StockPilot Control Hub. Have a great day!
timeout /t 1 /nobreak >nul
exit /b 0
