using Inventory.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Threading;

namespace Inventory.Application.Common.Interfaces
{
    public interface IApplicationDbContext
    {
        DbSet<Product> Products { get; }
        DbSet<Category> Categories { get; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken);
    }
}