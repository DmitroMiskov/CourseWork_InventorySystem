using System;
using System.Collections.Generic;
using Inventory.Domain.Enums;

namespace Inventory.API.Dtos
{
    public class WarehouseSummaryDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string? Address { get; set; }
        public bool IsDefault { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? Description { get; set; }
        public int TotalItemsCount { get; set; }
        public int TotalQuantity { get; set; }
        public decimal TotalValuation { get; set; }
    }

    public class CreateWarehouseDto
    {
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string? Address { get; set; }
        public bool IsDefault { get; set; }
        public string? Description { get; set; }
    }

    public class UpdateWarehouseDto
    {
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string? Address { get; set; }
        public bool IsDefault { get; set; }
        public bool IsActive { get; set; } = true;
        public string? Description { get; set; }
    }

    public class WarehouseStockDto
    {
        public Guid Id { get; set; }
        public Guid WarehouseId { get; set; }
        public string WarehouseName { get; set; } = string.Empty;
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string ProductSKU { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public int? MinStock { get; set; }
        public string? LocationZone { get; set; }
        public decimal TotalValuation => Quantity * UnitPrice;
        public DateTime LastUpdated { get; set; }
    }

    public class UpdateWarehouseStockLocationDto
    {
        public string? LocationZone { get; set; }
        public int? MinStock { get; set; }
    }

    public class CreateWarehouseTransferItemInput
    {
        public Guid ProductId { get; set; }
        public int Quantity { get; set; }
        public string? Notes { get; set; }
    }

    public class CreateWarehouseTransferDto
    {
        public Guid FromWarehouseId { get; set; }
        public Guid ToWarehouseId { get; set; }
        public string? Notes { get; set; }
        public bool CompleteImmediately { get; set; } = false;
        public List<CreateWarehouseTransferItemInput> Items { get; set; } = new();
    }

    public class WarehouseTransferItemDto
    {
        public Guid Id { get; set; }
        public Guid WarehouseTransferId { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string ProductSKU { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public string? Notes { get; set; }
    }

    public class WarehouseTransferDto
    {
        public Guid Id { get; set; }
        public string TransferNumber { get; set; } = string.Empty;
        public Guid FromWarehouseId { get; set; }
        public string FromWarehouseName { get; set; } = string.Empty;
        public Guid ToWarehouseId { get; set; }
        public string ToWarehouseName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string CreatedByUserName { get; set; } = string.Empty;
        public TransferStatus Status { get; set; }
        public string? Notes { get; set; }
        public int TotalItemsCount { get; set; }
        public int TotalQuantity { get; set; }
        public List<WarehouseTransferItemDto> Items { get; set; } = new();
    }

    public class WarehouseStockItemDto
    {
        public Guid StockId { get; set; }
        public Guid WarehouseId { get; set; }
        public string WarehouseName { get; set; } = string.Empty;
        public string WarehouseCode { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public int? MinStock { get; set; }
        public string? LocationZone { get; set; }
    }

    public class ProductStockDistributionDto
    {
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string SKU { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int TotalQuantity { get; set; }
        public List<WarehouseStockItemDto> Warehouses { get; set; } = new();
    }
}
