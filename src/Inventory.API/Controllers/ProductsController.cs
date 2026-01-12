using Inventory.Application.Products.Commands.CreateProduct;
using Inventory.Application.Products.Commands.DeleteProduct;
using Inventory.Application.Products.Queries.GetProducts;
using Inventory.Application.Categories.Commands.CreateCategory;
using Inventory.Application.Categories.Queries.GetCategories;
using Inventory.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public ProductsController(IMediator mediator)
        {
            _mediator = mediator;
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