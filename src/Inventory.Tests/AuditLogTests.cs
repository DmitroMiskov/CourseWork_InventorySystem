using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Inventory.API.Controllers;
using Inventory.API.Dtos;
using Inventory.API.Services;
using Inventory.Domain.Entities;
using Inventory.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Inventory.Tests
{
    public class AuditLogTests
    {
        private ApplicationDbContext CreateInMemoryContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new ApplicationDbContext(options);
        }

        private IHttpContextAccessor CreateMockHttpContextAccessor(string userName = "admin", string ip = "192.168.1.50")
        {
            var httpContext = new DefaultHttpContext();
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, userName),
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Role, "Admin")
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            httpContext.User = new ClaimsPrincipal(identity);
            httpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(ip);

            var accessor = new HttpContextAccessor { HttpContext = httpContext };
            return accessor;
        }

        [Fact]
        public async Task AuditService_LogAsync_CapturesContextAndSavesToDb()
        {
            using var context = CreateInMemoryContext();
            var accessor = CreateMockHttpContextAccessor("taras_admin", "10.0.0.1");
            var service = new AuditService(context, accessor, NullLogger<AuditService>.Instance);

            await service.LogAsync(
                action: "Create",
                entityType: "Product",
                entityId: "prod-123",
                entityName: "Монітор Dell",
                details: "Створено новий товар з початковим залишком 10 шт."
            );

            var log = await context.AuditLogs.FirstOrDefaultAsync();
            Assert.NotNull(log);
            Assert.Equal("Create", log.Action);
            Assert.Equal("Product", log.EntityType);
            Assert.Equal("prod-123", log.EntityId);
            Assert.Equal("Монітор Dell", log.EntityName);
            Assert.Equal("taras_admin", log.UserName);
            Assert.Equal("10.0.0.1", log.IpAddress);
        }

        [Fact]
        public async Task AuditLogsController_GetLogs_SupportsFiltersAndPagination()
        {
            using var context = CreateInMemoryContext();
            
            // Seed 5 sample logs
            context.AuditLogs.AddRange(
                new AuditLog { Id = Guid.NewGuid(), UserName = "admin", Action = "Create", EntityType = "Product", EntityName = "Laptop", Timestamp = DateTime.UtcNow.AddMinutes(-10) },
                new AuditLog { Id = Guid.NewGuid(), UserName = "admin", Action = "Update", EntityType = "Product", EntityName = "Laptop", Timestamp = DateTime.UtcNow.AddMinutes(-8) },
                new AuditLog { Id = Guid.NewGuid(), UserName = "manager", Action = "StockOperation", EntityType = "StockMovement", EntityName = "Laptop", Details = "Прихід +5", Timestamp = DateTime.UtcNow.AddMinutes(-5) },
                new AuditLog { Id = Guid.NewGuid(), UserName = "manager", Action = "Delete", EntityType = "Category", EntityName = "Архівне", Timestamp = DateTime.UtcNow.AddMinutes(-3) },
                new AuditLog { Id = Guid.NewGuid(), UserName = "worker", Action = "StockOperation", EntityType = "StockMovement", EntityName = "Mouse", Details = "Видача -2", Timestamp = DateTime.UtcNow.AddMinutes(-1) }
            );
            await context.SaveChangesAsync();

            var controller = new AuditLogsController(context);

            // 1. Pagination: Page 1, PageSize 2
            var resPage = await controller.GetLogs(page: 1, pageSize: 2);
            var okPage = Assert.IsType<OkObjectResult>(resPage.Result);
            var dataPage = Assert.IsType<AuditLogListResponseDto>(okPage.Value);
            Assert.Equal(5, dataPage.TotalCount);
            Assert.Equal(2, dataPage.Items.Count);
            Assert.Equal(3, dataPage.TotalPages);

            // 2. Filter by action "StockOperation"
            var resFilter = await controller.GetLogs(action: "StockOperation");
            var okFilter = Assert.IsType<OkObjectResult>(resFilter.Result);
            var dataFilter = Assert.IsType<AuditLogListResponseDto>(okFilter.Value);
            Assert.Equal(2, dataFilter.TotalCount);
            Assert.All(dataFilter.Items, item => Assert.Equal("StockOperation", item.Action));

            // 3. Search by text "Архівне"
            var resSearch = await controller.GetLogs(search: "Архівне");
            var okSearch = Assert.IsType<OkObjectResult>(resSearch.Result);
            var dataSearch = Assert.IsType<AuditLogListResponseDto>(okSearch.Value);
            Assert.Single(dataSearch.Items);
            Assert.Equal("Архівне", dataSearch.Items[0].EntityName);
        }

        [Fact]
        public async Task AuditLogsController_GetStats_AggregatesAccurately()
        {
            using var context = CreateInMemoryContext();

            context.AuditLogs.AddRange(
                new AuditLog { Id = Guid.NewGuid(), UserName = "admin", Action = "Create", EntityType = "Product", Timestamp = DateTime.UtcNow },
                new AuditLog { Id = Guid.NewGuid(), UserName = "admin", Action = "Update", EntityType = "Product", Timestamp = DateTime.UtcNow },
                new AuditLog { Id = Guid.NewGuid(), UserName = "manager", Action = "StockOperation", EntityType = "StockMovement", Timestamp = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();

            var controller = new AuditLogsController(context);
            var resStats = await controller.GetStats();
            var okStats = Assert.IsType<OkObjectResult>(resStats.Result);
            var stats = Assert.IsType<AuditStatsDto>(okStats.Value);

            Assert.Equal(3, stats.TotalLogs);
            Assert.Equal(3, stats.TodayLogs);
            Assert.Equal(2, stats.ActionsBreakdown["Create"] + stats.ActionsBreakdown["Update"]);
            Assert.Equal(2, stats.TopUsers.Count);
            Assert.Equal("admin", stats.TopUsers[0].UserName);
            Assert.Equal(2, stats.TopUsers[0].ActionsCount);
        }

        [Fact]
        public async Task AuditLogsController_ExportCsv_ReturnsValidFileResult()
        {
            using var context = CreateInMemoryContext();
            context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserName = "admin",
                Action = "Create",
                EntityType = "Product",
                EntityName = "Тестовий товар",
                Details = "Створено вручну",
                IpAddress = "127.0.0.1",
                Timestamp = DateTime.UtcNow
            });
            await context.SaveChangesAsync();

            var controller = new AuditLogsController(context);
            var result = await controller.ExportCsv();

            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("text/csv; charset=utf-8", fileResult.ContentType);
            Assert.Contains("audit_log_", fileResult.FileDownloadName);

            var csvText = Encoding.UTF8.GetString(fileResult.FileContents);
            Assert.Contains("ID;Timestamp;User;Action;EntityType;EntityName;Details;IP", csvText);
            Assert.Contains("Тестовий товар", csvText);
        }
    }
}
