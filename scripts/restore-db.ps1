# ==============================================================================
# Скрипт відновлення бази даних PostgreSQL з файлу резервної копії (.sql)
# Використання: powershell -ExecutionPolicy Bypass -File scripts/restore-db.ps1 [-BackupFile backups/backup_xxx.sql]
# ==============================================================================

param (
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

$containerName = "inventory-db"
$dbUser = "postgres"
$dbName = "inventory_db"
$backupDir = "$PSScriptRoot\..\backups"

# Якщо файл не передано, беремо найсвіжіший із папки backups
if (-not $BackupFile) {
    $latestBackup = Get-ChildItem -Path $backupDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latestBackup) {
        Write-Error "Помилка: Файлів резервних копій у $backupDir не знайдено!"
    }
    $BackupFile = $latestBackup.FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Error "Помилка: Файл бекапу '$BackupFile' не існує!"
}

# Перевірка контейнера
$runningContainers = docker ps --format "{{.Names}}"
if ($runningContainers -notcontains $containerName) {
    if ($runningContainers -contains "inventory-db-prod") {
        $containerName = "inventory-db-prod"
    } else {
        Write-Error "Помилка: Контейнер бази даних не запущено!"
    }
}

Write-Host "🔄 Відновлення бази '$dbName' у контейнері '$containerName' з файлу:" -ForegroundColor Cyan
Write-Host "   $BackupFile" -ForegroundColor Yellow

$tempContainerFile = "/tmp/restore_temp.sql"
docker cp "$BackupFile" "${containerName}:${tempContainerFile}"
docker exec $containerName psql -U $dbUser -d $dbName -f $tempContainerFile | Out-Null
docker exec $containerName rm -f $tempContainerFile

Write-Host "✅ Базу даних успішно відновлено!" -ForegroundColor Green

