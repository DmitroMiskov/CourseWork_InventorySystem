using Inventory.Application.Common.Interfaces;
using Inventory.API.Dtos;
using Inventory.Domain.Entities;
using Inventory.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class StockMovementsController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public StockMovementsController(IApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetAll([FromQuery] int limit = 100)
        {
            var movements = await _context.StockMovements
                .Include(m => m.Product)
                .Include(m => m.Supplier)
                .Include(m => m.Customer)
                .OrderByDescending(m => m.MovementDate)
                .Take(limit)
                .Select(m => new 
                {
                    m.Id,
                    m.ProductId,
                    ProductName = m.Product != null ? m.Product.Name : "Товар",
                    m.Type,
                    MovementType = (int)m.Type,
                    m.Quantity,
                    Change = m.Type == MovementType.In ? m.Quantity : -m.Quantity,
                    Note = m.Note, 
                    Reason = m.Note,
                    SupplierName = m.Supplier != null ? m.Supplier.Name : null,
                    CustomerName = m.Customer != null ? m.Customer.Name : null,
                    CreatedAt = m.MovementDate
                })
                .ToListAsync();

            return Ok(movements);
        }

        [HttpGet("product/{productId}")]
        [HttpGet("by-product/{productId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetByProduct(Guid productId)
        {
            var history = await _context.StockMovements
                .Include(m => m.Supplier)
                .Include(m => m.Customer)
                .Where(m => m.ProductId == productId)
                .OrderByDescending(m => m.MovementDate)
                .Select(m => new 
                {
                    m.Id,
                    m.ProductId,
                    m.Type,
                    MovementType = (int)m.Type,
                    m.Quantity,
                    Change = m.Type == MovementType.In ? m.Quantity : -m.Quantity,
                    Note = m.Note, 
                    Reason = m.Note,
                    SupplierName = m.Supplier != null ? m.Supplier.Name : null,
                    CustomerName = m.Customer != null ? m.Customer.Name : null,
                    UserName = "Система",
                    CreatedAt = m.MovementDate
                })
                .ToListAsync();

            return Ok(history);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateMovementDto dto)
        {
            if (dto.Quantity <= 0) return BadRequest("Кількість має бути > 0");

            var product = await _context.Products.FindAsync(dto.ProductId);
            if (product == null) return NotFound("Товар не знайдено");

            var effectiveType = dto.Type != MovementType.None 
                ? dto.Type 
                : (dto.MovementType ?? MovementType.None);

            if (effectiveType == MovementType.In) 
            {
                product.Quantity += dto.Quantity;
            }
            else if (effectiveType == MovementType.Out) 
            {
                if (product.Quantity < dto.Quantity)
                {
                    return BadRequest($"Помилка: Недостатньо товару. На складі: {product.Quantity}");
                }
                product.Quantity -= dto.Quantity;
            }
            else 
            {
                return BadRequest("Невірний тип операції (має бути 1 або 2)");
            }

            var movement = new StockMovement
            {
                Id = Guid.NewGuid(),
                ProductId = dto.ProductId,
                Type = effectiveType,
                Quantity = dto.Quantity,
                Note = dto.Reason,
                MovementDate = DateTime.UtcNow,
                SupplierId = dto.SupplierId,
                CustomerId = dto.CustomerId
            };

            _context.StockMovements.Add(movement);

            var change = effectiveType == MovementType.In ? dto.Quantity : -dto.Quantity;
            var actionName = effectiveType == MovementType.In ? "Надходження" : "Списання";
            _context.ProductHistories.Add(new ProductHistory
            {
                Id = Guid.NewGuid(),
                ProductId = dto.ProductId,
                Change = change,
                StockAfter = product.Quantity,
                Note = $"{actionName}: {dto.Reason ?? "Операція зі складом"}",
                UserName = User.Identity?.Name ?? "Система",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new { movement.Id, Message = "Успішно" });
        }
    }
}