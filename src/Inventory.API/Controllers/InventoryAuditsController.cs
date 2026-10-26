using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Inventory.Application.Common.Interfaces;
using Inventory.API.Dtos;
using Inventory.API.Hubs;
using Inventory.API.Services;
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
    public class InventoryAuditsController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IInventoryNotifier _notifier;
        private readonly IAuditService _auditService;

        public InventoryAuditsController(
            IApplicationDbContext context,
            IInventoryNotifier notifier,
            IAuditService auditService)
        {
            _context = context;
            _notifier = notifier;
            _auditService = auditService;
        }

        private string GetCurrentUserName()
        {
            return User.FindFirst(ClaimTypes.Name)?.Value 
                ?? User.FindFirst("unique_name")?.Value 
                ?? User.Identity?.Name 
                ?? "Комірник";
        }

        /// <summary>
        /// Отримання списку інвентаризацій з фільтрами
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<InventoryAuditSummaryDto>>> GetAll(
            [FromQuery] InventoryAuditStatus? status = null,
            [FromQuery] string? search = null)
        {
            var query = _context.InventoryAudits
                .AsNoTracking()
                .Include(a => a.Category)
                .AsQueryable();

            if (status.HasValue)
            {
                query = query.Where(a => a.Status == status.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                query = query.Where(a => a.AuditNumber.ToLower().Contains(s) || a.Title.ToLower().Contains(s));
            }

            var audits = await query
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new InventoryAuditSummaryDto
                {
                    Id = a.Id,
                    AuditNumber = a.AuditNumber,
                    Title = a.Title,
                    CreatedAt = a.CreatedAt,
                    CompletedAt = a.CompletedAt,
                    CreatedByUserName = a.CreatedByUserName,
                    Status = a.Status,
                    CategoryId = a.CategoryId,
                    CategoryName = a.Category != null ? a.Category.Name : null,
                    Notes = a.Notes,
                    TotalItemsCount = a.TotalItemsCount,
                    CheckedItemsCount = a.CheckedItemsCount,
                    DiscrepancyCount = a.DiscrepancyCount,
                    TotalSurplusCost = a.TotalSurplusCost,
                    TotalDeficitCost = a.TotalDeficitCost
                })
                .ToListAsync();

            return Ok(audits);
        }

        /// <summary>
        /// Детальний перегляд сесії переобліку разом з позиціями товарів
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<InventoryAuditDetailDto>> GetById(Guid id)
        {
            var audit = await _context.InventoryAudits
                .Include(a => a.Category)
                .Include(a => a.Items)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p!.Category)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (audit == null)
            {
                return NotFound("Сесію інвентаризації не знайдено");
            }

            var dto = new InventoryAuditDetailDto
            {
                Id = audit.Id,
                AuditNumber = audit.AuditNumber,
                Title = audit.Title,
                CreatedAt = audit.CreatedAt,
                CompletedAt = audit.CompletedAt,
                CreatedByUserName = audit.CreatedByUserName,
                Status = audit.Status,
                CategoryId = audit.CategoryId,
                CategoryName = audit.Category != null ? audit.Category.Name : null,
                Notes = audit.Notes,
                TotalItemsCount = audit.TotalItemsCount,
                CheckedItemsCount = audit.CheckedItemsCount,
                DiscrepancyCount = audit.DiscrepancyCount,
                TotalSurplusCost = audit.TotalSurplusCost,
                TotalDeficitCost = audit.TotalDeficitCost,
                Items = audit.Items
                    .OrderBy(i => i.Product != null ? i.Product.Name : string.Empty)
                    .Select(i => new InventoryAuditItemDto
                    {
                        Id = i.Id,
                        ProductId = i.ProductId,
                        ProductName = i.Product != null ? i.Product.Name : "Невідомий товар",
                        ProductSKU = i.Product != null ? i.Product.SKU : string.Empty,
                        CategoryName = i.Product?.Category != null ? i.Product.Category.Name : string.Empty,
                        Unit = i.Product != null ? i.Product.Unit : "шт.",
                        ExpectedQuantity = i.ExpectedQuantity,
                        ActualQuantity = i.ActualQuantity,
                        Discrepancy = i.Discrepancy,
                        UnitPrice = i.UnitPrice,
                        DiscrepancyCost = i.DiscrepancyCost,
                        Status = i.Status,
                        Notes = i.Notes
                    })
                    .ToList()
            };

            return Ok(dto);
        }

        /// <summary>
        /// Створення нової сесії інвентаризації (переобліку)
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<InventoryAuditSummaryDto>> Create([FromBody] CreateInventoryAuditDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title))
            {
                return BadRequest("Вкажіть назву інвентаризації");
            }

            // Завантажуємо товари для аудиту
            var productsQuery = _context.Products.AsNoTracking().AsQueryable();
            if (dto.CategoryId.HasValue)
            {
                productsQuery = productsQuery.Where(p => p.CategoryId == dto.CategoryId.Value);
            }

            var products = await productsQuery.OrderBy(p => p.Name).ToListAsync();
            if (products.Count == 0)
            {
                return BadRequest("Не знайдено товарів для проведення інвентаризації");
            }

            // Генеруємо унікальний номер документа
            var dateStr = DateTime.UtcNow.ToString("yyyyMMdd");
            var countToday = await _context.InventoryAudits
                .CountAsync(a => a.CreatedAt.Date == DateTime.UtcNow.Date);
            var auditNumber = $"INV-{dateStr}-{(countToday + 1):D3}";

            var currentUserName = GetCurrentUserName();

            var audit = new InventoryAudit
            {
                Id = Guid.NewGuid(),
                AuditNumber = auditNumber,
                Title = dto.Title.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedByUserName = currentUserName,
                Status = InventoryAuditStatus.Draft,
                CategoryId = dto.CategoryId,
                Notes = dto.Notes?.Trim(),
                TotalItemsCount = products.Count,
                CheckedItemsCount = 0,
                DiscrepancyCount = 0,
                TotalSurplusCost = 0,
                TotalDeficitCost = 0
            };

            // Створюємо позиції для кожного товару
            foreach (var p in products)
            {
                audit.Items.Add(new InventoryAuditItem
                {
                    Id = Guid.NewGuid(),
                    InventoryAuditId = audit.Id,
                    ProductId = p.Id,
                    ExpectedQuantity = p.Quantity,
                    ActualQuantity = null,
                    Discrepancy = null,
                    UnitPrice = p.Price,
                    DiscrepancyCost = 0,
                    Status = DiscrepancyStatus.Pending
                });
            }

            _context.InventoryAudits.Add(audit);
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Create",
                entityType: "InventoryAudit",
                entityId: audit.Id.ToString(),
                entityName: audit.AuditNumber,
                details: $"Створено відомість інвентаризації '{audit.Title}' ({audit.TotalItemsCount} позицій).");

            var result = new InventoryAuditSummaryDto
            {
                Id = audit.Id,
                AuditNumber = audit.AuditNumber,
                Title = audit.Title,
                CreatedAt = audit.CreatedAt,
                CreatedByUserName = audit.CreatedByUserName,
                Status = audit.Status,
                CategoryId = audit.CategoryId,
                Notes = audit.Notes,
                TotalItemsCount = audit.TotalItemsCount
            };

            return CreatedAtAction(nameof(GetById), new { id = audit.Id }, result);
        }

        /// <summary>
        /// Оновлення фактично порахованих кількостей товарів (масово або поштучно)
        /// </summary>
        [HttpPut("{id}/items")]
        public async Task<ActionResult<InventoryAuditDetailDto>> UpdateItems(
            Guid id, 
            [FromBody] BatchUpdateAuditItemsDto dto)
        {
            var audit = await _context.InventoryAudits
                .Include(a => a.Items)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (audit == null)
            {
                return NotFound("Сесію інвентаризації не знайдено");
            }

            if (audit.Status == InventoryAuditStatus.Completed || audit.Status == InventoryAuditStatus.Cancelled)
            {
                return BadRequest("Неможливо редагувати завершену або скасовану інвентаризацію");
            }

            var itemsDict = audit.Items.ToDictionary(i => i.Id);

            foreach (var update in dto.Items)
            {
                if (itemsDict.TryGetValue(update.ItemId, out var item))
                {
                    if (update.ActualQuantity.HasValue)
                    {
                        var actual = Math.Max(0, update.ActualQuantity.Value);
                        item.ActualQuantity = actual;
                        item.Discrepancy = actual - item.ExpectedQuantity;
                        item.DiscrepancyCost = item.Discrepancy.Value * item.UnitPrice;

                        if (item.Discrepancy == 0)
                            item.Status = DiscrepancyStatus.Match;
                        else if (item.Discrepancy > 0)
                            item.Status = DiscrepancyStatus.Surplus;
                        else
                            item.Status = DiscrepancyStatus.Deficit;
                    }
                    else
                    {
                        item.ActualQuantity = null;
                        item.Discrepancy = null;
                        item.DiscrepancyCost = 0;
                        item.Status = DiscrepancyStatus.Pending;
                    }

                    if (update.Notes != null)
                    {
                        item.Notes = update.Notes.Trim();
                    }
                }
            }

            // Перераховуємо підсумкову статистику сесії
            audit.CheckedItemsCount = audit.Items.Count(i => i.ActualQuantity.HasValue);
            audit.DiscrepancyCount = audit.Items.Count(i => i.Discrepancy.HasValue && i.Discrepancy.Value != 0);
            audit.TotalSurplusCost = audit.Items
                .Where(i => i.Discrepancy.HasValue && i.Discrepancy.Value > 0)
                .Sum(i => i.DiscrepancyCost);
            audit.TotalDeficitCost = audit.Items
                .Where(i => i.Discrepancy.HasValue && i.Discrepancy.Value < 0)
                .Sum(i => Math.Abs(i.DiscrepancyCost));

            if (audit.Status == InventoryAuditStatus.Draft && audit.CheckedItemsCount > 0)
            {
                audit.Status = InventoryAuditStatus.InProgress;
            }

            await _context.SaveChangesAsync();

            return await GetById(id);
        }

        /// <summary>
        /// Швидке підтвердження відповідності для всіх залишкових непорахованих товарів
        /// </summary>
        [HttpPost("{id}/match-all-remaining")]
        public async Task<ActionResult<InventoryAuditDetailDto>> MatchAllRemaining(Guid id)
        {
            var audit = await _context.InventoryAudits
                .Include(a => a.Items)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (audit == null) return NotFound("Сесію інвентаризації не знайдено");
            if (audit.Status == InventoryAuditStatus.Completed || audit.Status == InventoryAuditStatus.Cancelled)
            {
                return BadRequest("Неможливо модифікувати завершену інвентаризацію");
            }

            foreach (var item in audit.Items.Where(i => !i.ActualQuantity.HasValue))
            {
                item.ActualQuantity = item.ExpectedQuantity;
                item.Discrepancy = 0;
                item.DiscrepancyCost = 0;
                item.Status = DiscrepancyStatus.Match;
            }

            audit.CheckedItemsCount = audit.Items.Count(i => i.ActualQuantity.HasValue);
            audit.DiscrepancyCount = audit.Items.Count(i => i.Discrepancy.HasValue && i.Discrepancy.Value != 0);
            audit.TotalSurplusCost = audit.Items.Where(i => i.Discrepancy > 0).Sum(i => i.DiscrepancyCost);
            audit.TotalDeficitCost = audit.Items.Where(i => i.Discrepancy < 0).Sum(i => Math.Abs(i.DiscrepancyCost));

            if (audit.Status == InventoryAuditStatus.Draft)
            {
                audit.Status = InventoryAuditStatus.InProgress;
            }

            await _context.SaveChangesAsync();
            return await GetById(id);
        }

        /// <summary>
        /// Проведення інвентаризації: автоматичне оприбуткування лишків та списання нестач
        /// </summary>
        [HttpPost("{id}/complete")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<CompleteAuditResultDto>> Complete(Guid id)
        {
            var audit = await _context.InventoryAudits
                .Include(a => a.Items)
                    .ThenInclude(i => i.Product)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (audit == null)
            {
                return NotFound("Сесію інвентаризації не знайдено");
            }

            if (audit.Status == InventoryAuditStatus.Completed)
            {
                return BadRequest("Ця інвентаризація вже була проведена раніше");
            }

            if (audit.Status == InventoryAuditStatus.Cancelled)
            {
                return BadRequest("Неможливо провести скасовану інвентаризацію");
            }

            // Для непорахованих позицій автоматично приймаємо системну кількість
            foreach (var item in audit.Items.Where(i => !i.ActualQuantity.HasValue))
            {
                item.ActualQuantity = item.ExpectedQuantity;
                item.Discrepancy = 0;
                item.DiscrepancyCost = 0;
                item.Status = DiscrepancyStatus.Match;
            }

            var adjustedProductsCount = 0;
            var surplusCount = 0;
            var deficitCount = 0;
            var now = DateTime.UtcNow;

            foreach (var item in audit.Items.Where(i => i.Discrepancy.HasValue && i.Discrepancy.Value != 0))
            {
                var product = item.Product ?? await _context.Products.FindAsync(item.ProductId);
                if (product == null) continue;

                var diff = item.Discrepancy!.Value;
                var oldQty = product.Quantity;
                var newQty = item.ActualQuantity!.Value;

                // Оновлюємо фактичний залишок товару на складі
                product.Quantity = newQty;
                adjustedProductsCount++;

                if (diff > 0)
                {
                    // Лишок -> створюємо прибутковий рух (In)
                    surplusCount++;
                    var movement = new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        ProductId = product.Id,
                        Type = MovementType.In,
                        Quantity = diff,
                        Note = $"Оприбуткування надлишку за інвентаризацією №{audit.AuditNumber}",
                        MovementDate = now
                    };
                    _context.StockMovements.Add(movement);
                }
                else
                {
                    // Нестача -> створюємо розхідний рух (Out / Списання)
                    deficitCount++;
                    var movement = new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        ProductId = product.Id,
                        Type = MovementType.Out,
                        Quantity = Math.Abs(diff),
                        Note = $"Списання нестачі за інвентаризацією №{audit.AuditNumber}",
                        MovementDate = now
                    };
                    _context.StockMovements.Add(movement);
                }

                // Сповіщення через SignalR про зміну залишків товару
                await _notifier.NotifyProductChangeAsync(new ProductChangeEvent
                {
                    Action = "StockUpdated",
                    ProductId = product.Id,
                    ProductName = product.Name,
                    NewQuantity = product.Quantity,
                    Message = $"Залишок товару {product.Name} відкориговано до {product.Quantity} шт."
                });
            }

            audit.Status = InventoryAuditStatus.Completed;
            audit.CompletedAt = now;
            audit.CheckedItemsCount = audit.Items.Count;
            audit.DiscrepancyCount = audit.Items.Count(i => i.Discrepancy.HasValue && i.Discrepancy.Value != 0);
            audit.TotalSurplusCost = audit.Items.Where(i => i.Discrepancy > 0).Sum(i => i.DiscrepancyCost);
            audit.TotalDeficitCost = audit.Items.Where(i => i.Discrepancy < 0).Sum(i => Math.Abs(i.DiscrepancyCost));

            await _context.SaveChangesAsync();

            await _notifier.NotifyGeneralAsync(
                title: "Інвентаризація проведена",
                message: $"Документ {audit.AuditNumber} проведено. Відкориговано {adjustedProductsCount} позицій.",
                severity: "success");

            // Фіксація в системному аудиторському журналі
            await _auditService.LogAsync(
                action: "StockOperation",
                entityType: "InventoryAudit",
                entityId: audit.Id.ToString(),
                entityName: audit.AuditNumber,
                details: $"Проведено інвентаризацію {audit.AuditNumber}. Відкориговано {adjustedProductsCount} товарів (Лишків: +{audit.TotalSurplusCost:N2} грн, Нестач: -{audit.TotalDeficitCost:N2} грн).");

            return Ok(new CompleteAuditResultDto
            {
                AuditId = audit.Id,
                AdjustedProductsCount = adjustedProductsCount,
                SurplusMovementsCount = surplusCount,
                DeficitMovementsCount = deficitCount,
                Message = $"Інвентаризацію {audit.AuditNumber} успішно проведено! Складські залишки синхронізовано."
            });
        }

        /// <summary>
        /// Скасування сесії інвентаризації без внесення змін до залишків
        /// </summary>
        [HttpPost("{id}/cancel")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> Cancel(Guid id)
        {
            var audit = await _context.InventoryAudits.FindAsync(id);
            if (audit == null) return NotFound("Сесію інвентаризації не знайдено");

            if (audit.Status == InventoryAuditStatus.Completed)
            {
                return BadRequest("Неможливо скасувати вже проведену інвентаризацію");
            }

            audit.Status = InventoryAuditStatus.Cancelled;
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Update",
                entityType: "InventoryAudit",
                entityId: audit.Id.ToString(),
                entityName: audit.AuditNumber,
                details: $"Скасовано сесію інвентаризації {audit.AuditNumber}.");

            return Ok(new { message = $"Інвентаризацію {audit.AuditNumber} скасовано" });
        }

        /// <summary>
        /// Експорт акта розбіжностей у форматі CSV
        /// </summary>
        [HttpGet("{id}/export-csv")]
        public async Task<IActionResult> ExportActCsv(Guid id)
        {
            var audit = await _context.InventoryAudits
                .AsNoTracking()
                .Include(a => a.Items)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p!.Category)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (audit == null) return NotFound("Сесію інвентаризації не знайдено");

            var sb = new StringBuilder();
            sb.AppendLine($"АКТ ІНВЕНТАРИЗАЦІЇ ТА РОЗБІЖНОСТЕЙ № {audit.AuditNumber}");
            sb.AppendLine($"Назва: {audit.Title}");
            sb.AppendLine($"Дата створення: {audit.CreatedAt:yyyy-MM-dd HH:mm}; Статус: {audit.Status}");
            sb.AppendLine($"Відповідальний: {audit.CreatedByUserName}");
            sb.AppendLine();
            sb.AppendLine("Артикул;Товар;Категорія;Облік (шт);Факт (шт);Розбіжність (шт);Ціна (грн);Сума розбіжності (грн);Статус;Примітка");

            foreach (var item in audit.Items.OrderBy(i => i.Product?.Name))
            {
                var sku = item.Product?.SKU ?? string.Empty;
                var name = (item.Product?.Name ?? string.Empty).Replace(";", " ");
                var cat = (item.Product?.Category?.Name ?? string.Empty).Replace(";", " ");
                var exp = item.ExpectedQuantity;
                var act = item.ActualQuantity.HasValue ? item.ActualQuantity.Value.ToString() : "—";
                var diff = item.Discrepancy.HasValue ? item.Discrepancy.Value.ToString() : "—";
                var price = item.UnitPrice.ToString("F2");
                var diffCost = item.DiscrepancyCost.ToString("F2");
                var statusText = item.Status switch
                {
                    DiscrepancyStatus.Match => "Збіг",
                    DiscrepancyStatus.Surplus => "Лишок",
                    DiscrepancyStatus.Deficit => "Нестача",
                    _ => "Не перевірено"
                };
                var note = (item.Notes ?? string.Empty).Replace(";", " ");

                sb.AppendLine($"{sku};\"{name}\";\"{cat}\";{exp};{act};{diff};{price};{diffCost};{statusText};\"{note}\"");
            }

            sb.AppendLine();
            sb.AppendLine($"ПІДСУМКИ:;Всього позицій: {audit.TotalItemsCount};Перевірено: {audit.CheckedItemsCount};Розбіжностей: {audit.DiscrepancyCount}");
            sb.AppendLine($"Сума лишків (+): {audit.TotalSurplusCost:F2} грн;Сума нестач (-): {audit.TotalDeficitCost:F2} грн;Сальдо розбіжностей: {(audit.TotalSurplusCost - audit.TotalDeficitCost):F2} грн");

            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
            var fileName = $"inventory_act_{audit.AuditNumber}.csv";

            return File(bytes, "text/csv; charset=utf-8", fileName);
        }
    }
}
