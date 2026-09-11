namespace Inventory.API.Hubs
{
    public class StockMovementEvent
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty; // "In" | "Out"
        public int Quantity { get; set; }
        public int NewStock { get; set; }
        public string? Reason { get; set; }
        public string? SupplierName { get; set; }
        public string? CustomerName { get; set; }
        public string UserName { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class ProductChangeEvent
    {
        public string Action { get; set; } = string.Empty; // "Created" | "Updated" | "Deleted" | "StockUpdated" | "Imported"
        public Guid? ProductId { get; set; }
        public string? ProductName { get; set; }
        public int? NewQuantity { get; set; }
        public string? Message { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class LowStockAlertEvent
    {
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public int CurrentStock { get; set; }
        public int MinStock { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class GeneralNotificationEvent
    {
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Severity { get; set; } = "info"; // "info" | "success" | "warning" | "error"
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
