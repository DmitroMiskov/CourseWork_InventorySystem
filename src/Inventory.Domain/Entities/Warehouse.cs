using System;
using System.Collections.Generic;

namespace Inventory.Domain.Entities
{
    public class Warehouse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string? Address { get; set; }
        public bool IsDefault { get; set; } = false;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string? Description { get; set; }

        public ICollection<WarehouseStock> Stocks { get; set; } = new List<WarehouseStock>();
    }
}
