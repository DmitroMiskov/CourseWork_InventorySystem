using System;

namespace Inventory.Domain.Entities
{
    public class AuditLog
    {
        public Guid Id { get; set; }
        public string? UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty; // "Create" | "Update" | "Delete" | "StockOperation" | "Login" | "Security"
        public string EntityType { get; set; } = string.Empty; // "Product" | "Category" | "Supplier" | "Customer" | "StockMovement" | "User"
        public string? EntityId { get; set; }
        public string? EntityName { get; set; }
        public string? Details { get; set; }
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public string? IpAddress { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
