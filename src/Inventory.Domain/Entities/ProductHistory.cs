using System;

namespace Inventory.Domain.Entities
{
    public class ProductHistory
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        public Guid ProductId { get; set; } // Якого товару це стосується
        
        public int Change { get; set; }     // Зміна кількості (+10, -5)
        
        public int StockAfter { get; set; } // Скільки стало після операції
        
        public string Note { get; set; } = string.Empty; // Коментар (наприклад "Видача")
        
        public string UserName { get; set; } = string.Empty; // Хто це зробив
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow; // Коли
    }
}