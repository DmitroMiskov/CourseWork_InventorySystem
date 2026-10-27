using System;
using Inventory.Domain.Enums;

namespace Inventory.Domain.Entities
{
    public class StockMovement
    {
        public Guid Id { get; set; }
        
        // Який товар рухаємо
        public Guid ProductId { get; set; }
        public Product? Product { get; set; }

        // Дата операції
        public DateTime MovementDate { get; set; } = DateTime.UtcNow;

        // Тип (Прихід/Розхід/Переміщення)
        public MovementType Type { get; set; }

        // Скільки штук
        public int Quantity { get; set; }

        // Примітка (наприклад: "Накладна №123" або "Брак")
        public string? Note { get; set; }

        public Guid? SupplierId { get; set; }
        public Supplier? Supplier { get; set; }

        public Guid? CustomerId { get; set; }
        public Customer? Customer { get; set; }

        // Прив'язка до складу (відправник або основний склад)
        public Guid? WarehouseId { get; set; }
        public Warehouse? Warehouse { get; set; }

        // Прив'язка до складу-одержувача (для типу Transfer)
        public Guid? ToWarehouseId { get; set; }
        public Warehouse? ToWarehouse { get; set; }
    }
}
