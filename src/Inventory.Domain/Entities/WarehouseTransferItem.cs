using System;

namespace Inventory.Domain.Entities
{
    public class WarehouseTransferItem
    {
        public Guid Id { get; set; }
        
        public Guid WarehouseTransferId { get; set; }
        public WarehouseTransfer? WarehouseTransfer { get; set; }

        public Guid ProductId { get; set; }
        public Product? Product { get; set; }

        public int Quantity { get; set; }
        public string? Notes { get; set; }
    }
}
