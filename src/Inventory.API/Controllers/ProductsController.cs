using Inventory.Application.Products.Commands.CreateProduct;
using Inventory.Application.Products.Queries.GetProducts;
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
    }
}