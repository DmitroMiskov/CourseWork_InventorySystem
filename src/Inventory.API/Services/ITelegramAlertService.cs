using Inventory.API.Models;

namespace Inventory.API.Services
{
    public interface ITelegramAlertService
    {
        bool IsConfigured { get; }
        bool IsEnabled { get; }
        TelegramSettings GetSettings();
        void UpdateSettings(string botToken, string chatId, bool enabled, bool notifyOnLowStock);
        Task<bool> SendMessageAsync(string htmlText);
        Task<bool> SendLowStockAlertAsync(string productName, int currentStock, int minStock);
        Task<bool> SendTestMessageAsync();
    }
}
