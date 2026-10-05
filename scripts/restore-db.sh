#!/usr/bin/env bash
# ==============================================================================
# Скрипт відновлення бази даних PostgreSQL з файлу резервної копії (Linux/macOS)
# Використання: ./scripts/restore-db.sh [шлях_до_файлу_бекапу]
# ==============================================================================

set -euo pipefail

CONTAINER_NAME="inventory-db"
DB_USER="postgres"
DB_NAME="inventory_db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"

BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/*.sql 2>/dev/null | head -n 1 || true)
  if [ -z "${BACKUP_FILE}" ]; then
    echo "Помилка: Файлів бекапів у ${BACKUP_DIR} не знайдено!" >&2
    exit 1
  fi
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  if docker ps --format '{{.Names}}' | grep -q "^inventory-db-prod$"; then
    CONTAINER_NAME="inventory-db-prod"
  else
    echo "Помилка: Контейнер бази даних не запущено!" >&2
    exit 1
  fi
fi

TEMP_FILE="/tmp/restore_temp.sql"
echo "🔄 Відновлення бази '${DB_NAME}' з файлу: ${BACKUP_FILE}..."
docker cp "${BACKUP_FILE}" "${CONTAINER_NAME}:${TEMP_FILE}"
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -f "${TEMP_FILE}" > /dev/null
docker exec "${CONTAINER_NAME}" rm -f "${TEMP_FILE}"

echo "✅ Базу даних успішно відновлено!"
