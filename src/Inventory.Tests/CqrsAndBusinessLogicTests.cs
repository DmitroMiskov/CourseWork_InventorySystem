using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Inventory.Application.Categories.Commands.CreateCategory;
using Inventory.Application.Categories.Commands.DeleteCategory;
using Inventory.Application.Categories.Queries.GetCategories;
using Inventory.Application.Products.Commands.CreateProduct;
using Inventory.Application.Products.Commands.DeleteProduct;
using Inventory.Application.Products.Commands.UpdateProduct;
using Inventory.Application.Products.Queries.GetProducts;
using Inventory.Domain.Entities;
using Inventory.Domain.Enums;
using Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Inventory.Tests;

public class CqrsAndBusinessLogicTests
{
    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task CreateProduct_SavesProductToDatabase_ReturnsValidGuid()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var handler = new CreateProductCommandHandler(context);
        var categoryId = Guid.NewGuid();

        var command = new CreateProductCommand
        {
            SKU = "LAPTOP-01",
            Name = "Dell Latitude 5520",
            Description = "Бізнес ноутбук",
            Price = 32000m,
            Quantity = 15,
            MinStock = 3,
            Unit = "шт",
            CategoryId = categoryId,
            ImageUrl = "/images/laptop.jpg"
        };

        // Act
        var resultId = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.NotEqual(Guid.Empty, resultId);
        var created = await context.Products.FindAsync(resultId);
        Assert.NotNull(created);
        Assert.Equal("Dell Latitude 5520", created.Name);
        Assert.Equal("LAPTOP-01", created.SKU);
        Assert.Equal(32000m, created.Price);
        Assert.Equal(15, created.Quantity);
    }

    [Fact]
    public async Task UpdateProduct_ModifiesExistingProduct_PersistsChanges()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var categoryId = Guid.NewGuid();
        var initial = new Product
        {
            Id = Guid.NewGuid(),
            SKU = "MON-01",
            Name = "Samsung Monitor 24",
            Price = 4500m,
            Quantity = 10,
            MinStock = 2,
            Unit = "шт",
            CategoryId = categoryId
        };
        context.Products.Add(initial);
        await context.SaveChangesAsync();

        var handler = new UpdateProductCommandHandler(context);
        var updateCommand = new UpdateProductCommand
        {
            Id = initial.Id,
            Sku = "MON-01-V2",
            Name = "Samsung Monitor 27 IPS",
            Price = 5900m,
            Quantity = 8,
            MinStockLevel = 4,
            UnitOfMeasurement = "шт",
            CategoryId = categoryId,
            Description = "Оновлена версія монітора",
            ImageUrl = "/images/mon27.png"
        };

        // Act
        await handler.Handle(updateCommand, CancellationToken.None);

        // Assert
        var updated = await context.Products.FindAsync(initial.Id);
        Assert.NotNull(updated);
        Assert.Equal("Samsung Monitor 27 IPS", updated.Name);
        Assert.Equal("MON-01-V2", updated.SKU);
        Assert.Equal(5900m, updated.Price);
        Assert.Equal(8, updated.Quantity);
        Assert.Equal(4, updated.MinStock);
        Assert.Equal("Оновлена версія монітора", updated.Description);
    }

    [Fact]
    public async Task DeleteProduct_RemovesProductFromDatabase()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var product = new Product
        {
            Id = Guid.NewGuid(),
            SKU = "KB-01",
            Name = "Механічна клавіатура",
            Price = 2100m,
            Quantity = 5,
            Unit = "шт",
            CategoryId = Guid.NewGuid()
        };
        context.Products.Add(product);
        await context.SaveChangesAsync();

        var handler = new DeleteProductCommandHandler(context);

        // Act
        await handler.Handle(new DeleteProductCommand(product.Id), CancellationToken.None);

        // Assert
        var deleted = await context.Products.FindAsync(product.Id);
        Assert.Null(deleted);
    }

    [Fact]
    public async Task GetProductsQuery_WithPagination_ReturnsCorrectSubsetAndCount()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var catId = Guid.NewGuid();
        context.Categories.Add(new Category { Id = catId, Name = "Категорія" });

        for (int i = 1; i <= 25; i++)
        {
            context.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                SKU = $"SKU-{i:D3}",
                Name = $"Товар {i:D2}",
                Price = 100m * i,
                Quantity = 10,
                Unit = "шт",
                CategoryId = catId
            });
        }
        await context.SaveChangesAsync();

        var handler = new GetProductsQueryHandler(context);
        var query = new GetProductsQuery
        {
            PageNumber = 2,
            PageSize = 10
        };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.Equal(25, result.TotalCount);
        Assert.Equal(10, result.Items.Count);
        Assert.Equal(2, result.PageNumber);
        Assert.Equal(3, result.TotalPages);
        Assert.True(result.HasNextPage);
        Assert.True(result.HasPreviousPage);
    }

    [Fact]
    public async Task GetProductsQuery_WithCategoryFilter_ReturnsOnlyMatchingCategory()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var cat1 = new Category { Id = Guid.NewGuid(), Name = "Комп'ютери" };
        var cat2 = new Category { Id = Guid.NewGuid(), Name = "Побутова техніка" };
        context.Categories.AddRange(cat1, cat2);

        context.Products.Add(new Product { Id = Guid.NewGuid(), SKU = "PC-01", Name = "Системний блок", Price = 20000m, Unit = "шт", CategoryId = cat1.Id });
        context.Products.Add(new Product { Id = Guid.NewGuid(), SKU = "PC-02", Name = "Ноутбук", Price = 15000m, Unit = "шт", CategoryId = cat1.Id });
        context.Products.Add(new Product { Id = Guid.NewGuid(), SKU = "AP-01", Name = "Чайник", Price = 800m, Unit = "шт", CategoryId = cat2.Id });
        await context.SaveChangesAsync();

        var handler = new GetProductsQueryHandler(context);

        // Act
        var result = await handler.Handle(new GetProductsQuery { CategoryId = cat1.Id, PageNumber = 1, PageSize = 10 }, CancellationToken.None);

        // Assert
        Assert.Equal(2, result.TotalCount);
        Assert.All(result.Items, item => Assert.Equal(cat1.Id, item.CategoryId));
    }

    [Fact]
    public async Task GetProductsQuery_WithSearchTerm_MatchesByNameOrSku()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var cat = new Category { Id = Guid.NewGuid(), Name = "Мережеве обладнання" };
        context.Categories.Add(cat);

        context.Products.Add(new Product { Id = Guid.NewGuid(), SKU = "ROUTER-AX", Name = "Роутер Wi-Fi 6", Price = 2500m, Unit = "шт", CategoryId = cat.Id });
        context.Products.Add(new Product { Id = Guid.NewGuid(), SKU = "SWITCH-08", Name = "Комутатор 8 портів", Price = 1200m, Unit = "шт", CategoryId = cat.Id });
        context.Products.Add(new Product { Id = Guid.NewGuid(), SKU = "CABLE-UTP", Name = "Кабель кручена пара", Price = 15m, Unit = "м", CategoryId = cat.Id });
        await context.SaveChangesAsync();

        var handler = new GetProductsQueryHandler(context);

        // Act - Пошук за назвою
        var resultByName = await handler.Handle(new GetProductsQuery { SearchTerm = "комутатор", PageNumber = 1, PageSize = 10 }, CancellationToken.None);
        // Act - Пошук за артикулом SKU
        var resultBySku = await handler.Handle(new GetProductsQuery { SearchTerm = "ROUTER", PageNumber = 1, PageSize = 10 }, CancellationToken.None);

        // Assert
        Assert.Single(resultByName.Items);
        Assert.Equal("SWITCH-08", resultByName.Items.First().SKU);

        Assert.Single(resultBySku.Items);
        Assert.Equal("ROUTER-AX", resultBySku.Items.First().SKU);
    }

    [Fact]
    public async Task CreateCategory_PersistsCategory_ToDatabase()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var handler = new CreateCategoryCommandHandler(context);

        // Act
        var id = await handler.Handle(new CreateCategoryCommand { Name = "Канцелярія" }, CancellationToken.None);

        // Assert
        Assert.NotEqual(Guid.Empty, id);
        var created = await context.Categories.FindAsync(id);
        Assert.NotNull(created);
        Assert.Equal("Канцелярія", created.Name);
    }

    [Fact]
    public async Task GetCategoriesQuery_ReturnsAlphabeticallyOrderedCategories()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        context.Categories.Add(new Category { Id = Guid.NewGuid(), Name = "Яблука (Фрукти)" });
        context.Categories.Add(new Category { Id = Guid.NewGuid(), Name = "Ананаси" });
        context.Categories.Add(new Category { Id = Guid.NewGuid(), Name = "Банани" });
        await context.SaveChangesAsync();

        var handler = new GetCategoriesQueryHandler(context);

        // Act
        var result = await handler.Handle(new GetCategoriesQuery(), CancellationToken.None);

        // Assert
        Assert.Equal(3, result.Count);
        Assert.Equal("Ананаси", result[0].Name);
        Assert.Equal("Банани", result[1].Name);
        Assert.Equal("Яблука (Фрукти)", result[2].Name);
    }

    [Fact]
    public async Task DeleteCategory_RemovesCategoryFromDatabase()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var cat = new Category { Id = Guid.NewGuid(), Name = "Тимчасова категорія" };
        context.Categories.Add(cat);
        await context.SaveChangesAsync();

        var handler = new DeleteCategoryCommandHandler(context);

        // Act
        await handler.Handle(new DeleteCategoryCommand(cat.Id), CancellationToken.None);

        // Assert
        var deleted = await context.Categories.FindAsync(cat.Id);
        Assert.Null(deleted);
    }

    [Fact]
    public void StockOperations_IncreaseAndDecrease_MaintainAccurateBalance()
    {
        // Arrange
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = "SSD накопичувач 1TB",
            Quantity = 50,
            MinStock = 10,
            Price = 2800m
        };

        // Act - Надходження товару на склад (+30 шт)
        product.Quantity += 30;
        Assert.Equal(80, product.Quantity);

        // Act - Видача товару покупцю (-25 шт)
        product.Quantity -= 25;
        Assert.Equal(55, product.Quantity);

        // Act - Розрахунок повної складської вартості залишку
        var totalStockValue = product.Quantity * product.Price;
        Assert.Equal(154000m, totalStockValue);
    }

    [Fact]
    public void LowStockCondition_IdentifiedAccurately()
    {
        // Arrange
        var normalProduct = new Product { Quantity = 25, MinStock = 10 };
        var borderProduct = new Product { Quantity = 10, MinStock = 10 };
        var criticalProduct = new Product { Quantity = 2, MinStock = 10 };

        // Assert
        Assert.False(normalProduct.Quantity <= normalProduct.MinStock);
        Assert.True(borderProduct.Quantity <= borderProduct.MinStock);
        Assert.True(criticalProduct.Quantity <= criticalProduct.MinStock);
    }
}
