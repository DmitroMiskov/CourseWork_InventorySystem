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
        public async Task<IActionResult> Create(CreateProductCommand command)
        {
            // Відправляємо команду (Command)
            var productId = await _mediator.Send(command);
            return Ok(productId);
        }

        // DELETE: api/products/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            await _mediator.Send(new DeleteProductCommand(id));
            return NoContent(); // 204 No Content — стандартна відповідь на успішне видалення
        }

        // PUT: api/products/{id}
        [HttpPut("{id}")]
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
                return BadRequest("Файл не вибрано");

            try
            {
                using var stream = new StreamReader(file.OpenReadStream());
                
                // 👇 НАЛАШТУВАННЯ ДЛЯ "ВСЕЇДНОСТІ"
                var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    DetectDelimiter = true, // Автоматично знайде ; або ,
                    PrepareHeaderForMatch = args => args.Header.ToLower(), // Ігнорує регістр (Name = name)
                    MissingFieldFound = null, // Не ламається, якщо чогось не вистачає
                    HeaderValidated = null,
                    BadDataFound = null, // Пропускає побиті рядки
                };

                using var csv = new CsvReader(stream, config);

                var records = csv.GetRecords<ProductCsvDto>().ToList();
                
                var newProducts = new List<Product>();

                foreach (var record in records)
                {
                    // 1. Знаходимо або створюємо категорію
                    var category = await _context.Categories
                        .FirstOrDefaultAsync(c => c.Name.ToLower() == record.CategoryName.ToLower());

                    if (category == null)
                    {
                        category = new Category { Id = Guid.NewGuid(), Name = record.CategoryName };
                        _context.Categories.Add(category);
                        await _context.SaveChangesAsync();
                    }

                    // 2. Створюємо товар
                    var product = new Product
                    {
                        Id = Guid.NewGuid(),
                        Name = record.Name,
                        SKU = record.Sku,
                        Price = record.Price,
                        Quantity = record.Quantity,
                        Unit = record.Unit,
                        MinStock = record.MinStock,
                        CategoryId = category.Id,
                        CreatedAt = DateTime.UtcNow
                    };

                    newProducts.Add(product);
                }

                _context.Products.AddRange(newProducts);
                await _context.SaveChangesAsync();

                return Ok(new { message = $"Успішно імпортовано {newProducts.Count} товарів" });
            }
            catch (Exception ex)
            {
                // Цей текст ви побачите в Response, якщо щось піде не так
                return BadRequest($"Помилка: {ex.Message}. \nСпробуйте замінити ';' на ',' у файлі або перевірте заголовки.");
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