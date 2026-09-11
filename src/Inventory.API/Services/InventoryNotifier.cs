using Inventory.API.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Inventory.API.Services
{
    public class InventoryNotifier : IInventoryNotifier
    {
        private readonly IHubContext<InventoryHub> _hubContext;
        private readonly ILogger<InventoryNotifier> _logger;

        public InventoryNotifier(IHubContext<InventoryHub> hubContext, ILogger<InventoryNotifier> logger)
        {
            _hubContext = hubContext;
            _logger = logger;
        }

        public async Task NotifyStockMovementAsync(StockMovementEvent movement)
        {
            try
            {
                // 1. Надсилаємо подію руху товару
                await _hubContext.Clients.All.SendAsync("ReceiveStockMovement", movement);

                // 2. Формуємо текстове сповіщення
                var actionLabel = movement.Type == "In" ? "Прихід" : "Видача / Списання";
                var sign = movement.Type == "In" ? "+" : "-";
                var severity = movement.Type == "In" ? "success" : "info";

                var notification = new GeneralNotificationEvent
                {
                    Title = $"Складська операція: {actionLabel}",
                    Message = $"{movement.UserName}: {movement.ProductName} ({sign}{movement.Quantity} шт.). Залишок: {movement.NewStock} шт.",
                    Severity = severity,
                    Timestamp = DateTime.UtcNow
                };

                await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка відправки SignalR-сповіщення про рух товару");
            }
        }

        public async Task NotifyProductChangeAsync(ProductChangeEvent change)
        {
            try
            {
                await _hubContext.Clients.All.SendAsync("ReceiveProductChange", change);

                var severity = change.Action switch
                {
                    "Created" => "success",
                    "Deleted" => "warning",
                    "StockUpdated" => "info",
                    "Imported" => "success",
                    _ => "info"
                };

                var notification = new GeneralNotificationEvent
                {
                    Title = "Оновлення номенклатури",
                    Message = change.Message ?? $"Товар {change.ProductName}: {change.Action}",
                    Severity = severity,
                    Timestamp = DateTime.UtcNow
                };

                await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка відправки SignalR-сповіщення про зміну товару");
            }
        }

        public async Task NotifyLowStockAsync(LowStockAlertEvent alert)
        {
            try
            {
                await _hubContext.Clients.All.SendAsync("ReceiveLowStockAlert", alert);

                var notification = new GeneralNotificationEvent
                {
                    Title = "УВАГА: Критичний залишок!",
                    Message = $"Запас товару '{alert.ProductName}' впав до {alert.CurrentStock} шт. (мін. поріг: {alert.MinStock} шт.)",
                    Severity = "warning",
                    Timestamp = DateTime.UtcNow
                };

                await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка відправки SignalR-сповіщення про низький залишок");
            }
        }

        public async Task NotifyGeneralAsync(string title, string message, string severity = "info")
        {
            try
            {
                var notification = new GeneralNotificationEvent
                {
                    Title = title,
                    Message = message,
                    Severity = severity,
                    Timestamp = DateTime.UtcNow
                };

                await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка відправки SignalR загального сповіщення");
            }
        }
    }
}
