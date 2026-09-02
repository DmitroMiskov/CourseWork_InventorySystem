using MediatR;
using Microsoft.EntityFrameworkCore;
using Inventory.Application.Common.Interfaces;
using Inventory.Application.Common.Models;

namespace Inventory.Application.Products.Queries.GetProducts;

public class GetProductsQueryHandler : IRequestHandler<GetProductsQuery, PaginatedList<ProductDto>>
{
    private readonly IApplicationDbContext _context;

    public GetProductsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PaginatedList<ProductDto>> Handle(GetProductsQuery request, CancellationToken cancellationToken)
    {
        // 1. Починаємо формувати запит з AsNoTracking() для економії пам'яті
        var query = _context.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .AsQueryable();

        // 2. Опціональна фільтрація за категорією
        if (request.CategoryId.HasValue && request.CategoryId != Guid.Empty)
        {
            query = query.Where(p => p.CategoryId == request.CategoryId.Value);
        }

        // 3. Опціональний пошук за назвою або артикулом (SKU)
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var search = request.SearchTerm.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(search) || p.SKU.ToLower().Contains(search));
        }

        // 4. Підрахунок загальної кількості (COUNT запит у PostgreSQL)
        var totalCount = await query.CountAsync(cancellationToken);

        // 5. Вибірка конкретної сторінки та проекція у DTO
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => new ProductDto
            {
                Id = p.Id,
                SKU = p.SKU,
                Name = p.Name,
                Description = p.Description,
                Unit = p.Unit,
                Price = p.Price,
                Quantity = p.Quantity,
                MinStock = p.MinStock,
                ImageUrl = p.ImageUrl,
                CategoryId = p.CategoryId,
                CategoryName = p.Category != null ? p.Category.Name : null
            })
            .ToListAsync(cancellationToken);

        return new PaginatedList<ProductDto>(items, totalCount, request.PageNumber, request.PageSize);
    }
}