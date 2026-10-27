using System;
using System.Collections.Generic;
using Inventory.Domain.Enums;

namespace Inventory.API.Dtos
{
    public class CreatePurchaseOrderItemDto
    {
        public Guid ProductId { get; set; }
        public int OrderedQuantity { get; set; }
        public decimal UnitPrice { get; set; }
        public string? Notes { get; set; }
    }

    public class CreatePurchaseOrderDto
    {
        public string Title { get; set; } = string.Empty;
        public Guid SupplierId { get; set; }
        public DateTime? ExpectedDeliveryDate { get; set; }
        public string? Notes { get; set; }
        public List<CreatePurchaseOrderItemDto> Items { get; set; } = new();
    }

    public class UpdatePurchaseOrderDto
    {
        public string Title { get; set; } = string.Empty;
        public Guid SupplierId { get; set; }
        public DateTime? ExpectedDeliveryDate { get; set; }
        public string? Notes { get; set; }
        public List<CreatePurchaseOrderItemDto> Items { get; set; } = new();
    }

    public class ReceiveItemInputDto
    {
        public Guid ItemId { get; set; }
        public int QuantityToReceive { get; set; }
    }

    public class ReceivePurchaseOrderItemsDto
    {
        public List<ReceiveItemInputDto> Items { get; set; } = new();
        public string? Notes { get; set; }
    }

    public class PurchaseOrderItemDto
    {
        public Guid Id { get; set; }
        public Guid PurchaseOrderId { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string ProductSKU { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public int OrderedQuantity { get; set; }
        public int ReceivedQuantity { get; set; }
        public int RemainingQuantity => Math.Max(0, OrderedQuantity - ReceivedQuantity);
        public decimal UnitPrice { get; set; }
        public decimal TotalCost { get; set; }
        public string? Notes { get; set; }
    }

    public class PurchaseOrderSummaryDto
    {
        public Guid Id { get; set; }
        public string OrderNumber { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public Guid SupplierId { get; set; }
        public string SupplierName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? ExpectedDeliveryDate { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string CreatedByUserName { get; set; } = string.Empty;
        public string? ApprovedByUserName { get; set; }
        public PurchaseOrderStatus Status { get; set; }
        public decimal TotalAmount { get; set; }
        public int TotalItemsCount { get; set; }
        public int TotalOrderedQuantity { get; set; }
        public int TotalReceivedQuantity { get; set; }
        public string? Notes { get; set; }
    }

    public class PurchaseOrderDetailDto : PurchaseOrderSummaryDto
    {
        public List<PurchaseOrderItemDto> Items { get; set; } = new();
    }
}
