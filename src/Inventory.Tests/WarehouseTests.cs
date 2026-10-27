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
    public class WarehouseTests
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

            public Task NotifyLowStockAsync(LowStockAlertEvent alert) => Task.CompletedTask;
            public Task NotifyProductChangeAsync(ProductChangeEvent change) => Task.CompletedTask;
            public Task NotifyStockMovementAsync(StockMovementEvent movement) => Task.CompletedTask;
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
                    UserName = userName ?? "System",
                    Timestamp = DateTime.UtcNow
                });
                return Task.CompletedTask;
            }
        }

        private WarehousesController CreateController(
            ApplicationDbContext context,
            FakeNotifier? notifier = null,
            FakeAuditService? auditService = null,
            string userName = "WarehouseManager")
        {
            var controller = new WarehousesController(
                context,
                notifier ?? new FakeNotifier(),
                auditService ?? new FakeAuditService());

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, userName),
                new Claim(ClaimTypes.Role, "Admin")
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            var principal = new ClaimsPrincipal(identity);

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };

            return controller;
        }

        private async Task<(Warehouse wh1, Warehouse wh2, Product product)> SeedWarehousesAndProductAsync(ApplicationDbContext context)
        {
            var wh1 = new Warehouse
            {
                Id = Guid.NewGuid(),
                Name = "Головний склад (Київ)",
                Code = "WH-KYIV",
                IsDefault = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            var wh2 = new Warehouse
            {
                Id = Guid.NewGuid(),
                Name = "Склад Захід (Львів)",
                Code = "WH-LVIV",
                IsDefault = false,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            context.Warehouses.AddRange(wh1, wh2);

            var cat = new Category { Id = Guid.NewGuid(), Name = "Побутова техніка" };
            context.Categories.Add(cat);

            var product = new Product
            {
                Id = Guid.NewGuid(),
                Name = "Кавомашина Philips",
                SKU = "PHIL-COF-01",
                Quantity = 50,
                Price = 14500m,
                CategoryId = cat.Id,
                Unit = "шт"
            };
            context.Products.Add(product);

            // Початковий розподіл: 40 шт у Києві, 10 шт у Львові
            var stock1 = new WarehouseStock
            {
                Id = Guid.NewGuid(),
                WarehouseId = wh1.Id,
                ProductId = product.Id,
                Quantity = 40,
                MinStock = 5,
                LocationZone = "Зона A-1",
                LastUpdated = DateTime.UtcNow
            };

            var stock2 = new WarehouseStock
            {
                Id = Guid.NewGuid(),
                WarehouseId = wh2.Id,
                ProductId = product.Id,
                Quantity = 10,
                MinStock = 2,
                LocationZone = "Стелаж 3",
                LastUpdated = DateTime.UtcNow
            };

            context.WarehouseStocks.AddRange(stock1, stock2);
            await context.SaveChangesAsync();

            return (wh1, wh2, product);
        }

        [Fact]
        public async Task CreateWarehouse_Success_SetsUniqueCodeAndSaves()
        {
            using var context = CreateInMemoryDbContext();
            var auditService = new FakeAuditService();
            var controller = CreateController(context, auditService: auditService);

            var dto = new CreateWarehouseDto
            {
                Name = "Одеський портовий термінал",
                Code = "WH-ODESA",
                Address = "м. Одеса, Митна площа, 1",
                IsDefault = false,
                Description = "Морський термінал прийому імпорту"
            };

            var result = await controller.Create(dto);
            var createdAtAction = Assert.IsType<CreatedAtActionResult>(result.Result);
            var created = Assert.IsType<WarehouseSummaryDto>(createdAtAction.Value);

            Assert.Equal("Одеський портовий термінал", created.Name);
            Assert.Equal("WH-ODESA", created.Code);
            Assert.True(created.IsActive);
            Assert.Contains(auditService.Logs, l => l.EntityType == "Warehouse" && l.Action == "Create");
        }

        [Fact]
        public async Task CreateWarehouse_DuplicateCode_ReturnsBadRequest()
        {
            using var context = CreateInMemoryDbContext();
            var controller = CreateController(context);
            var (wh1, _, _) = await SeedWarehousesAndProductAsync(context);

            var dto = new CreateWarehouseDto
            {
                Name = "Дублікат складу",
                Code = wh1.Code // WH-KYIV
            };

            var result = await controller.Create(dto);
            Assert.IsType<BadRequestObjectResult>(result.Result);
        }

        [Fact]
        public async Task CreateTransfer_ImmediateCompletion_MovesStockBetweenWarehouses()
        {
            using var context = CreateInMemoryDbContext();
            var notifier = new FakeNotifier();
            var auditService = new FakeAuditService();
            var controller = CreateController(context, notifier, auditService);
            var (wh1, wh2, product) = await SeedWarehousesAndProductAsync(context);

            // Переміщуємо 15 шт з Києва до Львова миттєво
            var transferDto = new CreateWarehouseTransferDto
            {
                FromWarehouseId = wh1.Id,
                ToWarehouseId = wh2.Id,
                CompleteImmediately = true,
                Notes = "Поповнення запасів західного філіалу",
                Items = new List<CreateWarehouseTransferItemInput>
                {
                    new() { ProductId = product.Id, Quantity = 15 }
                }
            };

            var result = await controller.CreateTransfer(transferDto);
            var createdAt = Assert.IsType<CreatedAtActionResult>(result.Result);
            var transfer = Assert.IsType<WarehouseTransferDto>(createdAt.Value);

            Assert.Equal(TransferStatus.Completed, transfer.Status);
            Assert.NotNull(transfer.CompletedAt);
            Assert.Equal(15, transfer.TotalQuantity);

            // Перевіряємо залишки на складах
            var kyivStock = await context.WarehouseStocks.FirstAsync(s => s.WarehouseId == wh1.Id && s.ProductId == product.Id);
            var lvivStock = await context.WarehouseStocks.FirstAsync(s => s.WarehouseId == wh2.Id && s.ProductId == product.Id);

            Assert.Equal(40 - 15, kyivStock.Quantity); // 25
            Assert.Equal(10 + 15, lvivStock.Quantity); // 25
            Assert.Equal(50, kyivStock.Quantity + lvivStock.Quantity); // Загальна сума не змінилась

            // Перевіряємо створений рух товару
            var movement = await context.StockMovements.FirstOrDefaultAsync(m => m.Type == MovementType.Transfer);
            Assert.NotNull(movement);
            Assert.Equal(15, movement.Quantity);
            Assert.Equal(wh1.Id, movement.WarehouseId);
            Assert.Equal(wh2.Id, movement.ToWarehouseId);
        }

        [Fact]
        public async Task CreateTransfer_InsufficientStock_ReturnsBadRequest()
        {
            using var context = CreateInMemoryDbContext();
            var controller = CreateController(context);
            var (wh1, wh2, product) = await SeedWarehousesAndProductAsync(context);

            // Спроба перемістити 100 шт, коли в Києві є лише 40
            var transferDto = new CreateWarehouseTransferDto
            {
                FromWarehouseId = wh1.Id,
                ToWarehouseId = wh2.Id,
                Items = new List<CreateWarehouseTransferItemInput>
                {
                    new() { ProductId = product.Id, Quantity = 100 }
                }
            };

            var result = await controller.CreateTransfer(transferDto);
            Assert.IsType<BadRequestObjectResult>(result.Result);
        }

        [Fact]
        public async Task TwoStepTransfer_InTransit_ThenReceive_Flow()
        {
            using var context = CreateInMemoryDbContext();
            var notifier = new FakeNotifier();
            var auditService = new FakeAuditService();
            var controller = CreateController(context, notifier, auditService);
            var (wh1, wh2, product) = await SeedWarehousesAndProductAsync(context);

            // Крок 1: Відправка в дорогу (InTransit)
            var transferDto = new CreateWarehouseTransferDto
            {
                FromWarehouseId = wh1.Id,
                ToWarehouseId = wh2.Id,
                CompleteImmediately = false,
                Notes = "Вантаж відправлено перевізником",
                Items = new List<CreateWarehouseTransferItemInput>
                {
                    new() { ProductId = product.Id, Quantity = 20 }
                }
            };

            var createRes = await controller.CreateTransfer(transferDto);
            var created = (createRes.Result as CreatedAtActionResult)?.Value as WarehouseTransferDto;
            Assert.NotNull(created);
            Assert.Equal(TransferStatus.InTransit, created.Status);

            // На складі-відправнику списано 20 од.
            var kyivStock = await context.WarehouseStocks.FirstAsync(s => s.WarehouseId == wh1.Id && s.ProductId == product.Id);
            var lvivStock = await context.WarehouseStocks.FirstAsync(s => s.WarehouseId == wh2.Id && s.ProductId == product.Id);
            Assert.Equal(20, kyivStock.Quantity); // 40 - 20 = 20
            Assert.Equal(10, lvivStock.Quantity); // Ще не надійшло

            // Крок 2: Приймання на складі одержувачі
            var receiveRes = await controller.ReceiveTransfer(created.Id);
            var okRes = Assert.IsType<OkObjectResult>(receiveRes.Result);
            var receivedDto = Assert.IsType<WarehouseTransferDto>(okRes.Value);
            Assert.Equal(TransferStatus.Completed, receivedDto.Status);

            // Тепер Львів отримав свої 20 од.
            await context.Entry(lvivStock).ReloadAsync();
            Assert.Equal(30, lvivStock.Quantity); // 10 + 20 = 30
        }

        [Fact]
        public async Task CancelTransfer_InTransit_ReturnsStockToSourceWarehouse()
        {
            using var context = CreateInMemoryDbContext();
            var controller = CreateController(context);
            var (wh1, wh2, product) = await SeedWarehousesAndProductAsync(context);

            var transferDto = new CreateWarehouseTransferDto
            {
                FromWarehouseId = wh1.Id,
                ToWarehouseId = wh2.Id,
                CompleteImmediately = false,
                Items = new List<CreateWarehouseTransferItemInput>
                {
                    new() { ProductId = product.Id, Quantity = 10 }
                }
            };

            var createRes = await controller.CreateTransfer(transferDto);
            var created = (createRes.Result as CreatedAtActionResult)?.Value as WarehouseTransferDto;

            var kyivStock = await context.WarehouseStocks.FirstAsync(s => s.WarehouseId == wh1.Id && s.ProductId == product.Id);
            Assert.Equal(30, kyivStock.Quantity); // 40 - 10 = 30

            // Скасування переміщення
            var cancelRes = await controller.CancelTransfer(created!.Id, "Автомобіль зламався, повернення на склад");
            var okCancel = Assert.IsType<OkObjectResult>(cancelRes.Result);
            var cancelledDto = Assert.IsType<WarehouseTransferDto>(okCancel.Value);
            Assert.Equal(TransferStatus.Cancelled, cancelledDto.Status);

            // Товар повернуто на баланс Києва
            await context.Entry(kyivStock).ReloadAsync();
            Assert.Equal(40, kyivStock.Quantity); // 30 + 10 = 40
        }
    }
}
