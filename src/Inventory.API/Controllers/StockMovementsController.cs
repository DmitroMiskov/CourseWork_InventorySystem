using Inventory.Domain.Entities;
using Inventory.Domain.Enums;
using Inventory.Infrastructure.Persistence; // Або ваш namespace контексту
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

        // GET: Отримати історію конкретного товару
        [HttpGet("product/{productId}")]
        public async Task<ActionResult<IEnumerable<StockMovement>>> GetByProduct(Guid productId)
        {
            return await _context.StockMovements
                .Where(m => m.ProductId == productId)
                .OrderByDescending(m => m.MovementDate) // Спочатку нові
                .ToListAsync();
        }

        // POST: Створити рух (Прихід або Розхід)
        [HttpPost]
        public async Task<ActionResult<Guid>> Create(CreateMovementDto dto)
        {
            // 1. Знаходимо товар
            var product = await _context.Products.FindAsync(dto.ProductId);
            if (product == null) return NotFound("Товар не знайдено");

            // 2. Створюємо запис в історії
            var movement = new StockMovement
            {
                Id = Guid.NewGuid(),
                ProductId = dto.ProductId,
                Type = dto.Type,
                Quantity = dto.Quantity,
                Note = dto.Note,
                MovementDate = DateTime.UtcNow
            };

            // 3. Оновлюємо кількість самого товару (Бізнес-логіка)
            if (dto.Type == MovementType.In)
            {
                product.Quantity += dto.Quantity;
            }
            else if (dto.Type == MovementType.Out)
            {
                if (product.Quantity < dto.Quantity)
                {
                    return BadRequest($"Недостатньо товару на складі. Доступно: {product.Quantity}");
                }
                product.Quantity -= dto.Quantity;
            }

            // 4. Зберігаємо все разом (транзакція)
            _context.StockMovements.Add(movement);
            await _context.SaveChangesAsync();

            return Ok(movement.Id);
        }
    }

    // DTO для отримання даних з фронтенду
    public class CreateMovementDto
    {
        public Guid ProductId { get; set; }
        public MovementType Type { get; set; } // 1 = In, 2 = Out
        public int Quantity { get; set; }
        public string? Note { get; set; }
    }
}