using Inventory.Application.Common.Interfaces;
using MediatR;

namespace Inventory.Application.Categories.Commands.UpdateCategory
{
    public class UpdateCategoryCommandHandler : IRequestHandler<UpdateCategoryCommand>
    {
        private readonly IApplicationDbContext _context;

        public UpdateCategoryCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task Handle(UpdateCategoryCommand request, CancellationToken cancellationToken)
        {
            var entity = await _context.Categories
                .FindAsync(new object[] { request.Id }, cancellationToken);

            if (entity == null)
            {
                // Тут можна викинути ваш кастомний NotFoundException, якщо він є
                throw new KeyNotFoundException($"Category with ID {request.Id} not found.");
            }

            entity.Name = request.Name;

            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}