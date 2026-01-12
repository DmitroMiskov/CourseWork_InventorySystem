using Inventory.Application.Common.Interfaces;
using Inventory.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Application.Categories.Queries.GetCategories
{
    public class GetCategoriesQueryHandler : IRequestHandler<GetCategoriesQuery, List<Category>>
    {
        private readonly IApplicationDbContext _context;

        public GetCategoriesQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<Category>> Handle(GetCategoriesQuery request, CancellationToken cancellationToken)
        {
            return await _context.Categories
                .AsNoTracking()
                .OrderBy(c => c.Name)
                .ToListAsync(cancellationToken);
        }
    }
}