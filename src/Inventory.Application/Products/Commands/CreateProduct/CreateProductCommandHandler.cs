using System.Reflection.Metadata;
using Inventory.Domain.Entities;
using Inventory.Application.Common.Interfaces;
using MediatR;

namespace Inventory.Application.Products.Commands.CreateProduct
{
    public class CreateProductCommandHandler : IRequestHandler<CreateProductCommand, Guid>
    {
        private readonly IApplicationDbContext _context;

        public CreateProductCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Handle(CreateProductCommand request, CancellationToken cancellationToken)
        {
            var entity = new Product
            {
                Id = Guid.NewGuid(),
                SKU = request.SKU,
                Name = request.Name,
                Description = request.Description,
                Price = request.Price,
                MinStock = request.MinStock,
                Unit = request.Unit,
                CategoryId = request.CategoryId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Products.Add(entity);
            await _context.SaveChangesAsync(cancellationToken);
            return entity.Id;
        }
    }
}