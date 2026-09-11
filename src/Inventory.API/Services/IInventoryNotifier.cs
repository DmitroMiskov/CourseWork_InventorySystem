using Inventory.API.Hubs;

namespace Inventory.API.Services
{
    public interface IInventoryNotifier
    {
        Task NotifyStockMovementAsync(StockMovementEvent movement);
        Task NotifyProductChangeAsync(ProductChangeEvent change);
        Task NotifyLowStockAsync(LowStockAlertEvent alert);
        Task NotifyGeneralAsync(string title, string message, string severity = "info");
    }
}
