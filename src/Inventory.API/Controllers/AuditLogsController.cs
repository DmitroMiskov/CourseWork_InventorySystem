using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Inventory.Application.Common.Interfaces;
using Inventory.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AuditLogsController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public AuditLogsController(IApplicationDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Отримання журналу аудиту з пагінацією та фільтрами
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<AuditLogListResponseDto>> GetLogs(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string? action = null,
            [FromQuery] string? entityType = null,
            [FromQuery] string? userName = null,
            [FromQuery] string? search = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 25;
            if (pageSize > 100) pageSize = 100;

            var query = _context.AuditLogs.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(action))
            {
                query = query.Where(a => a.Action.ToLower() == action.ToLower());
            }

            if (!string.IsNullOrWhiteSpace(entityType))
            {
                query = query.Where(a => a.EntityType.ToLower() == entityType.ToLower());
            }

            if (!string.IsNullOrWhiteSpace(userName))
            {
                query = query.Where(a => a.UserName.ToLower().Contains(userName.ToLower()));
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(a => 
                    a.UserName.ToLower().Contains(searchLower) ||
                    (a.EntityName != null && a.EntityName.ToLower().Contains(searchLower)) ||
                    (a.Details != null && a.Details.ToLower().Contains(searchLower)) ||
                    (a.EntityId != null && a.EntityId.ToLower().Contains(searchLower)));
            }

            if (fromDate.HasValue)
            {
                var utcFrom = DateTime.SpecifyKind(fromDate.Value, DateTimeKind.Utc);
                query = query.Where(a => a.Timestamp >= utcFrom);
            }

            if (toDate.HasValue)
            {
                var utcTo = DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc);
                query = query.Where(a => a.Timestamp <= utcTo);
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(a => a.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new AuditLogItemDto
                {
                    Id = a.Id,
                    UserId = a.UserId,
                    UserName = a.UserName,
                    Action = a.Action,
                    EntityType = a.EntityType,
                    EntityId = a.EntityId,
                    EntityName = a.EntityName,
                    Details = a.Details,
                    OldValues = a.OldValues,
                    NewValues = a.NewValues,
                    IpAddress = a.IpAddress,
                    Timestamp = a.Timestamp
                })
                .ToListAsync();

            return Ok(new AuditLogListResponseDto
            {
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                Items = items
            });
        }

        /// <summary>
        /// Зведена статистика та KPI журналу аудиту
        /// </summary>
        [HttpGet("stats")]
        public async Task<ActionResult<AuditStatsDto>> GetStats()
        {
            var now = DateTime.UtcNow;
            var today = now.Date;
            var weekAgo = now.AddDays(-7);

            var totalLogs = await _context.AuditLogs.AsNoTracking().CountAsync();
            var todayLogs = await _context.AuditLogs.AsNoTracking().CountAsync(a => a.Timestamp >= today);
            var weekLogs = await _context.AuditLogs.AsNoTracking().CountAsync(a => a.Timestamp >= weekAgo);

            var actions = await _context.AuditLogs
                .AsNoTracking()
                .GroupBy(a => a.Action)
                .Select(g => new { Action = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Action, x => x.Count);

            var entities = await _context.AuditLogs
                .AsNoTracking()
                .GroupBy(a => a.EntityType)
                .Select(g => new { Entity = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Entity, x => x.Count);

            var topUsers = await _context.AuditLogs
                .AsNoTracking()
                .GroupBy(a => a.UserName)
                .Select(g => new UserActivityDto
                {
                    UserName = g.Key,
                    ActionsCount = g.Count(),
                    LastAction = g.Max(a => a.Timestamp)
                })
                .OrderByDescending(u => u.ActionsCount)
                .Take(5)
                .ToListAsync();

            return Ok(new AuditStatsDto
            {
                TotalLogs = totalLogs,
                TodayLogs = todayLogs,
                WeekLogs = weekLogs,
                ActionsBreakdown = actions,
                EntitiesBreakdown = entities,
                TopUsers = topUsers
            });
        }

        /// <summary>
        /// Експорт журналу в CSV формат
        /// </summary>
        [HttpGet("export")]
        public async Task<IActionResult> ExportCsv(
            [FromQuery] string? action = null,
            [FromQuery] string? entityType = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            var query = _context.AuditLogs.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(action))
                query = query.Where(a => a.Action.ToLower() == action.ToLower());

            if (!string.IsNullOrWhiteSpace(entityType))
                query = query.Where(a => a.EntityType.ToLower() == entityType.ToLower());

            if (fromDate.HasValue)
                query = query.Where(a => a.Timestamp >= DateTime.SpecifyKind(fromDate.Value, DateTimeKind.Utc));

            if (toDate.HasValue)
                query = query.Where(a => a.Timestamp <= DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc));

            var logs = await query
                .OrderByDescending(a => a.Timestamp)
                .Take(5000)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine("ID;Timestamp;User;Action;EntityType;EntityName;Details;IP");

            foreach (var log in logs)
            {
                var cleanDetails = (log.Details ?? string.Empty).Replace(";", " ").Replace("\n", " ").Replace("\r", " ");
                var cleanName = (log.EntityName ?? string.Empty).Replace(";", " ");
                sb.AppendLine($"{log.Id};{log.Timestamp:yyyy-MM-dd HH:mm:ss};{log.UserName};{log.Action};{log.EntityType};\"{cleanName}\";\"{cleanDetails}\";{log.IpAddress}");
            }

            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
            var fileName = $"audit_log_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv";

            return File(bytes, "text/csv; charset=utf-8", fileName);
        }
    }
}
