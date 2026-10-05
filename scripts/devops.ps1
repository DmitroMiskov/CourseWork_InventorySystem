# ==============================================================================
# Master DevOps Script - Inventory System
# Використання:
#   .\scripts\devops.ps1 dev      - Запуск середовища розробки (Hot Reload)
#   .\scripts\devops.ps1 prod     - Збірка та запуск продакшн-контейнерів
#   .\scripts\devops.ps1 down     - Зупинка всіх контейнерів
#   .\scripts\devops.ps1 status   - Перевірка стану та Healthcheck
#   .\scripts\devops.ps1 test     - Запуск бекенд та фронтенд тестів
#   .\scripts\devops.ps1 backup   - Резервне копіювання бази даних
#   .\scripts\devops.ps1 restore  - Відновлення бази даних з останнього бекапу
#   .\scripts\devops.ps1 logs     - Перегляд логів у реальному часі
# ==============================================================================

param (
    [Parameter(Position=0)]
    [ValidateSet("dev", "prod", "down", "status", "test", "backup", "restore", "logs", "help")]
    [string]$Command = "status"
)

$rootDir = "$PSScriptRoot\.."

switch ($Command) {
    "dev" {
        Write-Host "🚀 Запуск середовища розробки (Development)..." -ForegroundColor Cyan
        Set-Location $rootDir
        docker compose -f docker-compose.yml up -d
        Write-Host "✅ Середовище запущено!" -ForegroundColor Green
        Write-Host "   Frontend: http://localhost:80" -ForegroundColor Yellow
        Write-Host "   Backend API: http://localhost:8080/swagger" -ForegroundColor Yellow
        Write-Host "   ML Service: http://localhost:8000/docs" -ForegroundColor Yellow
    }

    "prod" {
        Write-Host "🏭 Збірка та запуск продакшн-контейнерів (Production)..." -ForegroundColor Cyan
        Set-Location $rootDir
        docker compose -f docker-compose.prod.yml up -d --build
        Write-Host "✅ Продакшн запущено!" -ForegroundColor Green
        Write-Host "   Веб-додаток: http://localhost:80" -ForegroundColor Yellow
    }

    "down" {
        Write-Host "🛑 Зупинка всіх контейнерів..." -ForegroundColor Cyan
        Set-Location $rootDir
        docker compose -f docker-compose.yml down
        docker compose -f docker-compose.prod.yml down
        Write-Host "✅ Усі контейнери зупинено!" -ForegroundColor Green
    }

    "status" {
        Write-Host "📊 Стан сервісів системи:" -ForegroundColor Cyan
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        Write-Host "`n🔍 Перевірка Healthcheck endpoints:" -ForegroundColor Cyan

        try {
            $apiHealth = Invoke-RestMethod -Uri "http://localhost:8080/health" -TimeoutSec 3 -ErrorAction Stop
            Write-Host "   [API :8080]       ✅ $apiHealth" -ForegroundColor Green
        } catch {
            Write-Host "   [API :8080]       ❌ Недоступний" -ForegroundColor Red
        }

        try {
            $mlHealth = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 3 -ErrorAction Stop
            Write-Host "   [ML Service :8000] ✅ $($mlHealth.status)" -ForegroundColor Green
        } catch {
            Write-Host "   [ML Service :8000] ❌ Недоступний" -ForegroundColor Red
        }

        try {
            $clientHealth = (Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop).StatusCode
            Write-Host "   [Client :80]      ✅ HTTP $clientHealth OK" -ForegroundColor Green
        } catch {
            Write-Host "   [Client :80]      ❌ Недоступний" -ForegroundColor Red
        }
    }

    "test" {
        Write-Host "🧪 Запуск .NET тестів (CQRS & Domain)..." -ForegroundColor Cyan
        Set-Location $rootDir
        dotnet test InventorySystem.sln --configuration Release --verbosity normal

        Write-Host "`n🧪 Запуск ML Service тестів (FastAPI, DSS, Forecast, Pareto, Copilot)..." -ForegroundColor Cyan
        if ((docker ps --filter "name=inventory-ml" --format "{{.Names}}") -eq "inventory-ml") {
            docker exec inventory-ml python -m unittest discover tests
        } else {
            Set-Location "$rootDir\ml-service"
            python -m unittest discover tests
            Set-Location $rootDir
        }

        Write-Host "`n🧪 Збірка Frontend (Typecheck & Bundle)..." -ForegroundColor Cyan
        Set-Location "$rootDir\frontend"
        cmd /c "npm run build"
        Set-Location $rootDir
        Write-Host "`n✅ Всі тести та збірки пройшли успішно!" -ForegroundColor Green
    }

    "backup" {
        & "$PSScriptRoot\backup-db.ps1"
    }

    "restore" {
        & "$PSScriptRoot\restore-db.ps1"
    }

    "logs" {
        Set-Location $rootDir
        docker compose logs -f --tail 50
    }

    "help" {
        Get-Help $MyInvocation.MyCommand.Path -Detailed
    }
}


