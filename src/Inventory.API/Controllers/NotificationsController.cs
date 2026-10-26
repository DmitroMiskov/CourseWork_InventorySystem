using Inventory.Application.Common.Interfaces;
using Inventory.API.Dtos;
using Inventory.API.Models;
using Inventory.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IInventoryNotifier _notifier;
        private readonly ITelegramAlertService _telegramService;

        public NotificationsController(
            IApplicationDbContext context, 
            IInventoryNotifier notifier, 
            ITelegramAlertService telegramService)
        {
            _context = context;
            _notifier = notifier;
            _telegramService = telegramService;
        }

        /// <summary>
        /// Повертає список актуальних критичних залишків товарів (Quantity <= MinStock)
        /// </summary>
        [HttpGet("active-alerts")]
        public async Task<ActionResult<ActiveAlertsSummaryDto>> GetActiveAlerts()
        {
            var alerts = await _context.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .Where(p => p.Quantity <= p.MinStock)
                .OrderBy(p => p.Quantity)
                .Select(p => new ActiveAlertItemDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Sku = p.SKU,
                    CurrentStock = p.Quantity,
                    MinStock = p.MinStock,
                    Deficit = p.MinStock - p.Quantity,
                    CategoryName = p.Category != null ? p.Category.Name : "Загальне",
                    Price = p.Price,
                    Severity = p.Quantity == 0 ? "error" : "warning",
                    StatusText = p.Quantity == 0 ? "ТЕРМІНОВО (Залишок 0)" : "КРИТИЧНО (Нижче MinStock)"
                })
                .ToListAsync();

            return Ok(new ActiveAlertsSummaryDto
            {
                TotalAlerts = alerts.Count,
                OutStockCount = alerts.Count(a => a.CurrentStock == 0),
                LowStockCount = alerts.Count(a => a.CurrentStock > 0),
                Alerts = alerts
            });
        }

        /// <summary>
        /// Отримання статусу інтеграції з Telegram
        /// </summary>
        [HttpGet("telegram/status")]
        public IActionResult GetTelegramStatus()
        {
            var settings = _telegramService.GetSettings();
            return Ok(new
            {
                IsConfigured = _telegramService.IsConfigured,
                IsEnabled = _telegramService.IsEnabled,
                settings.ChatId,
                settings.BotToken,
                settings.NotifyOnLowStock
            });
        }

        public class UpdateTelegramConfigDto
        {
            public string BotToken { get; set; } = string.Empty;
            public string ChatId { get; set; } = string.Empty;
            public bool Enabled { get; set; }
            public bool NotifyOnLowStock { get; set; } = true;
        }

        /// <summary>
        /// Оновлення конфігурації Telegram (тільки для Admin або Manager)
        /// </summary>
        [HttpPost("telegram/config")]
        [Authorize(Roles = "Admin,Manager")]
        public IActionResult UpdateTelegramConfig([FromBody] UpdateTelegramConfigDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.ChatId))
            {
                return BadRequest("ChatId є обов'язковим");
            }

            _telegramService.UpdateSettings(
                dto.BotToken,
                dto.ChatId,
                dto.Enabled,
                dto.NotifyOnLowStock
            );

            return Ok(new { Message = "Налаштування Telegram успішно оновлено" });
        }

        /// <summary>
        /// Відправка тестового повідомлення в Telegram
        /// </summary>
        [HttpPost("telegram/test")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> TestTelegram()
        {
            if (!_telegramService.IsConfigured)
            {
                return BadRequest("Telegram не налаштований (введіть Bot Token та Chat ID)");
            }

            var success = await _telegramService.SendTestMessageAsync();
            if (success)
            {
                return Ok(new { Message = "Тестове повідомлення успішно надіслано в Telegram!" });
            }

            return StatusCode(500, new { Message = "Не вдалося надіслати повідомлення. Перевірте правильність Bot Token та Chat ID." });
        }

        public class BroadcastNotificationDto
        {
            public string Title { get; set; } = string.Empty;
            public string Message { get; set; } = string.Empty;
            public string Severity { get; set; } = "info"; // "info" | "success" | "warning" | "error"
            public bool SendToTelegram { get; set; } = false;
        }

        /// <summary>
        /// Відправка загального сповіщення всім підключеним користувачам через SignalR
        /// </summary>
        [HttpPost("broadcast")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> Broadcast([FromBody] BroadcastNotificationDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Message))
            {
                return BadRequest("Заголовок та повідомлення є обов'язковими");
            }

            await _notifier.NotifyGeneralAsync(dto.Title, dto.Message, dto.Severity);

            if (dto.SendToTelegram && _telegramService.IsEnabled)
            {
                var telegramText = $"📢 <b>{dto.Title}</b>\n\n{dto.Message}\n\n<i>Відправник: {User.Identity?.Name ?? "Адміністратор"}</i>";
                _ = _telegramService.SendMessageAsync(telegramText);
            }

            return Ok(new { Message = "Сповіщення успішно розіслано" });
        }
    }
}
