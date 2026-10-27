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
echo   2. Show staff list
echo   3. Reset a password (admin or staff)
echo   4. Change an account email
echo   5. Add a staff member
echo   6. Remove a staff member
echo   7. Exit
echo.
choice /c 1234567 /n /m "Choose an option: "
if errorlevel 7 goto end
if errorlevel 6 goto remove_staff
if errorlevel 5 goto add_staff
if errorlevel 4 goto change_email
if errorlevel 3 goto reset_password
if errorlevel 2 goto staff_list
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
if not errorlevel 1 exit /b 0
if %dtries% geq 90 goto docker_fail
timeout /t 5 /nobreak >nul
goto wait_docker

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

:end
exit /b 0
