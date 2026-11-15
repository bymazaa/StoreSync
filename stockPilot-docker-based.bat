@echo off
setlocal
title StockPilot
cd /d "%~dp0"

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
echo ==============================================
echo   StockPilot - Shop Server
echo ==============================================
echo.
echo   1. Start StockPilot and open the browser
echo   2. Stop StockPilot
echo   3. Show staff list
echo   4. Reset a password (admin or staff)
echo   5. Change an account email
echo   6. Add a staff member
echo   7. Remove a staff member
echo   8. Backup all data to a file
echo   9. Restore data from a backup
echo   0. Exit
echo.
choice /c 1234567890 /n /m "Choose an option: "
if errorlevel 10 goto end
if errorlevel 9 goto restore_now
if errorlevel 8 goto backup_now
if errorlevel 7 goto remove_staff
if errorlevel 6 goto add_staff
if errorlevel 5 goto change_email
if errorlevel 4 goto reset_password
if errorlevel 3 goto staff_list
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
  echo Docker Desktop not found in the default folder.
  echo If Docker is already starting, just wait.
)
echo Waiting for the Docker engine - the first start can take a couple of minutes...
set /a dtries=0
:wait_docker
set /a dtries+=1
docker info >nul 2>&1
if not errorlevel 1 goto engine_ready
if %dtries% geq 90 goto docker_fail
timeout /t 5 /nobreak >nul
goto wait_docker

:engine_ready
call :close_desktop_window
exit /b 0

rem Closes the Docker Desktop window once the engine is up; the engine keeps running in the tray.
:close_desktop_window
powershell -NoProfile -Command "Start-Sleep -Seconds 2; $p = Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue; if ($p) { $null = $p.CloseMainWindow() }"
exit /b 0

:docker_fail
echo.
echo Docker did not become ready in time.
echo Open Docker Desktop, wait until it says "Engine running", then try again.
echo.
pause
goto menu

rem Makes sure the app container is running (starts it if needed)
:ensure_app
call :ensure_engine
docker compose up -d
if errorlevel 1 (
  echo.
  echo StockPilot failed to start.
  echo Open a terminal in this folder and run: docker compose up
  echo to see the error details.
  echo.
  pause
  goto menu
)
exit /b 0

rem ------------------------------------------------------------------
rem Menu actions
rem ------------------------------------------------------------------

:start_app
call :ensure_app
echo Waiting for StockPilot to be ready...
set /a atries=0
:wait_app
set /a atries+=1
curl -sf http://localhost:3000/api/health >nul 2>&1
if not errorlevel 1 goto open_browser
if %atries% geq 60 goto app_fail
timeout /t 3 /nobreak >nul
goto wait_app

:app_fail
echo.
echo StockPilot did not become ready in time.
echo Check what is happening with: docker compose logs app
echo.
pause
goto menu

:open_browser
echo StockPilot is ready - opening your browser...
start "" http://localhost:3000
timeout /t 4 >nul
goto menu

:staff_list
call :ensure_app
echo.
docker compose exec app pnpm db:staff list
echo.
pause
goto menu

:reset_password
call :ensure_app
echo.
set "TARGET_EMAIL="
set /p "TARGET_EMAIL=Account email to reset: "
if "%TARGET_EMAIL%"=="" goto menu
docker compose exec app pnpm db:password "%TARGET_EMAIL%"
echo.
pause
goto menu

:change_email
call :ensure_app
echo.
set "CUR_EMAIL="
set /p "CUR_EMAIL=Current account email: "
if "%CUR_EMAIL%"=="" goto menu
set "NEW_EMAIL="
set /p "NEW_EMAIL=New email: "
if "%NEW_EMAIL%"=="" goto menu
docker compose exec app pnpm db:staff email "%CUR_EMAIL%" "%NEW_EMAIL%"
echo.
pause
goto menu

:add_staff
call :ensure_app
echo.
set "NEW_NAME="
set /p "NEW_NAME=Full name: "
if "%NEW_NAME%"=="" goto menu
set "NEW_EMAIL="
set /p "NEW_EMAIL=Email: "
if "%NEW_EMAIL%"=="" goto menu
echo   Roles: OWNER, MANAGER, CASHIER, STOCK_CLERK
set "NEW_ROLE="
set /p "NEW_ROLE=Role: "
if "%NEW_ROLE%"=="" goto menu
docker compose exec app pnpm db:staff add "%NEW_NAME%" "%NEW_EMAIL%" "%NEW_ROLE%"
echo.
pause
goto menu

:remove_staff
call :ensure_app
echo.
set "DEL_EMAIL="
set /p "DEL_EMAIL=Account email to remove: "
if "%DEL_EMAIL%"=="" goto menu
docker compose exec app pnpm db:staff remove "%DEL_EMAIL%"
echo.
pause
goto menu

:stop_app
echo.
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker is not running, so StockPilot is already stopped.
  echo.
  pause
  goto menu
)
echo Stopping StockPilot...
docker compose down
if errorlevel 1 (
  echo.
  echo StockPilot could not be stopped cleanly.
  echo Open a terminal in this folder and run: docker compose down
  echo to see the error details.
) else (
  echo.
  echo StockPilot is stopped. All shop data is safe on the disk volumes.
)
echo.
pause
goto menu

:backup_now
call :ensure_engine
echo.
echo Making sure the database container is running...
docker compose up -d mongodb >nul 2>&1
if errorlevel 1 (
  echo The database container could not be started.
  pause
  goto menu
)
echo Waiting for the database to be ready...
set /a btries=0
:wait_mongo
set /a btries+=1
docker compose exec -T mongodb sh < scripts\mongo-ready.sh >nul 2>&1
if not errorlevel 1 goto mongo_ready
if %btries% geq 30 goto mongo_fail
timeout /t 2 /nobreak >nul
goto wait_mongo

