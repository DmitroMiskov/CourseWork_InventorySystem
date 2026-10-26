using System;
using System.Collections.Generic;
using Inventory.Domain.Enums;

namespace Inventory.Domain.Entities
{
    public class InventoryAudit
    {
        public Guid Id { get; set; }
        public string AuditNumber { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }
        public string CreatedByUserName { get; set; } = string.Empty;
        public InventoryAuditStatus Status { get; set; } = InventoryAuditStatus.Draft;
        public Guid? CategoryId { get; set; }
        public Category? Category { get; set; }
        public string? Notes { get; set; }
        public int TotalItemsCount { get; set; }
        public int CheckedItemsCount { get; set; }
        public int DiscrepancyCount { get; set; }
        public decimal TotalSurplusCost { get; set; }
        public decimal TotalDeficitCost { get; set; }
        public ICollection<InventoryAuditItem> Items { get; set; } = new List<InventoryAuditItem>();
    }
}
