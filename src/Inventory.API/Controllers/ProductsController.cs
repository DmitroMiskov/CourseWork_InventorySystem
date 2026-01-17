using Inventory.Application.Products.Commands.CreateProduct;
using Inventory.Application.Products.Commands.DeleteProduct;
using Inventory.Application.Products.Commands.UpdateProduct;
using Inventory.Application.Products.Queries.GetProducts;
using Inventory.Application.Categories.Commands.CreateCategory;
using Inventory.Application.Categories.Queries.GetCategories;
using Inventory.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using CsvHelper;
using System.Globalization;
using Inventory.API.Dtos;
using Microsoft.EntityFrameworkCore; 
using Inventory.Infrastructure.Persistence;
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Authorization;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly ApplicationDbContext _context;

        public ProductsController(IMediator mediator, ApplicationDbContext context)
        {
            _mediator = mediator;
            _context = context;
        }

        // GET: api/products
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            // Відправляємо запит (Query)
            var products = await _mediator.Send(new GetProductsQuery());
            return Ok(products);
        }

        // POST: api/products
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create(CreateProductCommand command)
        {
            // Відправляємо команду (Command)
            var productId = await _mediator.Send(command);
            return Ok(productId);
        }

        // DELETE: api/products/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            await _mediator.Send(new DeleteProductCommand(id));
            return NoContent(); // 204 No Content — стандартна відповідь на успішне видалення
        }

        // PUT: api/products/{id}
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(Guid id, UpdateProductCommand command)
        {
            if (id != command.Id)
            {
                return BadRequest();
            }

            await _mediator.Send(command);
            return NoContent();
        }

       [HttpPost("import")]
        public async Task<IActionResult> Import(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Файл порожній");

            try
            {
                using (var stream = new StreamReader(file.OpenReadStream()))
                {
                    var productsToAdd = new List<Product>();
                    
                    // Читаємо перший рядок (заголовки), щоб пропустити його
                    // або перевірити формат, але для простоти просто пропускаємо
                    var headerLine = await stream.ReadLineAsync();

                    while (!stream.EndOfStream)
                    {
                        var line = await stream.ReadLineAsync();
                        if (string.IsNullOrWhiteSpace(line)) continue;

                        // Розбиваємо по комі (або крапці з комою)
                        var values = line.Split(new[] { ',', ';' });

                        // Очікуваний формат CSV:
                        // Назва, Опис, Ціна, Кількість, Одиниця, Категорія(Назва), МінЗалишок
                        if (values.Length < 5) continue; // Пропускаємо биті рядки

                        var name = values[0].Trim();
                        // Якщо такого товару вже є назва - пропускаємо (або можна оновлювати)
                        if (_context.Products.Any(p => p.Name == name)) continue;

                        var description = values.Length > 1 ? values[1].Trim() : "";
                        
                        // Парсинг чисел (з заміною крапки на кому і навпаки для надійності)
                        decimal.TryParse(values[2].Replace('.', ','), out decimal price);
                        int.TryParse(values[3], out int quantity);
                        
                        var unit = values.Length > 4 ? values[4].Trim() : "шт";
                        
                        // --- РОЗУМНА РОБОТА З КАТЕГОРІЄЮ ---
                        var categoryName = values.Length > 5 ? values[5].Trim() : "Інше";
                        var category = _context.Categories.FirstOrDefault(c => c.Name == categoryName);
                        
                        // Якщо категорії немає - створюємо її "на льоту"
                        if (category == null)
                        {
                            category = new Category { Name = categoryName };
                            _context.Categories.Add(category);
                            await _context.SaveChangesAsync(); // Зберігаємо, щоб отримати ID
                        }
                        
                        int.TryParse(values.Length > 6 ? values[6] : "0", out int minStock);

                        var product = new Product
                        {
                            Name = name,
                            Description = description,
                            Price = price,
                            Quantity = quantity,
                            Unit = unit,
                            CategoryId = category.Id, // Використовуємо ID знайденої/створеної категорії
                            MinStock = minStock,
                            ImageUrl = "" // Порожнє фото
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
                // 👇 ОСЬ ЦЕ ПОКАЖЕ ВАМ СПРАВЖНЮ ПРИЧИНУ ПОМИЛКИ
                var innerMessage = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest($"Помилка імпорту: {innerMessage}");
            }
        }

        [HttpPost("upload-image")]
        [Authorize]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            try 
            {
                if (file == null || file.Length == 0)
                    return BadRequest("Файл не обрано");

                var folderPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images");
                
                // Створюємо папку, якщо немає
                if (!Directory.Exists(folderPath))
                    Directory.CreateDirectory(folderPath);

                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(folderPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var url = $"/images/{fileName}";
                
                // 👇 Явно повертаємо статус 200 OK з JSON
                return StatusCode(200, new { url });
            }
            catch (Exception ex)
            {
                // Це покаже помилку в консолі Docker
                Console.WriteLine($"UPLOAD ERROR: {ex.Message}");
                return StatusCode(500, "Internal server error uploading file");
            }
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class CategoriesController : ControllerBase
    {
        private readonly IMediator _mediator;

        public CategoriesController(IMediator mediator)
        {
            _mediator = mediator;
        }

        // 👇 НОВИЙ МЕТОД
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var categories = await _mediator.Send(new GetCategoriesQuery());
            return Ok(categories);
        }

        [HttpPost]
        public async Task<IActionResult> Create(CreateCategoryCommand command)
        {
            var id = await _mediator.Send(command);
            return Ok(id);
        }
    }
}