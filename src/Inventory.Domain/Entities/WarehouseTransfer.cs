using System;
using System.Collections.Generic;
using Inventory.Domain.Enums;

namespace Inventory.Domain.Entities
{
    public class WarehouseTransfer
    {
        public Guid Id { get; set; }
        public string TransferNumber { get; set; } = string.Empty;
        
        public Guid FromWarehouseId { get; set; }
        public Warehouse? FromWarehouse { get; set; }

        public Guid ToWarehouseId { get; set; }
        public Warehouse? ToWarehouse { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }
        
        public string CreatedByUserName { get; set; } = string.Empty;
        public TransferStatus Status { get; set; } = TransferStatus.Draft;
        public string? Notes { get; set; }

        public int TotalItemsCount { get; set; }
        public int TotalQuantity { get; set; }

        public ICollection<WarehouseTransferItem> Items { get; set; } = new List<WarehouseTransferItem>();
    }
}
