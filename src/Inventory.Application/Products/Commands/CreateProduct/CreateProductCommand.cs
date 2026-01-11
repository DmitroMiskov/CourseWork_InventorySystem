using Inventory.Domain.Entities;
using MediatR;
using Microsoft.IdentityModel.Tokens;

namespace Inventory.Application.Products.Commands.CreateProduct
{
    public class CreateProductCommand : IRequest<Product>
    {
        public string SKU {get; init;} = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public decimal Price { get; init; }
        public int MinStock { get; init; }
        public string Unit { get; init; } = string.Empty;
        public Guid CategoryId { get; init; }
    }
}