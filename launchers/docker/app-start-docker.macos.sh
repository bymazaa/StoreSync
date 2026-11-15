#!/usr/bin/env bash
set -e

# Change directory to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not in PATH."
  echo "Please install Docker Desktop for Mac first."
  exit 1
fi

ensure_engine() {
  if ! docker info >/dev/null 2>&1; then
    echo "Docker engine is not running. Launching Docker Desktop..."
    open -a Docker 2>/dev/null || true
    echo "Waiting for Docker engine to become ready..."
    for i in $(seq 1 60); do
      if docker info >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done
    if ! docker info >/dev/null 2>&1; then
      echo "Docker engine failed to start. Please start Docker Desktop manually."
      exit 1
    fi
  fi
}

start_app() {
  ensure_engine
  clear
  echo "Starting StockPilot with Docker Compose..."
  docker compose up -d
  echo ""
  echo "Waiting for app to start..."
  for i in $(seq 1 30); do
    if curl -s "http://localhost:3000" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  open "http://localhost:3000" 2>/dev/null || true
  echo "StockPilot is running at http://localhost:3000"
  echo ""
  read -rp "Press Enter to return to menu..." _
}

stop_app() {
  ensure_engine
  clear
  echo "Stopping StockPilot containers..."
  docker compose down
  echo "StockPilot stopped."
  read -rp "Press Enter to return to menu..." _
}

view_accounts() {
  ensure_engine
  clear
  docker compose exec app node scripts/view-accounts.js
  echo ""
  read -rp "Press Enter to return to menu..." _
}

reset_password() {
  ensure_engine
  clear
  docker compose exec -it app node scripts/reset-admin-password.js
  echo ""
  read -rp "Press Enter to return to menu..." _
}

change_email() {
  ensure_engine
  clear
  docker compose exec -it app node scripts/change-email.js
  echo ""
  read -rp "Press Enter to return to menu..." _
}

reset_db() {
  ensure_engine
  clear
  echo "====================================================================="
  echo "                 DATABASE RESET (DOCKER)"
  echo "====================================================================="
  echo "  [1] Fresh Clean Reset (db:reset)"
  echo "  [2] Demo Seed Reset (db:demo)"
  echo "  [3] Cancel"
  read -rp "Choose [1-3]: " opt
  case "$opt" in
    1)
      read -rp "Are you SURE you want to erase all data? [y/N]: " conf
      if [[ "$conf" =~ ^[yY] ]]; then
        docker compose exec -T app pnpm run db:reset
      fi
      ;;
    2)
      read -rp "Are you SURE you want to seed demo data? [y/N]: " conf
      if [[ "$conf" =~ ^[yY] ]]; then
        docker compose exec -T app pnpm run db:demo
      fi
      ;;
  esac
  read -rp "Press Enter to return to menu..." _
}

backup_now() {
  ensure_engine
  mkdir -p backups
  STAMP=$(date +%Y-%m-%d-%H%M)
  BACKUP_FILE="backups/stockpilot-$STAMP.gz"
  echo "Creating backup to $BACKUP_FILE..."
  docker compose up -d mongodb >/dev/null 2>&1
  docker compose exec -T mongodb sh < scripts/mongo-dump.sh > "$BACKUP_FILE"
  echo "Backup saved: $BACKUP_FILE"
  read -rp "Press Enter to return to menu..." _
}

restore_now() {
  ensure_engine
  mkdir -p backups
  echo "Available backups:"
  ls -1 backups/*.gz 2>/dev/null || echo "No backups found."
  echo ""
  read -rp "Enter filename to restore (e.g. stockpilot-xxx.gz): " file
  if [ ! -f "backups/$file" ]; then
    echo "File not found."
  else
    read -rp "Type RESTORE to confirm: " conf
    if [ "$conf" = "RESTORE" ]; then
      docker compose exec -T mongodb sh < scripts/mongo-restore.sh < "backups/$file"
      echo "Restore finished."
    else
      echo "Restore cancelled."
    fi
  fi
  read -rp "Press Enter to return to menu..." _
}

view_logs() {
  ensure_engine
  clear
  echo "Showing Docker logs (Press Ctrl+C to exit)..."
  docker compose logs -f --tail=100
}

while true; do
  clear
  echo "====================================================================="
  echo "              STOCKPILOT DOCKER CONTROL HUB (macOS)"
  echo "====================================================================="
  echo "  [1] Start StockPilot (Docker) and open browser"
  echo "  [2] Stop StockPilot (Docker)"
  echo "  [3] View Admin and Staff Account Details (Read-only)"
  echo "  [4] Reset Admin Password"
  echo "  [5] Change Admin / Staff Email"
  echo "  [6] Database Reset (Clean Reset or Demo Data)"
  echo "  [7] Backup all data to a .gz file"
  echo "  [8] Restore data from a backup file"
  echo "  [9] View Live Docker Logs"
  echo "  [0] Exit"
  echo "====================================================================="
  read -rp "Please select an option [1-0]: " opt
  case "$opt" in
    1) start_app ;;
    2) stop_app ;;
    3) view_accounts ;;
    4) reset_password ;;
    5) change_email ;;
    6) reset_db ;;
    7) backup_now ;;
    8) restore_now ;;
    9) view_logs ;;
    0) clear; exit 0 ;;
    *) echo "Invalid option"; sleep 1 ;;
  esac
done
