using Inventory.Domain.Entities;
using MediatR;

namespace Inventory.Application.Products.Commands.CreateProduct
{
    public record CreateProductCommand : IRequest<Guid>
    {
        public string SKU { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string? Description { get; init; }
        public decimal Price { get; init; }
        public int MinStock { get; init; }
        public string Unit { get; init; } = string.Empty;
        public int Quantity { get; init; }
        public Guid CategoryId { get; init; }
        public string? ImageUrl { get; init; }
    }
}