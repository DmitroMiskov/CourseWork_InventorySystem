using MediatR;

namespace Inventory.Application.Products.Commands.DeleteProduct
{
    // Команда приймає лише ID товару, який треба видалити
    public record DeleteProductCommand(Guid Id) : IRequest;
}