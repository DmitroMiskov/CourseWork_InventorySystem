using Inventory.Domain.Entities;
using Inventory.Domain.Enums;
using Inventory.Application.Products.Commands.CreateProduct;
using Inventory.Application.Categories.Commands.CreateCategory;

namespace Inventory.Tests;

public class DomainAndApplicationTests
{
    [Fact]
    public void Product_Initialization_SetsPropertiesCorrectly()
    {
        // Arrange
        var productId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();

        // Act
        var product = new Product
        {
            Id = productId,
            SKU = "PRD-001",
            Name = "Тестовий товар",
            Description = "Опис тестового товару",
            Price = 150.50m,
            Quantity = 20,
            MinStock = 5,
            Unit = "шт",
            CategoryId = categoryId,
            ImageUrl = "https://example.com/image.png"
        };

        // Assert
        Assert.Equal(productId, product.Id);
        Assert.Equal("PRD-001", product.SKU);
        Assert.Equal("Тестовий товар", product.Name);
        Assert.Equal("Опис тестового товару", product.Description);
        Assert.Equal(150.50m, product.Price);
        Assert.Equal(20, product.Quantity);
        Assert.Equal(5, product.MinStock);
        Assert.Equal("шт", product.Unit);
        Assert.Equal(categoryId, product.CategoryId);
        Assert.Equal("https://example.com/image.png", product.ImageUrl);
    }

    [Fact]
    public void Category_Initialization_AllowsAddingProducts()
    {
        // Arrange & Act
        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = "Електроніка"
        };

        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = "Смартфон",
            CategoryId = category.Id
        };

        category.Products.Add(product);

        // Assert
        Assert.Equal("Електроніка", category.Name);
        Assert.Single(category.Products);
        Assert.Equal("Смартфон", category.Products.First().Name);
    }

    [Fact]
    public void StockMovement_Initialization_SupportsInAndOutTypes()
    {
        // Arrange
        var productId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var customerId = Guid.NewGuid();

        // Act - Incoming
        var movementIn = new StockMovement
        {
            Id = Guid.NewGuid(),
            ProductId = productId,
            SupplierId = supplierId,
            Type = MovementType.In,
            Quantity = 50,
            Note = "Постачання від дистриб'ютора"
        };

        // Act - Outgoing
        var movementOut = new StockMovement
        {
            Id = Guid.NewGuid(),
            ProductId = productId,
            CustomerId = customerId,
            Type = MovementType.Out,
            Quantity = 10,
            Note = "Відвантаження клієнту"
        };

        // Assert
        Assert.Equal(MovementType.In, movementIn.Type);
        Assert.Equal(50, movementIn.Quantity);
        Assert.Equal(supplierId, movementIn.SupplierId);

        Assert.Equal(MovementType.Out, movementOut.Type);
        Assert.Equal(10, movementOut.Quantity);
        Assert.Equal(customerId, movementOut.CustomerId);
    }

    [Fact]
    public void CreateProductCommand_Initialization_SetsAllProperties()
    {
        // Arrange
        var catId = Guid.NewGuid();

        // Act
        var command = new CreateProductCommand
        {
            SKU = "SKU-999",
            Name = "Ноутбук",
            Description = "Ігровий ноутбук",
            Price = 25000m,
            Quantity = 5,
            MinStock = 2,
            Unit = "шт",
            CategoryId = catId,
            ImageUrl = "/images/laptop.png"
        };

        // Assert
        Assert.Equal("SKU-999", command.SKU);
        Assert.Equal("Ноутбук", command.Name);
        Assert.Equal(25000m, command.Price);
        Assert.Equal(5, command.Quantity);
        Assert.Equal(catId, command.CategoryId);
    }

    [Fact]
    public void CreateCategoryCommand_Initialization_SetsName()
    {
        // Act
        var command = new CreateCategoryCommand
        {
            Name = "Аксесуари"
        };

        // Assert
        Assert.Equal("Аксесуари", command.Name);
    }

    [Fact]
    public void Supplier_Initialization_SetsPropertiesCorrectly()
    {
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = "ТОВ ПостачСервіс",
            ContactPerson = "Олександр",
            Phone = "+380501234567",
            Email = "supplier@example.com"
        };

        Assert.Equal("ТОВ ПостачСервіс", supplier.Name);
        Assert.Equal("Олександр", supplier.ContactPerson);
        Assert.Equal("+380501234567", supplier.Phone);
        Assert.Equal("supplier@example.com", supplier.Email);
    }

    [Fact]
    public void Customer_Initialization_SetsPropertiesCorrectly()
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "ФОП Іваненко",
            Phone = "+380671234567",
            Email = "customer@example.com",
            Address = "м. Київ, вул. Хрещатик 1"
        };

        Assert.Equal("ФОП Іваненко", customer.Name);
        Assert.Equal("+380671234567", customer.Phone);
        Assert.Equal("customer@example.com", customer.Email);
        Assert.Equal("м. Київ, вул. Хрещатик 1", customer.Address);
    }

    [Fact]
    public void ProductHistory_Initialization_SetsPropertiesCorrectly()
    {
        var prodId = Guid.NewGuid();
        var history = new ProductHistory
        {
            ProductId = prodId,
            Change = -5,
            StockAfter = 15,
            Note = "Списання браку",
            UserName = "admin"
        };

        Assert.Equal(prodId, history.ProductId);
        Assert.Equal(-5, history.Change);
        Assert.Equal(15, history.StockAfter);
        Assert.Equal("Списання браку", history.Note);
        Assert.Equal("admin", history.UserName);
    }
}
