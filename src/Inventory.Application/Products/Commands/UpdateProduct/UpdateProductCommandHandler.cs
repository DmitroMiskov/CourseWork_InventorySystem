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
            var entity = await _context.Products
                .FindAsync(new object[] { request.Id }, cancellationToken);

            if (entity == null)
            {
                return;
            }

            // 👇 УВАГА НА ЦІ РЯДКИ! 
            // Зліва — назви з Product.cs (Сутність)
            // Справа — назви з Command (те, що прийшло з React)

            entity.SKU = request.Sku;          // SKU (в базі великими) = Sku (з команди)
            entity.Name = request.Name;
            entity.Description = request.Description;
            entity.Price = request.Price;
            
            // 👇 ГОЛОВНЕ ВИПРАВЛЕННЯ:
            entity.MinStock = request.MinStockLevel;      // MinStock = MinStockLevel
            entity.Unit = request.UnitOfMeasurement;      // Unit = UnitOfMeasurement
            entity.Quantity = request.Quantity;
            
            entity.CategoryId = request.CategoryId;

            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}