using MediatR;

namespace Inventory.Application.Products.Commands.UpdateProduct
{
    public record UpdateProductCommand : IRequest
    {
        public Guid Id { get; init; }
        public string Sku { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public decimal Price { get; init; }
        
        // 👇 ДОДАЄМО ЦІ ДВА ПОЛЯ, яких не вистачало для компіляції
        public int MinStockLevel { get; init; }
        public string UnitOfMeasurement { get; init; } = string.Empty;
        public int Quantity { get; init; }
        
        public Guid CategoryId { get; init; }
    }
}