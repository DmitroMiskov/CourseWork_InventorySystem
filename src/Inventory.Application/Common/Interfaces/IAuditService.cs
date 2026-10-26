using System.Threading.Tasks;

namespace Inventory.Application.Common.Interfaces
{
    public interface IAuditService
    {
        Task LogAsync(
            string action,
            string entityType,
            string? entityId = null,
            string? entityName = null,
            string? details = null,
            string? oldValues = null,
            string? newValues = null,
            string? userName = null,
            string? userId = null,
            string? ipAddress = null);
    }
}
