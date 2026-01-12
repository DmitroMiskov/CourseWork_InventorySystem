using Inventory.Domain.Entities;
using MediatR;

namespace Inventory.Application.Categories.Queries.GetCategories
{
    public record GetCategoriesQuery : IRequest<List<Category>>;
}