:mongo_fail
echo.
echo The database did not become ready in time.
echo Start StockPilot once with option 1, wait until it is open, then try the backup again.
echo.
pause
goto menu

:mongo_ready
if not exist "backups" mkdir "backups"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HHmm"') do set "STAMP=%%I"
set "BACKUP_FILE=backups\stockpilot-%STAMP%.gz"
echo.
echo Creating backup - every table and record is written into this one file.
echo This can take a minute on a large database...
docker compose exec -T mongodb sh < scripts\mongo-dump.sh > "%BACKUP_FILE%"
if errorlevel 1 (
  echo.
  echo Backup failed. Check that the database is healthy and try again.
  del "%BACKUP_FILE%" >nul 2>&1
  pause
  goto menu
)
echo.
echo Backup saved to: %BACKUP_FILE%
echo.
echo Existing backups:
dir /b backups\*.gz 2>nul
echo.
echo Keep copies of these files somewhere safe (pen drive, cloud) from time to time.
echo.
pause
goto menu

:restore_now
call :ensure_engine
echo.
if not exist "backups" (
  echo No backups folder found yet. Run option 8 first to create a backup.
  pause
  goto menu
)
setlocal enabledelayedexpansion
set /a fcount=0
for /f "delims=" %%F in ('dir /b /o-d backups\*.gz 2^>nul') do (
  set /a fcount+=1
  set "file_!fcount!=%%F"
  echo   !fcount!. %%F
)
if !fcount! equ 0 (
  echo.
  echo No backup files found yet. Run option 8 first to create a backup.
  endlocal
  pause
  goto menu
)
echo.
set "CHOICE="
set /p "CHOICE=Type the number of the backup to restore: "
if "!CHOICE!"=="" (
  endlocal
  goto menu
)
if not defined file_!CHOICE! (
  echo.
  echo !CHOICE! is not a number from the list above.
  endlocal
  pause
  goto menu
)
set "RESTORE_FILE=!file_%CHOICE%!"
endlocal & set "RESTORE_FILE=%RESTORE_FILE%"
echo.
echo Selected backup: backups\%RESTORE_FILE%
if not exist "backups\%RESTORE_FILE%" (
  echo.
  echo File not found: backups\%RESTORE_FILE%
  pause
  goto menu
)
echo.
echo !!! WARNING !!!
echo Restoring REPLACES all current data with the state inside that backup.
echo Everything recorded AFTER the backup was made WILL BE LOST forever.
echo.
set "CONFIRM1="
set /p "CONFIRM1=Type YES to continue, or anything else to cancel: "
if /i not "%CONFIRM1%"=="YES" (
  echo.
  echo Restore cancelled. Nothing was changed.
  pause
  goto menu
)
echo.
set "CONFIRM2="
set /p "CONFIRM2=Last check - type RESTORE to really replace the data: "
if /i not "%CONFIRM2%"=="RESTORE" (
  echo.
  echo Restore cancelled. Nothing was changed.
  pause
  goto menu
)
echo.
echo Stopping StockPilot while the data is being restored...
docker compose stop app >nul 2>&1
call :ensure_db_ready
if errorlevel 1 (
  echo The database could not be reached, so nothing was restored.
  docker compose up -d app >nul 2>&1
  pause
  goto menu
)
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HHmm"') do set "SAFE_STAMP=%%I"
echo Saving a safety copy of the CURRENT data first (pre-restore-%SAFE_STAMP%.gz)...
docker compose exec -T mongodb sh < scripts\mongo-dump.sh > "backups\pre-restore-%SAFE_STAMP%.gz"
if errorlevel 1 (
  echo.
  echo The safety copy failed, so the restore was NOT started. Nothing was changed.
  del "backups\pre-restore-%SAFE_STAMP%.gz" >nul 2>&1
  docker compose up -d app >nul 2>&1
  pause
  goto menu
)
echo Copying the backup into the database container...
docker compose cp "backups/%RESTORE_FILE%" mongodb:/tmp/stockpilot-restore.gz
if errorlevel 1 (
  echo.
  echo The backup file could not be copied into the database container. Nothing was changed.
  docker compose up -d app >nul 2>&1
  pause
  goto menu
)
echo Restoring from backups\%RESTORE_FILE% - this replaces the current data...
docker compose exec -T mongodb sh < scripts\mongo-restore.sh
if errorlevel 1 (
  echo.
  echo Restore FAILED partway through. Do not use the shop yet!
  echo The database may be incomplete - restore the pre-restore safety copy or ask for help.
  docker compose exec -T mongodb rm -f /tmp/stockpilot-restore.gz >nul 2>&1
  docker compose up -d app >nul 2>&1
  pause
  goto menu
)
docker compose exec -T mongodb rm -f /tmp/stockpilot-restore.gz >nul 2>&1
docker compose up -d app >nul 2>&1
echo.
echo Restore finished successfully. StockPilot is starting again with the backed-up data.
echo.
pause
goto menu

rem Starts just the database and waits until it is ready to accept writes.
:ensure_db_ready
docker compose up -d mongodb >nul 2>&1
if errorlevel 1 exit /b 1
set /a rbtries=0
:wait_mongo_ready
set /a rbtries+=1
docker compose exec -T mongodb sh < scripts\mongo-ready.sh >nul 2>&1
if not errorlevel 1 exit /b 0
if %rbtries% geq 30 exit /b 1
timeout /t 2 /nobreak >nul
goto wait_mongo_ready

:end
exit /b 0
