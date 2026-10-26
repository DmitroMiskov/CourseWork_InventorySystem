using System;
using System.Collections.Generic;
using Inventory.Domain.Enums;

namespace Inventory.API.Dtos
{
    public class CreateInventoryAuditDto
    {
        public string Title { get; set; } = string.Empty;
        public Guid? CategoryId { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdateAuditItemQuantityDto
    {
        public Guid ItemId { get; set; }
        public int? ActualQuantity { get; set; }
        public string? Notes { get; set; }
    }

    public class BatchUpdateAuditItemsDto
    {
        public List<UpdateAuditItemQuantityDto> Items { get; set; } = new();
    }

    public class InventoryAuditItemDto
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string ProductSKU { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public int ExpectedQuantity { get; set; }
        public int? ActualQuantity { get; set; }
        public int? Discrepancy { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal DiscrepancyCost { get; set; }
        public DiscrepancyStatus Status { get; set; }
        public string? Notes { get; set; }
    }

    public class InventoryAuditSummaryDto
    {
        public Guid Id { get; set; }
        public string AuditNumber { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string CreatedByUserName { get; set; } = string.Empty;
        public InventoryAuditStatus Status { get; set; }
        public Guid? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public string? Notes { get; set; }
        public int TotalItemsCount { get; set; }
        public int CheckedItemsCount { get; set; }
        public int DiscrepancyCount { get; set; }
        public decimal TotalSurplusCost { get; set; }
        public decimal TotalDeficitCost { get; set; }
        public decimal NetDifferenceCost => TotalSurplusCost - TotalDeficitCost;
    }

    public class InventoryAuditDetailDto : InventoryAuditSummaryDto
    {
        public List<InventoryAuditItemDto> Items { get; set; } = new();
    }

    public class CompleteAuditResultDto
    {
        public Guid AuditId { get; set; }
        public int AdjustedProductsCount { get; set; }
        public int SurplusMovementsCount { get; set; }
        public int DeficitMovementsCount { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
