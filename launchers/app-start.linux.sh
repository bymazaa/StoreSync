#!/usr/bin/env bash
set -e

# Change directory to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Detect package runner
if command -v pnpm >/dev/null 2>&1; then
  RUNNER="pnpm"
else
  RUNNER="npm"
fi

free_port_3000() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti:3000 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
}

view_accounts() {
  clear
  node scripts/view-accounts.js
  echo ""
  read -rp "Press Enter to return to the main menu..." _
}

reset_password() {
  clear
  node scripts/reset-admin-password.js
  echo ""
  read -rp "Press Enter to return to the main menu..." _
}

change_email() {
  clear
  node scripts/change-email.js
  echo ""
  read -rp "Press Enter to return to the main menu..." _
}

confirm_clean_reset() {
  clear
  echo "====================================================================="
  echo "                   CONFIRM FRESH CLEAN RESET"
  echo "====================================================================="
  echo ""
  echo "  ARE YOU ABSOLUTELY SURE?"
  echo "  All products, stock, sales, expenses, and users will be erased!"
  echo ""
  read -rp "Type Y to CONFIRM or N to CANCEL [y/N]: " confirm
  case "$confirm" in
    [yY]|[yY][eE][sS])
      echo ""
      echo "[*] Running Fresh Clean Database Reset ($RUNNER run db:reset)..."
      echo ""
      $RUNNER run db:reset
      echo ""
      read -rp "Press Enter to return to the main menu..." _
      ;;
    *)
      echo "Cancelled."
      sleep 1
      ;;
  esac
}

confirm_demo_reset() {
  clear
  echo "====================================================================="
  echo "                   CONFIRM DEMO SEED RESET"
  echo "====================================================================="
  echo ""
  echo "  ARE YOU SURE?"
  echo "  Current data will be erased and replaced with demo sample shop data!"
  echo ""
  read -rp "Type Y to CONFIRM or N to CANCEL [y/N]: " confirm
  case "$confirm" in
    [yY]|[yY][eE][sS])
      echo ""
      echo "[*] Running Demo Seed Database Reset ($RUNNER run db:demo)..."
      echo ""
      $RUNNER run db:demo
      echo ""
      read -rp "Press Enter to return to the main menu..." _
      ;;
    *)
      echo "Cancelled."
      sleep 1
      ;;
  esac
}

reset_database() {
  while true; do
    clear
    echo "====================================================================="
    echo "                   DATABASE RESET UTILITY"
    echo "====================================================================="
    echo ""
    echo "  [!] WARNING: Database reset will PERMANENTLY DELETE all current"
    echo "      collections, transactions, sales, and accounts in the database!"
    echo ""
    echo "  Please select a reset mode:"
    echo ""
    echo "  [1] Fresh Clean Reset (db:reset)"
    echo "      - Deletes all data and prepares DB for fresh setup via /setup"
    echo ""
    echo "  [2] Demo Seed Reset (db:demo)"
    echo "      - Deletes all data and seeds full demo store with sample products,"
    echo "        customers, and demo logins (Password: Test@123456)"
    echo ""
    echo "  [3] Cancel and return to Main Menu"
    echo ""
    echo "====================================================================="
    read -rp "Please select an option [1-3]: " subopt
    case "$subopt" in
      1) confirm_clean_reset; return ;;
      2) confirm_demo_reset; return ;;
      3) return ;;
      *) echo "Invalid option"; sleep 1 ;;
    esac
  done
}

start_app() {
  clear
  echo "====================================================================="
  echo "                 Starting StockPilot POS Server..."
  echo "====================================================================="
  echo ""

  # 1. Free port 3000
  free_port_3000

  # 2. Check if production build exists
  if [ ! -d ".next" ]; then
    echo "==================================================="
    echo "          StockPilot First-time Setup"
    echo "==================================================="
    echo "[INFO] Production build not found. Building project..."
    echo "Please wait a moment..."
    echo ""
    $RUNNER run build
    echo ""
    echo "[OK] Build completed!"
    echo ""
  fi

  # 3. Check DB
  while true; do
    echo "[*] Checking database connection..."
    if err_out=$(node scripts/check-db.js 2>&1); then
      break
    else
      clear
      echo "====================================================================="
      echo "                  [!] DATABASE CONNECTION FAILED"
      echo "====================================================================="
      echo ""
      echo "  Could not connect to your Cloud Database (MongoDB Atlas)."
      echo ""
      echo "  Technical details:"
      echo "$err_out"
      echo ""
      echo "---------------------------------------------------------------------"
      echo "  SOLUTIONS FOR MOBILE HOTSPOT / WIFI:"
      echo ""
      echo "  1. (MOST COMMON) Whitelist All IPs in MongoDB Atlas:"
      echo "     - Log in to https://cloud.mongodb.com"
      echo "     - Go to: Security -> Network Access"
      echo "     - Click 'Add IP Address'"
      echo "     - Click 'Allow Access From Anywhere' (IP: 0.0.0.0/0)"
      echo "     - Click 'Confirm'"
      echo ""
      echo "  2. Mobile Hotspot DNS issue:"
      echo "     - Mobile SIM internet often blocks MongoDB SRV records."
      echo "     - Change your Wi-Fi/adapter DNS to Google DNS (8.8.8.8 and 8.8.4.4)."
      echo "====================================================================="
      echo ""
      echo "   [R] Press R to Retry connection"
      echo "   [M] Press M to return to Main Menu"
      echo ""
      read -rp "Choose [R to Retry, M for Main Menu]: " choice
      case "$choice" in
        [rR]) clear; continue ;;
        *) return ;;
      esac
    fi
  done

  clear
  echo "==================================================="
  echo "               StockPilot POS Server"
  echo "==================================================="
  echo "  Database: CONNECTED (MongoDB Atlas)"
  echo "  Status:   RUNNING at http://localhost:3000"
  echo "  Browser:  Opening automatically..."
  echo ""
  echo "  TO STOP THE SERVER:"
  echo "   - Press Ctrl + C in this terminal window"
  echo "==================================================="
  echo ""

  # Open browser in background after 2s
  (sleep 2 && {
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
    elif command -v sensible-browser >/dev/null 2>&1; then
      sensible-browser "http://localhost:3000" >/dev/null 2>&1 || true
    fi
  }) &

  # Run the server
  trap 'free_port_3000; exit 0' INT TERM
  $RUNNER start || true
  free_port_3000
  echo ""
  echo "StockPilot server stopped."
  read -rp "Press Enter to return to main menu..." _
}

# Main loop
while true; do
  clear
  echo "====================================================================="
  echo "                   STOCKPILOT POS CONTROL HUB (LINUX)"
  echo "====================================================================="
  echo ""
  echo "  [1] Start StockPilot POS Application"
  echo "  [2] View Admin and Staff Account Details (Read-only)"
  echo "  [3] Reset Admin Password"
  echo "  [4] Change Admin / Staff Email"
  echo "  [5] Database Reset (Fresh DB or Demo Data)"
  echo "  [6] Exit"
  echo ""
  echo "====================================================================="
  read -rp "Please select an option [1-6]: " opt
  case "$opt" in
    1) start_app ;;
    2) view_accounts ;;
    3) reset_password ;;
    4) change_email ;;
    5) reset_database ;;
    6) clear; echo "Exiting StockPilot Control Hub. Have a great day!"; exit 0 ;;
    *) echo "Invalid option, please choose 1-6"; sleep 1 ;;
  esac
done
