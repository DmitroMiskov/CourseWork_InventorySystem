using Inventory.Application.Common.Interfaces;
using Inventory.Domain.Entities;
using MediatR;

namespace Inventory.Application.Categories.Commands.CreateCategory
{
    public class CreateCategoryCommandHandler : IRequestHandler<CreateCategoryCommand, Guid>
    {
        private readonly IApplicationDbContext _context;

        public CreateCategoryCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Handle(CreateCategoryCommand request, CancellationToken cancellationToken)
        {
            var entity = new Category
            {
                Id = Guid.NewGuid(),
                Name = request.Name
            };

            _context.Categories.Add(entity);
            await _context.SaveChangesAsync(cancellationToken);

            return entity.Id;
        }
    }
}