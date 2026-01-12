using Inventory.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Application.Products.Commands.DeleteProduct
{
    public class DeleteProductCommandHandler : IRequestHandler<DeleteProductCommand>
    {
        private readonly IApplicationDbContext _context;

        public DeleteProductCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task Handle(DeleteProductCommand request, CancellationToken cancellationToken)
        {
            // Знаходимо товар
            var entity = await _context.Products
                .FindAsync(new object[] { request.Id }, cancellationToken);

            // Якщо не знайшли — нічого не робимо (або можна кинути помилку)
            if (entity == null)
            {
                return;
            }

            // Видаляємо
            _context.Products.Remove(entity);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}