using System;
using System.Collections.Generic;

namespace Inventory.API.Dtos
{
    public class ActiveAlertItemDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public int CurrentStock { get; set; }
        public int MinStock { get; set; }
        public int Deficit { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string Severity { get; set; } = "warning";
        public string StatusText { get; set; } = string.Empty;
    }

    public class ActiveAlertsSummaryDto
    {
        public int TotalAlerts { get; set; }
        public int OutStockCount { get; set; }
        public int LowStockCount { get; set; }
        public List<ActiveAlertItemDto> Alerts { get; set; } = new();
    }
}
