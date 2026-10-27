using System;

namespace Inventory.Domain.Entities
{
    public class WarehouseStock
    {
        public Guid Id { get; set; }
        
        public Guid WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        public Guid ProductId { get; set; }
        public Product? Product { get; set; }

        public int Quantity { get; set; }
        public int? MinStock { get; set; }
        public string? LocationZone { get; set; }
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    }
}
