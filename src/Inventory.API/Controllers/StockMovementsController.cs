using Inventory.Domain.Entities;
using Inventory.Domain.Enums;
using Inventory.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StockMovementsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public StockMovementsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("product/{productId}")]
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
                    m.Type,
                    m.Quantity,
                    // 1 = In (Прихід), 2 = Out (Розхід)
                    Change = m.Type == MovementType.In ? m.Quantity : -m.Quantity,
                    Note = m.Note, 
                    UserName = "Система",
                    CreatedAt = m.MovementDate
                })
                .ToListAsync();

            return Ok(history);
        }

        [HttpPost]
        public async Task<IActionResult> Create(CreateMovementDto dto)
        {
            if (dto.Quantity <= 0) return BadRequest("Кількість має бути > 0");

            var product = await _context.Products.FindAsync(dto.ProductId);
            if (product == null) return NotFound("Товар не знайдено");

            // --- БІЗНЕС-ЛОГІКА ОНОВЛЕННЯ ЗАЛИШКІВ ---
            
            // Якщо Type = 1 (In/Прихід)
            if (dto.Type == MovementType.In) 
            {
                product.Quantity += dto.Quantity;
            }
            // Якщо Type = 2 (Out/Розхід)
            else if (dto.Type == MovementType.Out) 
            {
                if (product.Quantity < dto.Quantity)
                {
                    return BadRequest($"Помилка: Недостатньо товару. На складі: {product.Quantity}");
                }
                product.Quantity -= dto.Quantity;
            }
            else 
            {
                // Якщо прийшло 0 (None) або щось ліве
                return BadRequest("Невірний тип операції (має бути 1 або 2)");
            }

            // --- СТВОРЕННЯ ЗАПИСУ В ІСТОРІЇ ---
            var movement = new StockMovement
            {
                Id = Guid.NewGuid(),
                ProductId = dto.ProductId,
                Type = dto.Type,
                Quantity = dto.Quantity,
                Note = dto.Reason, // Мапимо DTO.Reason -> Entity.Note
                MovementDate = DateTime.UtcNow,
                SupplierId = dto.SupplierId,
                CustomerId = dto.CustomerId
            };

            _context.StockMovements.Add(movement);
            
            // Зберігаємо і рух, і оновлений товар
            await _context.SaveChangesAsync();

            return Ok(new { movement.Id, Message = "Успішно" });
        }
    }

    public class CreateMovementDto
    {
        public Guid ProductId { get; set; }
        public MovementType Type { get; set; } // Має приходити 1 або 2
        public int Quantity { get; set; }
        public string? Reason { get; set; } // Фронтенд шле Reason
        public Guid? SupplierId { get; set; }
        public Guid? CustomerId { get; set; }
    }
}