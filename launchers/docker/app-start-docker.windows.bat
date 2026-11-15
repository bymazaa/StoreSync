@echo off
setlocal
title StockPilot Docker Control Hub
cd /d "%~dp0\..\.."

rem Fail fast if Docker is not installed at all
docker --version >nul 2>&1
if errorlevel 1 (
  echo Docker is not installed or not on PATH.
  echo Install Docker Desktop first, then run this file again.
  echo.
  pause
  exit /b 1
)

:menu
cls
echo =====================================================================
echo                STOCKPILOT DOCKER CONTROL HUB
echo =====================================================================
echo.
echo   [1] Start StockPilot (Docker) and open browser
echo   [2] Stop StockPilot (Docker)
echo   [3] View Admin and Staff Account Details (Read-only)
echo   [4] Reset Admin Password
echo   [5] Change Admin / Staff Email
echo   [6] Database Reset (Clean Reset or Demo Data)
echo   [7] Backup all data to a .gz file
echo   [8] Restore data from a backup file
echo   [9] View Live Docker Logs
echo   [0] Exit
echo.
echo =====================================================================
choice /c 1234567890 /n /m "Please select an option [1-0]: "
if errorlevel 10 goto end
if errorlevel 9 goto view_logs
if errorlevel 8 goto restore_now
if errorlevel 7 goto backup_now
if errorlevel 6 goto reset_db_menu
if errorlevel 5 goto change_email
if errorlevel 4 goto reset_password
if errorlevel 3 goto view_accounts
if errorlevel 2 goto stop_app
goto start_app

rem ------------------------------------------------------------------
rem Helpers
rem ------------------------------------------------------------------

:ensure_engine
docker info >nul 2>&1
if not errorlevel 1 exit /b 0
echo Starting Docker Desktop...
set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if exist "%DOCKER_EXE%" (
  start "" "%DOCKER_EXE%"
) else (
  echo Docker Desktop not found in default path. Waiting for daemon...
)
echo Waiting for Docker engine to become ready...
set /a dtries=0
:wait_docker
set /a dtries+=1
docker info >nul 2>&1
if not errorlevel 1 goto engine_ready
if %dtries% geq 90 goto docker_fail
timeout /t 5 /nobreak >nul
goto wait_docker

:docker_fail
echo.
echo Docker did not start within 7.5 minutes.
echo Please start Docker Desktop manually and retry.
echo.
pause
goto menu

:engine_ready
exit /b 0

:ensure_db_ready
set /a mtries=0
:wait_db_loop
set /a mtries+=1
docker compose exec -T mongodb sh < scripts\mongo-ready.sh >nul 2>&1
if not errorlevel 1 exit /b 0
if %mtries% geq 30 exit /b 1
timeout /t 2 /nobreak >nul
goto wait_db_loop

rem ------------------------------------------------------------------
rem Actions
rem ------------------------------------------------------------------

:start_app
call :ensure_engine
cls
echo Starting StockPilot with Docker Compose...
docker compose up -d
if errorlevel 1 (
  echo.
  echo Docker Compose could not start the services.
  pause
  goto menu
)
echo.
echo Waiting for the web server to respond...
set /a tries=0
:wait_loop
set /a tries+=1
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto ready
if %tries% geq 60 goto slow_start
timeout /t 2 /nobreak >nul
goto wait_loop

:slow_start
echo Still starting up... opening browser anyway.
:ready
start "" http://localhost:3000
echo.
echo StockPilot is RUNNING at http://localhost:3000
echo.
pause
goto menu

:stop_app
call :ensure_engine
cls
echo Stopping StockPilot containers...
docker compose down
echo.
echo StockPilot stopped. Data is preserved in Docker volumes.
echo.
pause
goto menu

:view_accounts
call :ensure_engine
cls
docker compose exec app node scripts/view-accounts.js
echo.
echo Press any key to return to main menu...
pause >nul
goto menu

:reset_password
call :ensure_engine
cls
docker compose exec -it app node scripts/reset-admin-password.js
echo.
echo Press any key to return to main menu...
pause >nul
goto menu

:change_email
call :ensure_engine
cls
docker compose exec -it app node scripts/change-email.js
echo.
echo Press any key to return to main menu...
pause >nul
goto menu

:reset_db_menu
call :ensure_engine
cls
echo =====================================================================
echo                   DATABASE RESET (DOCKER)
echo =====================================================================
echo.
echo   [!] WARNING: This will permanently delete current database data!
echo.
echo   [1] Fresh Clean Reset (db:reset) - prepare for /setup
echo   [2] Demo Seed Reset (db:demo) - seed demo shop data
echo   [3] Cancel & return to Main Menu
echo.
echo =====================================================================
choice /c 123 /n /m "Please choose [1-3]: "
if errorlevel 3 goto menu
if errorlevel 2 goto confirm_docker_demo
if errorlevel 1 goto confirm_docker_clean
goto menu

:confirm_docker_clean
cls
echo ARE YOU SURE? All shop collections will be deleted!
choice /c YN /n /m "Type Y to confirm, N to cancel: "
if errorlevel 2 goto menu
docker compose exec -T app pnpm run db:reset
echo.
pause
goto menu

:confirm_docker_demo
cls
echo ARE YOU SURE? Current data will be replaced with demo seed data!
choice /c YN /n /m "Type Y to confirm, N to cancel: "
if errorlevel 2 goto menu
docker compose exec -T app pnpm run db:demo
echo.
pause
goto menu

:backup_now
call :ensure_engine
echo.
echo Ensuring database container is running...
docker compose up -d mongodb >nul 2>&1
if not exist "backups" mkdir "backups"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HHmm"') do set "STAMP=%%I"
set "BACKUP_FILE=backups\stockpilot-%STAMP%.gz"
echo Creating backup into %BACKUP_FILE%...
docker compose exec -T mongodb sh < scripts\mongo-dump.sh > "%BACKUP_FILE%"
if errorlevel 1 (
  echo Backup failed!
  del "%BACKUP_FILE%" >nul 2>&1
) else (
  echo Backup saved successfully to: %BACKUP_FILE%
)
echo.
pause
goto menu

:restore_now
call :ensure_engine
if not exist "backups" (
  echo No backups directory found.
  pause
  goto menu
)
echo Select backup file to restore:
dir /b backups\*.gz
echo.
set "RESTORE_FILE="
set /p "RESTORE_FILE=Enter backup filename (e.g. stockpilot-xxxx.gz): "
if not exist "backups\%RESTORE_FILE%" (
  echo File not found!
  pause
  goto menu
)
echo [!] Restoring will OVERWRITE current database with backup state!
set /p "CONFIRM=Type RESTORE to proceed: "
if not "%CONFIRM%"=="RESTORE" (
  echo Restore cancelled.
  pause
  goto menu
)
docker compose exec -T mongodb sh < scripts\mongo-restore.sh < "backups\%RESTORE_FILE%"
echo.
echo Restore completed.
pause
goto menu

:view_logs
call :ensure_engine
cls
echo Showing Docker logs (Press Ctrl+C to stop)...
docker compose logs -f --tail=100
goto menu

:end
cls
echo Exiting StockPilot Docker Control Hub. Have a nice day!
exit /b 0
