using System;
using System.Collections.Generic;
using Inventory.Domain.Enums;

namespace Inventory.Domain.Entities
{
    public class PurchaseOrder
    {
        public Guid Id { get; set; }
        public string OrderNumber { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public Guid SupplierId { get; set; }
        public Supplier? Supplier { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ExpectedDeliveryDate { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? CompletedAt { get; set; }

        public string CreatedByUserName { get; set; } = string.Empty;
        public string? ApprovedByUserName { get; set; }

        public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;

        public decimal TotalAmount { get; set; }
        public int TotalItemsCount { get; set; }
        public int TotalOrderedQuantity { get; set; }
        public int TotalReceivedQuantity { get; set; }

        public string? Notes { get; set; }

        public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
    }
}
