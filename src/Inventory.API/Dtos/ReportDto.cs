using System;
using System.Collections.Generic;

namespace Inventory.API.Dtos
{
    public class TurnoverItemDto
    {
        public Guid ProductId { get; set; }
        public string ProductSKU { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }

        public int OpeningQuantity { get; set; }
        public decimal OpeningAmount { get; set; }

        public int InflowQuantity { get; set; }
        public decimal InflowAmount { get; set; }

        public int OutflowQuantity { get; set; }
        public decimal OutflowAmount { get; set; }

        public int ClosingQuantity { get; set; }
        public decimal ClosingAmount { get; set; }
    }

    public class TurnoverStatementDto
    {
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

        public int TotalProductsCount { get; set; }
        public decimal TotalOpeningAmount { get; set; }
        public decimal TotalInflowAmount { get; set; }
        public decimal TotalOutflowAmount { get; set; }
        public decimal TotalClosingAmount { get; set; }
        public int TotalInflowQuantity { get; set; }
        public int TotalOutflowQuantity { get; set; }

        public List<TurnoverItemDto> Items { get; set; } = new();
    }

    public class CategoryValuationDto
    {
        public Guid CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public int ProductsCount { get; set; }
        public int TotalQuantity { get; set; }
        public decimal TotalValuation { get; set; }
        public decimal SharePercentage { get; set; }
    }

    public class StockValuationReportDto
    {
        public DateTime AsOfDate { get; set; } = DateTime.UtcNow;
        public int TotalItemsCount { get; set; }
        public int TotalStockQuantity { get; set; }
        public decimal TotalWarehouseValuation { get; set; }
        public List<CategoryValuationDto> Categories { get; set; } = new();
    }

    public class PartnerActivityDto
    {
        public Guid PartnerId { get; set; }
        public string PartnerName { get; set; } = string.Empty;
        public string PartnerType { get; set; } = string.Empty; // "Supplier" | "Customer"
        public int OperationsCount { get; set; }
        public int TotalQuantity { get; set; }
        public decimal TotalEstimatedCost { get; set; }
        public DateTime? LastActivityDate { get; set; }
    }

    public class PartnersReportDto
    {
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public List<PartnerActivityDto> TopSuppliers { get; set; } = new();
        public List<PartnerActivityDto> TopCustomers { get; set; } = new();
    }
}
