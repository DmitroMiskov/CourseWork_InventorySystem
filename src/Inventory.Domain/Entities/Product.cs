using System;

namespace Inventory.Domain.Entities
{
    public class Product
    {
        public Guid Id { get; set; }
        public string SKU { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Unit { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int MinStock { get; set; }
        public int Quantity { get; set; }
        public string? ImageUrl { get; set; }
        public Guid CategoryId { get; set; }
        public Category? Category { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}