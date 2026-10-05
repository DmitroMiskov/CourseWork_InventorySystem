# ==============================================================================
# Скрипт автоматичного резервного копіювання бази даних PostgreSQL
# Використання: powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

$containerName = "inventory-db"
$dbUser = "postgres"
$dbName = "inventory_db"
$backupDir = "$PSScriptRoot\..\backups"

# Створюємо директорію для бекапів, якщо вона відсутня
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

# Перевіряємо, чи запущено продакшн-контейнер, якщо дев-контейнер не знайдено
$runningContainers = docker ps --format "{{.Names}}"
if ($runningContainers -notcontains $containerName) {
    if ($runningContainers -contains "inventory-db-prod") {
        $containerName = "inventory-db-prod"
    } else {
        Write-Error "Помилка: Контейнер бази даних ($containerName або inventory-db-prod) не запущено!"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\backup_${dbName}_${timestamp}.sql"

Write-Host "📦 Створення резервної копії бази даних '$dbName' з контейнера '$containerName'..." -ForegroundColor Cyan

# Виконуємо чистий pg_dump всередині контейнера та копіюємо файл
$tempContainerFile = "/tmp/backup_${timestamp}.sql"
docker exec $containerName pg_dump -U $dbUser --clean --if-exists -d $dbName -f $tempContainerFile
docker cp "${containerName}:${tempContainerFile}" "$backupFile"
docker exec $containerName rm -f $tempContainerFile

if (Test-Path $backupFile) {
    $fileSize = (Get-Item $backupFile).Length / 1KB
    Write-Host "✅ Резервну копію успішно створено!" -ForegroundColor Green
    Write-Host "   Файл: $backupFile" -ForegroundColor Yellow
    Write-Host "   Розмір: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Yellow
} else {
    Write-Error "Помилка створення файлу резервної копії!"
}

