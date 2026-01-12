using Inventory.Application.Common.Interfaces;
using MediatR;

namespace Inventory.Application.Products.Commands.UpdateProduct
{
    public class UpdateProductCommandHandler : IRequestHandler<UpdateProductCommand>
    {
        private readonly IApplicationDbContext _context;

        public UpdateProductCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task Handle(UpdateProductCommand request, CancellationToken cancellationToken)
        {
            // 1. Шукаємо товар в базі
            var entity = await _context.Products
                .FindAsync(new object[] { request.Id }, cancellationToken);

            if (entity == null)
            {
                return;
            }

            // 2. Оновлюємо поля
            entity.SKU = request.Sku;
            entity.Name = request.Name;
            entity.Description = request.Description;
            entity.Price = request.Price;
            entity.MinStock = request.MinStock;
            entity.Unit = request.Unit;
            entity.CategoryId = request.CategoryId;

            // 3. Зберігаємо зміни
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}