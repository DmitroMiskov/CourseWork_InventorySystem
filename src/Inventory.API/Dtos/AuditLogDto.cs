using System;
using System.Collections.Generic;

namespace Inventory.API.Dtos
{
    public class AuditLogItemDto
    {
        public Guid Id { get; set; }
        public string? UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string? EntityId { get; set; }
        public string? EntityName { get; set; }
        public string? Details { get; set; }
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public string? IpAddress { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class AuditLogListResponseDto
    {
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
        public List<AuditLogItemDto> Items { get; set; } = new();
    }

    public class AuditStatsDto
    {
        public int TotalLogs { get; set; }
        public int TodayLogs { get; set; }
        public int WeekLogs { get; set; }
        public Dictionary<string, int> ActionsBreakdown { get; set; } = new();
        public Dictionary<string, int> EntitiesBreakdown { get; set; } = new();
        public List<UserActivityDto> TopUsers { get; set; } = new();
    }

    public class UserActivityDto
    {
        public string UserName { get; set; } = string.Empty;
        public int ActionsCount { get; set; }
        public DateTime LastAction { get; set; }
    }
}
