using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Inventory.Application.Common.Interfaces;
using Inventory.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Inventory.API.Services
{
    public class AuditService : IAuditService
    {
        private readonly IApplicationDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<AuditService> _logger;

        public AuditService(
            IApplicationDbContext context,
            IHttpContextAccessor httpContextAccessor,
            ILogger<AuditService> logger)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        public async Task LogAsync(
            string action,
            string entityType,
            string? entityId = null,
            string? entityName = null,
            string? details = null,
            string? oldValues = null,
            string? newValues = null,
            string? userName = null,
            string? userId = null,
            string? ipAddress = null)
        {
            try
            {
                var httpContext = _httpContextAccessor.HttpContext;
                var effectiveUserName = !string.IsNullOrWhiteSpace(userName)
                    ? userName
                    : (httpContext?.User?.Identity?.Name ?? "Система");

                var effectiveUserId = !string.IsNullOrWhiteSpace(userId)
                    ? userId
                    : httpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                var effectiveIp = !string.IsNullOrWhiteSpace(ipAddress)
                    ? ipAddress
                    : (httpContext?.Connection?.RemoteIpAddress?.ToString() ?? "127.0.0.1");

                var auditLog = new AuditLog
                {
                    Id = Guid.NewGuid(),
                    Action = action,
                    EntityType = entityType,
                    EntityId = entityId,
                    EntityName = entityName,
                    Details = details,
                    OldValues = oldValues,
                    NewValues = newValues,
                    UserName = effectiveUserName,
                    UserId = effectiveUserId,
                    IpAddress = effectiveIp,
                    Timestamp = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка при збереженні запису в журнал аудиту (AuditLog)");
            }
        }
    }
}
