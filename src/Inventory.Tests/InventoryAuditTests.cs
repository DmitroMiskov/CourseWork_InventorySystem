using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Inventory.API.Controllers;
using Inventory.API.Dtos;
using Inventory.API.Hubs;
using Inventory.API.Services;
using Inventory.Application.Common.Interfaces;
using Inventory.Domain.Entities;
using Inventory.Domain.Enums;
using Inventory.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Inventory.Tests
{
    public class InventoryAuditTests
    {
        private ApplicationDbContext CreateInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new ApplicationDbContext(options);
        }

        private class FakeNotifier : IInventoryNotifier
        {
            public List<string> Messages { get; } = new();
            public List<ProductChangeEvent> ProductChanges { get; } = new();

            public Task NotifyGeneralAsync(string title, string message, string severity = "info")
            {
                Messages.Add($"{title}: {message}");
                return Task.CompletedTask;
            }

            public Task NotifyLowStockAsync(LowStockAlertEvent alert)
            {
                return Task.CompletedTask;
            }

            public Task NotifyProductChangeAsync(ProductChangeEvent change)
            {
                ProductChanges.Add(change);
                return Task.CompletedTask;
            }

            public Task NotifyStockMovementAsync(StockMovementEvent movement)
            {
                return Task.CompletedTask;
            }
        }

        private class FakeAuditService : IAuditService
        {
            public List<AuditLog> Logs { get; } = new();

            public Task LogAsync(
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
                Logs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    Action = action,
                    EntityType = entityType,
                    EntityId = entityId,
                    EntityName = entityName,
                    Details = details,
                    OldValues = oldValues,
                    NewValues = newValues,
                    UserName = userName ?? "System",
                    UserId = userId,
                    IpAddress = ipAddress,
                    Timestamp = DateTime.UtcNow
                });
                return Task.CompletedTask;
            }
        }

        private InventoryAuditsController CreateController(
            ApplicationDbContext context,
            FakeNotifier? notifier = null,
            FakeAuditService? auditService = null,
            string userName = "AdminUser")
        {
            notifier ??= new FakeNotifier();
            auditService ??= new FakeAuditService();

            var controller = new InventoryAuditsController(context, notifier, auditService);

            var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Name, userName),
                new Claim(ClaimTypes.Role, "Admin")
            }, "TestAuth"));

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };

            return controller;
        }

        [Fact]
        public async Task CreateAudit_Should_Create_Items_For_All_Products_With_ExpectedQuantity()
        {
            using var context = CreateInMemoryDbContext();
            var category = new Category { Id = Guid.NewGuid(), Name = "Hardware" };
            context.Categories.Add(category);

            var product1 = new Product { Id = Guid.NewGuid(), SKU = "P001", Name = "Monitor", Price = 5000, Quantity = 10, CategoryId = category.Id };
            var product2 = new Product { Id = Guid.NewGuid(), SKU = "P002", Name = "Keyboard", Price = 1200, Quantity = 25, CategoryId = category.Id };
            context.Products.AddRange(product1, product2);
            await context.SaveChangesAsync();

            var controller = CreateController(context);
            var result = await controller.Create(new CreateInventoryAuditDto
            {
                Title = "Річний переоблік 2026",
                CategoryId = category.Id
            });

            var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
            var summary = Assert.IsType<InventoryAuditSummaryDto>(createdResult.Value);

            Assert.Equal("Річний переоблік 2026", summary.Title);
            Assert.Equal(2, summary.TotalItemsCount);
            Assert.Equal(InventoryAuditStatus.Draft, summary.Status);

            var auditInDb = await context.InventoryAudits.Include(a => a.Items).FirstOrDefaultAsync(a => a.Id == summary.Id);
            Assert.NotNull(auditInDb);
            Assert.Equal(2, auditInDb.Items.Count);

            var item1 = auditInDb.Items.First(i => i.ProductId == product1.Id);
            Assert.Equal(10, item1.ExpectedQuantity);
            Assert.Null(item1.ActualQuantity);
            Assert.Equal(DiscrepancyStatus.Pending, item1.Status);
        }

        [Fact]
        public async Task UpdateItems_Should_Calculate_Discrepancies_And_Totals_Correctly()
        {
            using var context = CreateInMemoryDbContext();
            var product1 = new Product { Id = Guid.NewGuid(), SKU = "P001", Name = "Monitor", Price = 5000, Quantity = 10 };
            var product2 = new Product { Id = Guid.NewGuid(), SKU = "P002", Name = "Mouse", Price = 500, Quantity = 20 };
            context.Products.AddRange(product1, product2);

            var audit = new InventoryAudit
            {
                Id = Guid.NewGuid(),
                AuditNumber = "INV-20261026-001",
                Title = "Тест",
                CreatedAt = DateTime.UtcNow,
                CreatedByUserName = "Admin",
                Status = InventoryAuditStatus.Draft,
                TotalItemsCount = 2
            };

            var item1 = new InventoryAuditItem
            {
                Id = Guid.NewGuid(),
                InventoryAuditId = audit.Id,
                ProductId = product1.Id,
                ExpectedQuantity = 10,
                UnitPrice = 5000,
                Status = DiscrepancyStatus.Pending
            };

            var item2 = new InventoryAuditItem
            {
                Id = Guid.NewGuid(),
                InventoryAuditId = audit.Id,
                ProductId = product2.Id,
                ExpectedQuantity = 20,
                UnitPrice = 500,
                Status = DiscrepancyStatus.Pending
            };

            audit.Items.Add(item1);
            audit.Items.Add(item2);
            context.InventoryAudits.Add(audit);
            await context.SaveChangesAsync();

            var controller = CreateController(context);

            // Item 1: Actual = 12 (Лишок +2, +10000 грн)
            // Item 2: Actual = 18 (Нестача -2, -1000 грн)
            var updateDto = new BatchUpdateAuditItemsDto
            {
                Items = new List<UpdateAuditItemQuantityDto>
                {
                    new UpdateAuditItemQuantityDto { ItemId = item1.Id, ActualQuantity = 12 },
                    new UpdateAuditItemQuantityDto { ItemId = item2.Id, ActualQuantity = 18 }
                }
            };

            var result = await controller.UpdateItems(audit.Id, updateDto);
            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var detail = Assert.IsType<InventoryAuditDetailDto>(okResult.Value);

            Assert.Equal(InventoryAuditStatus.InProgress, detail.Status);
            Assert.Equal(2, detail.CheckedItemsCount);
            Assert.Equal(2, detail.DiscrepancyCount);
            Assert.Equal(10000m, detail.TotalSurplusCost);
            Assert.Equal(1000m, detail.TotalDeficitCost);
            Assert.Equal(2, detail.Items.Count);

            var detailItem1 = detail.Items.First(i => i.Id == item1.Id);
            Assert.Equal(12, detailItem1.ActualQuantity);
            Assert.Equal(2, detailItem1.Discrepancy);
            Assert.Equal(DiscrepancyStatus.Surplus, detailItem1.Status);

            var detailItem2 = detail.Items.First(i => i.Id == item2.Id);
            Assert.Equal(18, detailItem2.ActualQuantity);
            Assert.Equal(-2, detailItem2.Discrepancy);
            Assert.Equal(DiscrepancyStatus.Deficit, detailItem2.Status);
        }

        [Fact]
        public async Task CompleteAudit_Should_Adjust_Product_Quantities_And_Create_StockMovements()
        {
            using var context = CreateInMemoryDbContext();
            var product1 = new Product { Id = Guid.NewGuid(), SKU = "P001", Name = "Monitor", Price = 5000, Quantity = 10 };
            var product2 = new Product { Id = Guid.NewGuid(), SKU = "P002", Name = "Mouse", Price = 500, Quantity = 20 };
            context.Products.AddRange(product1, product2);

            var audit = new InventoryAudit
            {
                Id = Guid.NewGuid(),
                AuditNumber = "INV-20261026-002",
                Title = "Завершення переобліку",
                CreatedAt = DateTime.UtcNow,
                CreatedByUserName = "Admin",
                Status = InventoryAuditStatus.InProgress,
                TotalItemsCount = 2
            };

            var item1 = new InventoryAuditItem
            {
                Id = Guid.NewGuid(),
                InventoryAuditId = audit.Id,
                ProductId = product1.Id,
                ExpectedQuantity = 10,
                ActualQuantity = 15, // Лишок +5
                Discrepancy = 5,
                UnitPrice = 5000,
                DiscrepancyCost = 25000,
                Status = DiscrepancyStatus.Surplus
            };

            var item2 = new InventoryAuditItem
            {
                Id = Guid.NewGuid(),
                InventoryAuditId = audit.Id,
                ProductId = product2.Id,
                ExpectedQuantity = 20,
                ActualQuantity = 17, // Нестача -3
                Discrepancy = -3,
                UnitPrice = 500,
                DiscrepancyCost = -1500,
                Status = DiscrepancyStatus.Deficit
            };

            audit.Items.Add(item1);
            audit.Items.Add(item2);
            context.InventoryAudits.Add(audit);
            await context.SaveChangesAsync();

            var fakeNotifier = new FakeNotifier();
            var fakeAuditService = new FakeAuditService();
            var controller = CreateController(context, fakeNotifier, fakeAuditService);

            var result = await controller.Complete(audit.Id);
            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var completeDto = Assert.IsType<CompleteAuditResultDto>(okResult.Value);

            Assert.Equal(2, completeDto.AdjustedProductsCount);
            Assert.Equal(1, completeDto.SurplusMovementsCount);
            Assert.Equal(1, completeDto.DeficitMovementsCount);

            // Перевіряємо залишки товарів
            var p1 = await context.Products.FindAsync(product1.Id);
            var p2 = await context.Products.FindAsync(product2.Id);
            Assert.NotNull(p1);
            Assert.NotNull(p2);
            Assert.Equal(15, p1.Quantity); // Оновлено з 10 до 15
            Assert.Equal(17, p2.Quantity); // Оновлено з 20 до 17

            // Перевіряємо рухи по складу
            var movements = await context.StockMovements.ToListAsync();
            Assert.Equal(2, movements.Count);

            var inMovement = movements.First(m => m.Type == MovementType.In);
            Assert.Equal(product1.Id, inMovement.ProductId);
            Assert.Equal(5, inMovement.Quantity);

            var outMovement = movements.First(m => m.Type == MovementType.Out);
            Assert.Equal(product2.Id, outMovement.ProductId);
            Assert.Equal(3, outMovement.Quantity);

            // Перевіряємо статус аудиту
            var updatedAudit = await context.InventoryAudits.FindAsync(audit.Id);
            Assert.NotNull(updatedAudit);
            Assert.Equal(InventoryAuditStatus.Completed, updatedAudit.Status);
            Assert.NotNull(updatedAudit.CompletedAt);

            // Перевіряємо що викликано системний аудит
            Assert.Contains(fakeAuditService.Logs, l => l.Action == "StockOperation" && l.EntityType == "InventoryAudit");
        }

        [Fact]
        public async Task MatchAllRemaining_Should_Set_ActualQuantity_To_Expected_For_Pending_Items()
        {
            using var context = CreateInMemoryDbContext();
            var product1 = new Product { Id = Guid.NewGuid(), SKU = "P001", Name = "Monitor", Price = 5000, Quantity = 10 };
            var product2 = new Product { Id = Guid.NewGuid(), SKU = "P002", Name = "Mouse", Price = 500, Quantity = 20 };
            context.Products.AddRange(product1, product2);

            var audit = new InventoryAudit
            {
                Id = Guid.NewGuid(),
                AuditNumber = "INV-20261026-MATCH",
                Title = "Авто-збіг",
                CreatedAt = DateTime.UtcNow,
                CreatedByUserName = "Admin",
                Status = InventoryAuditStatus.Draft,
                TotalItemsCount = 2
            };

            var item1 = new InventoryAuditItem
            {
                Id = Guid.NewGuid(),
                InventoryAuditId = audit.Id,
                ProductId = product1.Id,
                ExpectedQuantity = 10,
                ActualQuantity = 12, // Вже порахований лишок
                Discrepancy = 2,
                UnitPrice = 5000,
                DiscrepancyCost = 10000,
                Status = DiscrepancyStatus.Surplus
            };

            var item2 = new InventoryAuditItem
            {
                Id = Guid.NewGuid(),
                InventoryAuditId = audit.Id,
                ProductId = product2.Id,
                ExpectedQuantity = 20,
                ActualQuantity = null, // Не порахований
                UnitPrice = 500,
                Status = DiscrepancyStatus.Pending
            };

            audit.Items.Add(item1);
            audit.Items.Add(item2);
            context.InventoryAudits.Add(audit);
            await context.SaveChangesAsync();

            var controller = CreateController(context);
            var result = await controller.MatchAllRemaining(audit.Id);
            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var detail = Assert.IsType<InventoryAuditDetailDto>(okResult.Value);

            Assert.Equal(2, detail.CheckedItemsCount);
            Assert.Equal(1, detail.DiscrepancyCount);

            var detailItem2 = detail.Items.First(i => i.Id == item2.Id);
            Assert.Equal(20, detailItem2.ActualQuantity);
            Assert.Equal(0, detailItem2.Discrepancy);
            Assert.Equal(DiscrepancyStatus.Match, detailItem2.Status);
        }

        [Fact]
        public async Task ExportActCsv_Should_Return_Csv_File()
        {
            using var context = CreateInMemoryDbContext();
            var product1 = new Product { Id = Guid.NewGuid(), SKU = "P001", Name = "Monitor", Price = 5000, Quantity = 10 };
            context.Products.Add(product1);

            var audit = new InventoryAudit
            {
                Id = Guid.NewGuid(),
                AuditNumber = "INV-20261026-CSV",
                Title = "Експорт акта",
                CreatedAt = DateTime.UtcNow,
                CreatedByUserName = "Admin",
                Status = InventoryAuditStatus.InProgress,
                TotalItemsCount = 1
            };

            var item1 = new InventoryAuditItem
            {
                Id = Guid.NewGuid(),
                InventoryAuditId = audit.Id,
                ProductId = product1.Id,
                Product = product1,
                ExpectedQuantity = 10,
                ActualQuantity = 9,
                Discrepancy = -1,
                UnitPrice = 5000,
                DiscrepancyCost = -5000,
                Status = DiscrepancyStatus.Deficit
            };

            audit.Items.Add(item1);
            context.InventoryAudits.Add(audit);
            await context.SaveChangesAsync();

            var controller = CreateController(context);
            var result = await controller.ExportActCsv(audit.Id);

            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("text/csv; charset=utf-8", fileResult.ContentType);
            Assert.Equal($"inventory_act_{audit.AuditNumber}.csv", fileResult.FileDownloadName);
            Assert.NotEmpty(fileResult.FileContents);
        }

        [Fact]
        public async Task Cannot_Modify_Completed_Audit()
        {
            using var context = CreateInMemoryDbContext();
            var audit = new InventoryAudit
            {
                Id = Guid.NewGuid(),
                AuditNumber = "INV-20261026-COMPLETED",
                Title = "Завершений переоблік",
                CreatedAt = DateTime.UtcNow,
                CompletedAt = DateTime.UtcNow,
                Status = InventoryAuditStatus.Completed
            };
            context.InventoryAudits.Add(audit);
            await context.SaveChangesAsync();

            var controller = CreateController(context);
            var updateResult = await controller.UpdateItems(audit.Id, new BatchUpdateAuditItemsDto());
            Assert.IsType<BadRequestObjectResult>(updateResult.Result);

            var cancelResult = await controller.Cancel(audit.Id);
            Assert.IsType<BadRequestObjectResult>(cancelResult);
        }
    }
}
