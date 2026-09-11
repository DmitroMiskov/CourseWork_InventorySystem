using Inventory.Application.Common.Interfaces;
using Inventory.Application.Products.Commands.CreateProduct;
using Inventory.Application.Products.Commands.DeleteProduct;
using Inventory.Application.Products.Commands.UpdateProduct;
using Inventory.Application.Products.Queries.GetProducts;
using Inventory.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using CsvHelper;
using System.Globalization;
using Inventory.API.Dtos;
using Microsoft.EntityFrameworkCore; 
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Authorization;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProductsController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly IApplicationDbContext _context;

        public ProductsController(IMediator mediator, IApplicationDbContext context)
        {
            _mediator = mediator;
            _context = context;
        }

        // GET: api/products
        // 👇 Доступно ВСІМ (User + Admin), бо тут немає уточнення Roles
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] int? pageNumber, 
            [FromQuery] int? pageSize,
            [FromQuery] string? searchTerm,
            [FromQuery] Guid? categoryId)
        {
            if (pageNumber.HasValue || pageSize.HasValue)
            {
                var paginated = await _mediator.Send(new GetProductsQuery
                {
                    PageNumber = pageNumber ?? 1,
                    PageSize = pageSize ?? 10,
                    SearchTerm = searchTerm,
                    CategoryId = categoryId
                });
                return Ok(paginated);
            }

            var result = await _mediator.Send(new GetProductsQuery
            {
                PageNumber = 1,
                PageSize = 10000,
                SearchTerm = searchTerm,
                CategoryId = categoryId
            });
            return Ok(result.Items);
        }

        // POST: api/products
        // 👇 Тільки АДМІН може створювати
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Create(CreateProductCommand command)
        {
            var productId = await _mediator.Send(command);
            return Ok(productId);
        }

        // DELETE: api/products/{id}
        // 👇 Тільки АДМІН може видаляти
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            await _mediator.Send(new DeleteProductCommand(id));
            return NoContent();
        }

        // PUT: api/products/{id}
        // 👇 Тільки АДМІН може редагувати
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin, admin")]
        public async Task<IActionResult> Update(Guid id, UpdateProductCommand command)
        {
            if (id != command.Id)
            {
                return BadRequest();
            }

            await _mediator.Send(command);
            return NoContent();
        }

        // POST: api/products/import
        // 👇 Тільки АДМІН може імпортувати
        [HttpPost("import")]
        [Authorize(Roles = "Admin, admin")]
        public async Task<IActionResult> Import(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Файл порожній");

            try
            {
                using (var stream = new StreamReader(file.OpenReadStream()))
                {
                    var productsToAdd = new List<Product>();
                    var headerLine = await stream.ReadLineAsync();

                    while (!stream.EndOfStream)
                    {
                        var line = await stream.ReadLineAsync();
                        if (string.IsNullOrWhiteSpace(line)) continue;

                        var values = line.Split(new[] { ',', ';' });
                        if (values.Length < 5) continue;

                        var name = values[0].Trim();
                        if (_context.Products.Any(p => p.Name == name)) continue;

                        var description = values.Length > 1 ? values[1].Trim() : "";
                        var priceStr = values[2].Trim().Replace(',', '.');
                        decimal.TryParse(priceStr, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal price);
                        int.TryParse(values[3], out int quantity);
                        var unit = values.Length > 4 ? values[4].Trim() : "шт";
                        
                        var categoryName = values.Length > 5 ? values[5].Trim() : "Інше";
                        var category = _context.Categories.FirstOrDefault(c => c.Name == categoryName);
                        
                        if (category == null)
                        {
                            category = new Category { Name = categoryName };
                            _context.Categories.Add(category);
                            await _context.SaveChangesAsync();
                        }
                        
                        int.TryParse(values.Length > 6 ? values[6] : "0", out int minStock);
                        var sku = values.Length > 7 && !string.IsNullOrWhiteSpace(values[7]) 
                            ? values[7].Trim() 
                            : $"SKU-{Guid.NewGuid().ToString()[..8].ToUpper()}";

                        var product = new Product
                        {
                            Id = Guid.NewGuid(),
                            SKU = sku,
                            Name = name,
                            Description = description,
                            Price = price,
                            Quantity = quantity,
                            Unit = unit,
                            CategoryId = category.Id,
                            MinStock = minStock,
                            ImageUrl = "",
                            CreatedAt = DateTime.UtcNow
                        };

                        productsToAdd.Add(product);
                    }

                    if (productsToAdd.Count > 0)
                    {
                        await _context.Products.AddRangeAsync(productsToAdd);
                        await _context.SaveChangesAsync();
                    }

                    return Ok($"Успішно імпортовано {productsToAdd.Count} товарів.");
                }
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest($"Помилка імпорту: {innerMessage}");
            }
        }

        // POST: api/products/upload-image
        // 👇 Тільки АДМІН може завантажувати фото
        [HttpPost("upload-image")]
        [Authorize(Roles = "Admin, admin")]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            try 
            {
                if (file == null || file.Length == 0)
                    return BadRequest("Файл не обрано");

                var folderPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images");
                if (!Directory.Exists(folderPath))
                    Directory.CreateDirectory(folderPath);

                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(folderPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var url = $"/images/{fileName}";
                return StatusCode(200, new { url });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"UPLOAD ERROR: {ex.Message}");
                return StatusCode(500, "Internal server error uploading file");
            }
        }

        [HttpPost("issue")]
        [Authorize] // Це може робити і звичайний юзер (Комірник)
        public async Task<IActionResult> IssueProducts([FromBody] List<CheckoutItemDto> items)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var item in items)
                {
                    var product = await _context.Products.FindAsync(item.ProductId);
                    
                    if (product == null) 
                        return BadRequest($"Товар з ID {item.ProductId} не знайдено");

                    if (product.Quantity < item.Quantity)
                        return BadRequest($"Недостатньо товару '{product.Name}'. На складі: {product.Quantity}, запит: {item.Quantity}");

                    // Списуємо
                    product.Quantity -= item.Quantity;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync(); // Зберігаємо все разом

                return Ok(new { message = "Товари успішно видано" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(); // Якщо помилка - скасовуємо все
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("{id}/history")]
        [Authorize]
        public async Task<IActionResult> GetProductHistory(Guid id)
        {
            var history = await _context.ProductHistories
                .Where(h => h.ProductId == id)
                .OrderByDescending(h => h.CreatedAt) // Спочатку нові
                .ToListAsync();

            return Ok(history);
        }
    }
}