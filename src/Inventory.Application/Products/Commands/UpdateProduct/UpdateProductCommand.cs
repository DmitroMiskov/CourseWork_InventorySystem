using MediatR;

namespace Inventory.Application.Products.Commands.UpdateProduct
{
    // Команда містить ID товару, який ми міняємо, і нові дані
    public record UpdateProductCommand : IRequest
    {
        public Guid Id { get; init; }
        public string Sku { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public decimal Price { get; init; }
        public int MinStock { get; init; }
        public string Unit { get; init; } = string.Empty;
        public Guid CategoryId { get; init; }
    }
}