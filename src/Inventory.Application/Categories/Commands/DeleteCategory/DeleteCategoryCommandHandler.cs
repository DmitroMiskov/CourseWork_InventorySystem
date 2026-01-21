using Inventory.Application.Common.Interfaces;
using MediatR;

namespace Inventory.Application.Categories.Commands.DeleteCategory
{
    public class DeleteCategoryCommandHandler : IRequestHandler<DeleteCategoryCommand>
    {
        private readonly IApplicationDbContext _context;

        public DeleteCategoryCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task Handle(DeleteCategoryCommand request, CancellationToken cancellationToken)
        {
            var entity = await _context.Categories
                .FindAsync(new object[] { request.Id }, cancellationToken);

            if (entity == null)
            {
                // Якщо категорії немає, можна або викинути помилку, або просто вийти (ідемпотентність)
                // throw new KeyNotFoundException($"Category with ID {request.Id} not found.");
                return;
            }

            _context.Categories.Remove(entity);
            
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}