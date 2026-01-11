using Inventory.Domain.Entities;
using MediatR;

namespace Inventory.Application.Products.Queries.GetProducts
{
    // Запит повертає список сутностей Product
    public record GetProductsQuery : IRequest<List<Product>>;
}