using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Inventory.API.Controllers;
using Inventory.API.Dtos;
using Inventory.Domain.Entities;
using Inventory.Domain.Enums;
using Inventory.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Inventory.Tests
{
    public class ReportTests
    {
        private ApplicationDbContext CreateInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new ApplicationDbContext(options);
        }

        private ReportsController CreateController(ApplicationDbContext context)
        {
            var controller = new ReportsController(context);
            var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Name, "AdminUser"),
                new Claim(ClaimTypes.Role, "Admin")
            }, "TestAuth"));

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };

            return controller;
        }

        [Fact]
        public async Task GetTurnoverStatement_Calculates_Balances_And_Movements_Accurately()
        {
            using var context = CreateInMemoryDbContext();
            var category = new Category { Id = Guid.NewGuid(), Name = "Hardware" };
            context.Categories.Add(category);

            // Товар: ціна 1000 грн, поточний залишок = 15 шт.
            var product = new Product
            {
                Id = Guid.NewGuid(),
                SKU = "P-TEST",
                Name = "Тестовий товар",
                Price = 1000m,
                Quantity = 15,
                CategoryId = category.Id,
                Unit = "шт."
            };
            context.Products.Add(product);

            var now = DateTime.UtcNow;
            var periodStart = now.AddDays(-10);
            var periodEnd = now.AddDays(-2);

            // Рухи всередині періоду:
            // 1. Прихід: +10 шт (6 днів тому)
            // 2. Розхід: -5 шт (4 дні тому)
            context.StockMovements.Add(new StockMovement
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                Type = MovementType.In,
                Quantity = 10,
                MovementDate = now.AddDays(-6)
            });
            context.StockMovements.Add(new StockMovement
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                Type = MovementType.Out,
                Quantity = 5,
                MovementDate = now.AddDays(-4)
            });

            // Рух ПІСЛЯ періоду (вчора):
            // 3. Розхід: -2 шт (тобто вчора було відвантажено 2 шт, значить на кінець періоду залишок був 15 + 2 = 17 шт)
            // Зачекайте: поточний залишок 15. Вчора списали 2. Отже, до вчорашнього дня було 17.
            // Прихід в період = 10, Розхід в період = 5.
            // Отже, на початок періоду було 17 - (10 - 5) = 12 шт!
            context.StockMovements.Add(new StockMovement
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                Type = MovementType.Out,
                Quantity = 2,
                MovementDate = now.AddDays(-1)
            });

            await context.SaveChangesAsync();

            var controller = CreateController(context);
            var actionResult = await controller.GetTurnoverStatement(
                fromDate: periodStart,
                toDate: periodEnd);

            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var statement = Assert.IsType<TurnoverStatementDto>(okResult.Value);

            Assert.Equal(1, statement.TotalProductsCount);
            var item = statement.Items.First();

            Assert.Equal(17, item.ClosingQuantity);
            Assert.Equal(17000m, item.ClosingAmount);

            Assert.Equal(10, item.InflowQuantity);
            Assert.Equal(10000m, item.InflowAmount);

            Assert.Equal(5, item.OutflowQuantity);
            Assert.Equal(5000m, item.OutflowAmount);

            Assert.Equal(12, item.OpeningQuantity);
            Assert.Equal(12000m, item.OpeningAmount);

            Assert.Equal(12000m, statement.TotalOpeningAmount);
            Assert.Equal(17000m, statement.TotalClosingAmount);
        }

        [Fact]
        public async Task GetStockValuation_Calculates_Category_Valuation_And_Shares()
        {
            using var context = CreateInMemoryDbContext();
            var cat1 = new Category { Id = Guid.NewGuid(), Name = "Electronics" };
            var cat2 = new Category { Id = Guid.NewGuid(), Name = "Furniture" };
            context.Categories.AddRange(cat1, cat2);

            var p1 = new Product { Id = Guid.NewGuid(), SKU = "E1", Name = "Laptop", Price = 20000, Quantity = 2, CategoryId = cat1.Id }; // 40,000 грн (80%)
            var p2 = new Product { Id = Guid.NewGuid(), SKU = "F1", Name = "Chair", Price = 1000, Quantity = 10, CategoryId = cat2.Id };  // 10,000 грн (20%)
            context.Products.AddRange(p1, p2);
            await context.SaveChangesAsync();

            var controller = CreateController(context);
            var actionResult = await controller.GetStockValuation();

            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var report = Assert.IsType<StockValuationReportDto>(okResult.Value);

            Assert.Equal(2, report.TotalItemsCount);
            Assert.Equal(12, report.TotalStockQuantity);
            Assert.Equal(50000m, report.TotalWarehouseValuation);

            Assert.Equal(2, report.Categories.Count);
            var topCat = report.Categories.First();
            Assert.Equal("Electronics", topCat.CategoryName);
            Assert.Equal(40000m, topCat.TotalValuation);
            Assert.Equal(80m, topCat.SharePercentage);
        }

        [Fact]
        public async Task ExportTurnoverCsv_Generates_Valid_Csv_File()
        {
            using var context = CreateInMemoryDbContext();
            var cat = new Category { Id = Guid.NewGuid(), Name = "Supplies" };
            context.Categories.Add(cat);

            var p = new Product { Id = Guid.NewGuid(), SKU = "S01", Name = "Paper A4", Price = 150, Quantity = 20, CategoryId = cat.Id };
            context.Products.Add(p);
            await context.SaveChangesAsync();

            var controller = CreateController(context);
            var result = await controller.ExportTurnoverCsv(DateTime.UtcNow.AddDays(-7), DateTime.UtcNow);

            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("text/csv; charset=utf-8", fileResult.ContentType);
            Assert.NotEmpty(fileResult.FileContents);
        }
    }
}
