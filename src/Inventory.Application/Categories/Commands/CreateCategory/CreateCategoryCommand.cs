using MediatR;

namespace Inventory.Application.Categories.Commands.CreateCategory
{
    public record CreateCategoryCommand : IRequest<Guid>
    {
        public string Name { get; init; } = string.Empty;
    }
}