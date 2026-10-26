using System;
using Inventory.Domain.Enums;

namespace Inventory.Domain.Entities
{
    public class InventoryAuditItem
    {
        public Guid Id { get; set; }
        public Guid InventoryAuditId { get; set; }
        public InventoryAudit? InventoryAudit { get; set; }
        public Guid ProductId { get; set; }
        public Product? Product { get; set; }
        public int ExpectedQuantity { get; set; }
        public int? ActualQuantity { get; set; }
        public int? Discrepancy { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal DiscrepancyCost { get; set; }
        public DiscrepancyStatus Status { get; set; } = DiscrepancyStatus.Pending;
        public string? Notes { get; set; }
    }
}
