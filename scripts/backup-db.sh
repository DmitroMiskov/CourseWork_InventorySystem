#!/usr/bin/env bash
# ==============================================================================
# Скрипт автоматичного резервного копіювання бази даних PostgreSQL (Linux/macOS)
# Використання: ./scripts/backup-db.sh
# ==============================================================================

set -euo pipefail

CONTAINER_NAME="inventory-db"
DB_USER="postgres"
DB_NAME="inventory_db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"

mkdir -p "${BACKUP_DIR}"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  if docker ps --format '{{.Names}}' | grep -q "^inventory-db-prod$"; then
    CONTAINER_NAME="inventory-db-prod"
  else
    echo "Помилка: Контейнер бази даних (${CONTAINER_NAME} або inventory-db-prod) не запущено!" >&2
    exit 1
  fi
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql"
TEMP_FILE="/tmp/backup_${TIMESTAMP}.sql"

echo "📦 Створення резервної копії бази даних '${DB_NAME}'..."
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" --clean --if-exists -d "${DB_NAME}" -f "${TEMP_FILE}"
docker cp "${CONTAINER_NAME}:${TEMP_FILE}" "${BACKUP_FILE}"
docker exec "${CONTAINER_NAME}" rm -f "${TEMP_FILE}"

echo "✅ Резервну копію створено: ${BACKUP_FILE}"
