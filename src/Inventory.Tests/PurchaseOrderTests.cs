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
    public class PurchaseOrderTests
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

            public Task NotifyProductChangeAsync(ProductChangeEvent change)
            {
                ProductChanges.Add(change);
                return Task.CompletedTask;
            }

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

        private PurchaseOrdersController CreateController(
            ApplicationDbContext context,
            FakeNotifier? notifier = null,
            FakeAuditService? auditService = null,
            string userName = "ManagerUser")
        {
            var controller = new PurchaseOrdersController(
                context,
                notifier ?? new FakeNotifier(),
                auditService ?? new FakeAuditService());

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, userName),
                new Claim(ClaimTypes.Role, "Manager")
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            var principal = new ClaimsPrincipal(identity);

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };

            return controller;
        }

        private async Task<(Supplier supplier, Product product1, Product product2)> SeedBasicDataAsync(ApplicationDbContext context)
        {
            var supplier = new Supplier
            {
                Id = Guid.NewGuid(),
                Name = "ТОВ ПостачГруп",
                ContactPerson = "Олександр",
                Email = "postach@example.com",
                Phone = "+380501112233"
            };
            context.Suppliers.Add(supplier);

            var cat = new Category { Id = Guid.NewGuid(), Name = "Електроніка" };
            context.Categories.Add(cat);

            var product1 = new Product
            {
                Id = Guid.NewGuid(),
                Name = "Монітор 27\"",
                SKU = "MON-27",
                Quantity = 10,
                Price = 8000m,
                CategoryId = cat.Id,
                Unit = "шт"
            };

            var product2 = new Product
            {
                Id = Guid.NewGuid(),
                Name = "Клавіатура бездротова",
                SKU = "KEY-WL",
                Quantity = 25,
                Price = 1200m,
                CategoryId = cat.Id,
                Unit = "шт"
            };

            context.Products.AddRange(product1, product2);
            await context.SaveChangesAsync();

            return (supplier, product1, product2);
        }

        [Fact]
        public async Task CreatePurchaseOrder_Success_CreatesOrderInDraftStatus()
        {
            using var context = CreateInMemoryDbContext();
            var auditService = new FakeAuditService();
            var controller = CreateController(context, auditService: auditService, userName: "TestUser");
            var (supplier, product1, product2) = await SeedBasicDataAsync(context);

            var dto = new CreatePurchaseOrderDto
            {
                Title = "Закупівля периферії для нового офісу",
                SupplierId = supplier.Id,
                ExpectedDeliveryDate = DateTime.UtcNow.AddDays(7),
                Notes = "Термінова доставка",
                Items = new List<CreatePurchaseOrderItemDto>
                {
                    new() { ProductId = product1.Id, OrderedQuantity = 5, UnitPrice = 7500m },
                    new() { ProductId = product2.Id, OrderedQuantity = 10, UnitPrice = 1100m }
                }
            };

            var result = await controller.Create(dto);
            var createdAtResult = Assert.IsType<CreatedAtActionResult>(result.Result);
            var createdDto = Assert.IsType<PurchaseOrderDetailDto>(createdAtResult.Value);

            Assert.StartsWith("PO-", createdDto.OrderNumber);
            Assert.Equal(PurchaseOrderStatus.Draft, createdDto.Status);
            Assert.Equal("Закупівля периферії для нового офісу", createdDto.Title);
            Assert.Equal("ТОВ ПостачГруп", createdDto.SupplierName);
            Assert.Equal(2, createdDto.TotalItemsCount);
            Assert.Equal(15, createdDto.TotalOrderedQuantity);
            Assert.Equal(0, createdDto.TotalReceivedQuantity);
            Assert.Equal(5 * 7500m + 10 * 1100m, createdDto.TotalAmount); // 37500 + 11000 = 48500
            Assert.Equal("TestUser", createdDto.CreatedByUserName);

            // Аудит
            Assert.Contains(auditService.Logs, l => l.EntityType == "PurchaseOrder" && l.Action == "Create");
        }

        [Fact]
        public async Task SubmitForApproval_And_Approve_Flow()
        {
            using var context = CreateInMemoryDbContext();
            var notifier = new FakeNotifier();
            var auditService = new FakeAuditService();
            var controller = CreateController(context, notifier, auditService, "ManagerPetro");
            var (supplier, product1, _) = await SeedBasicDataAsync(context);

            var createDto = new CreatePurchaseOrderDto
            {
                Title = "Тестове замовлення",
                SupplierId = supplier.Id,
                Items = new List<CreatePurchaseOrderItemDto>
                {
                    new() { ProductId = product1.Id, OrderedQuantity = 4, UnitPrice = 7000m }
                }
            };

            var createResult = await controller.Create(createDto);
            var createdOrder = (createResult.Result as CreatedAtActionResult)?.Value as PurchaseOrderDetailDto;
            Assert.NotNull(createdOrder);
            Assert.Equal(PurchaseOrderStatus.Draft, createdOrder.Status);

            // Подача на погодження
            var submitResult = await controller.SubmitForApproval(createdOrder.Id);
            var submittedDto = (submitResult.Result as OkObjectResult)?.Value as PurchaseOrderDetailDto;
            Assert.NotNull(submittedDto);
            Assert.Equal(PurchaseOrderStatus.PendingApproval, submittedDto.Status);

            // Затвердження керівником
            var approveResult = await controller.Approve(createdOrder.Id);
            var approvedDto = (approveResult.Result as OkObjectResult)?.Value as PurchaseOrderDetailDto;
            Assert.NotNull(approvedDto);
            Assert.Equal(PurchaseOrderStatus.Approved, approvedDto.Status);
            Assert.Equal("ManagerPetro", approvedDto.ApprovedByUserName);
            Assert.NotNull(approvedDto.ApprovedAt);

            // Відправка постачальнику (в дорозі)
            var sendResult = await controller.SendToSupplier(createdOrder.Id);
            var sentDto = (sendResult.Result as OkObjectResult)?.Value as PurchaseOrderDetailDto;
            Assert.NotNull(sentDto);
            Assert.Equal(PurchaseOrderStatus.Sent, sentDto.Status);
        }

        [Fact]
        public async Task ReceiveItems_PartialAndFullReceipt_UpdatesStockAndMovements()
        {
            using var context = CreateInMemoryDbContext();
            var notifier = new FakeNotifier();
            var auditService = new FakeAuditService();
            var controller = CreateController(context, notifier, auditService, "WarehouseWorkerIvan");
            var (supplier, product1, product2) = await SeedBasicDataAsync(context);

            // Створюємо та відправляємо замовлення
            var createDto = new CreatePurchaseOrderDto
            {
                Title = "Замовлення для приймання",
                SupplierId = supplier.Id,
                Items = new List<CreatePurchaseOrderItemDto>
                {
                    new() { ProductId = product1.Id, OrderedQuantity = 10, UnitPrice = 7500m },
                    new() { ProductId = product2.Id, OrderedQuantity = 20, UnitPrice = 1000m }
                }
            };

            var createRes = await controller.Create(createDto);
            var created = (createRes.Result as CreatedAtActionResult)?.Value as PurchaseOrderDetailDto;
            Assert.NotNull(created);

            // Переводимо в статус Sent
            await controller.Approve(created.Id);
            await controller.SendToSupplier(created.Id);

            var initialP1Stock = product1.Quantity; // 10
            var initialP2Stock = product2.Quantity; // 25

            var p1Item = created.Items.First(i => i.ProductId == product1.Id);
            var p2Item = created.Items.First(i => i.ProductId == product2.Id);

            // Часткове приймання (5 з 10 для product1, 10 з 20 для product2)
            var partialReceiveDto = new ReceivePurchaseOrderItemsDto
            {
                Notes = "Перша партія вантажу",
                Items = new List<ReceiveItemInputDto>
                {
                    new() { ItemId = p1Item.Id, QuantityToReceive = 5 },
                    new() { ItemId = p2Item.Id, QuantityToReceive = 10 }
                }
            };

            var partialRes = await controller.ReceiveItems(created.Id, partialReceiveDto);
            var partialOrder = (partialRes.Result as OkObjectResult)?.Value as PurchaseOrderDetailDto;
            Assert.NotNull(partialOrder);

            Assert.Equal(PurchaseOrderStatus.PartiallyReceived, partialOrder.Status);
            Assert.Equal(15, partialOrder.TotalReceivedQuantity);

            // Перевіряємо залишки товару
            var dbP1 = await context.Products.FindAsync(product1.Id);
            var dbP2 = await context.Products.FindAsync(product2.Id);
            Assert.Equal(initialP1Stock + 5, dbP1!.Quantity); // 10 + 5 = 15
            Assert.Equal(initialP2Stock + 10, dbP2!.Quantity); // 25 + 10 = 35

            // Перевіряємо рухи товару (StockMovements)
            var movements = await context.StockMovements.Where(m => m.SupplierId == supplier.Id).ToListAsync();
            Assert.Equal(2, movements.Count);
            Assert.All(movements, m => Assert.Equal(MovementType.In, m.Type));

            // Друга партія: доприймаємо решту (5 для product1, 10 для product2)
            var finalReceiveDto = new ReceivePurchaseOrderItemsDto
            {
                Notes = "Друга партія вантажу (залишок)",
                Items = new List<ReceiveItemInputDto>
                {
                    new() { ItemId = p1Item.Id, QuantityToReceive = 5 },
                    new() { ItemId = p2Item.Id, QuantityToReceive = 10 }
                }
            };

            var finalRes = await controller.ReceiveItems(created.Id, finalReceiveDto);
            var finalOrder = (finalRes.Result as OkObjectResult)?.Value as PurchaseOrderDetailDto;
            Assert.NotNull(finalOrder);

            Assert.Equal(PurchaseOrderStatus.Completed, finalOrder.Status);
            Assert.NotNull(finalOrder.CompletedAt);
            Assert.Equal(30, finalOrder.TotalReceivedQuantity);
            Assert.Equal(initialP1Stock + 10, dbP1.Quantity); // 20
            Assert.Equal(initialP2Stock + 20, dbP2.Quantity); // 45
        }

        [Fact]
        public async Task ReceiveItems_ExceedingOrderedQuantity_Fails()
        {
            using var context = CreateInMemoryDbContext();
            var controller = CreateController(context);
            var (supplier, product1, _) = await SeedBasicDataAsync(context);

            var createDto = new CreatePurchaseOrderDto
            {
                Title = "Замовлення перевірки ліміту",
                SupplierId = supplier.Id,
                Items = new List<CreatePurchaseOrderItemDto>
                {
                    new() { ProductId = product1.Id, OrderedQuantity = 5, UnitPrice = 7500m }
                }
            };

            var createRes = await controller.Create(createDto);
            var created = (createRes.Result as CreatedAtActionResult)?.Value as PurchaseOrderDetailDto;
            await controller.Approve(created!.Id);

            var itemId = created.Items.First().Id;
            var invalidReceiveDto = new ReceivePurchaseOrderItemsDto
            {
                Items = new List<ReceiveItemInputDto>
                {
                    new() { ItemId = itemId, QuantityToReceive = 10 } // Спроба прийняти 10 замість 5
                }
            };

            var result = await controller.ReceiveItems(created.Id, invalidReceiveDto);
            Assert.IsType<BadRequestObjectResult>(result.Result);
        }

        [Fact]
        public async Task CancelPurchaseOrder_Success()
        {
            using var context = CreateInMemoryDbContext();
            var controller = CreateController(context);
            var (supplier, product1, _) = await SeedBasicDataAsync(context);

            var createDto = new CreatePurchaseOrderDto
            {
                Title = "Замовлення під скасування",
                SupplierId = supplier.Id,
                Items = new List<CreatePurchaseOrderItemDto>
                {
                    new() { ProductId = product1.Id, OrderedQuantity = 2, UnitPrice = 5000m }
                }
            };

            var createRes = await controller.Create(createDto);
            var created = (createRes.Result as CreatedAtActionResult)?.Value as PurchaseOrderDetailDto;

            var cancelResult = await controller.Cancel(created!.Id, "Постачальник не має товару");
            var cancelledOrder = (cancelResult.Result as OkObjectResult)?.Value as PurchaseOrderDetailDto;

            Assert.NotNull(cancelledOrder);
            Assert.Equal(PurchaseOrderStatus.Cancelled, cancelledOrder.Status);
            Assert.Contains("Постачальник не має товару", cancelledOrder.Notes);
        }
    }
}
