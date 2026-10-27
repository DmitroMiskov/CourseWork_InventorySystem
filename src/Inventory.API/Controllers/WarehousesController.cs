using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
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
    public class WarehousesController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IInventoryNotifier _notifier;
        private readonly IAuditService _auditService;

        public WarehousesController(
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
                ?? "Складський оператор";
        }

        private async Task<string> GenerateTransferNumberAsync()
        {
            var today = DateTime.UtcNow.ToString("yyyyMMdd");
            var prefix = $"TR-{today}-";
            
            var lastTransfer = await _context.WarehouseTransfers
                .Where(t => t.TransferNumber.StartsWith(prefix))
                .OrderByDescending(t => t.TransferNumber)
                .Select(t => t.TransferNumber)
                .FirstOrDefaultAsync();

            int nextNum = 1;
            if (lastTransfer != null && lastTransfer.Length >= prefix.Length + 3)
            {
                var numPart = lastTransfer.Substring(prefix.Length);
                if (int.TryParse(numPart, out int parsed))
                {
                    nextNum = parsed + 1;
                }
            }

            return $"{prefix}{nextNum:D3}";
        }

        /// <summary>
        /// Отримання списку всіх складів із показниками залишків та вартості
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<WarehouseSummaryDto>>> GetAll()
        {
            var warehouses = await _context.Warehouses
                .AsNoTracking()
                .Include(w => w.Stocks)
                    .ThenInclude(s => s.Product)
                .OrderByDescending(w => w.IsDefault)
                .ThenBy(w => w.Name)
                .ToListAsync();

            var result = warehouses.Select(w => new WarehouseSummaryDto
            {
                Id = w.Id,
                Name = w.Name,
                Code = w.Code,
                Address = w.Address,
                IsDefault = w.IsDefault,
                IsActive = w.IsActive,
                CreatedAt = w.CreatedAt,
                Description = w.Description,
                TotalItemsCount = w.Stocks.Count(s => s.Quantity > 0),
                TotalQuantity = w.Stocks.Sum(s => s.Quantity),
                TotalValuation = w.Stocks.Sum(s => s.Quantity * (s.Product != null ? s.Product.Price : 0)),
                LowStockCount = w.Stocks.Count(s => s.Quantity <= (s.MinStock ?? 5))
            }).ToList();

            return Ok(result);
        }

        /// <summary>
        /// Отримання деталей конкретного складу
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<WarehouseSummaryDto>> GetById(Guid id)
        {
            var w = await _context.Warehouses
                .AsNoTracking()
                .Include(x => x.Stocks)
                    .ThenInclude(s => s.Product)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (w == null)
            {
                return NotFound("Склад не знайдено");
            }

            var inTransitIncoming = await _context.WarehouseTransfers
                .CountAsync(t => t.ToWarehouseId == id && t.Status == TransferStatus.InTransit);
            var inTransitOutgoing = await _context.WarehouseTransfers
                .CountAsync(t => t.FromWarehouseId == id && t.Status == TransferStatus.InTransit);

            return Ok(new WarehouseSummaryDto
            {
                Id = w.Id,
                Name = w.Name,
                Code = w.Code,
                Address = w.Address,
                IsDefault = w.IsDefault,
                IsActive = w.IsActive,
                CreatedAt = w.CreatedAt,
                Description = w.Description,
                TotalItemsCount = w.Stocks.Count(s => s.Quantity > 0),
                TotalQuantity = w.Stocks.Sum(s => s.Quantity),
                TotalValuation = w.Stocks.Sum(s => s.Quantity * (s.Product != null ? s.Product.Price : 0)),
                LowStockCount = w.Stocks.Count(s => s.Quantity <= (s.MinStock ?? 5)),
                InTransitIncomingCount = inTransitIncoming,
                InTransitOutgoingCount = inTransitOutgoing
            });
        }

        /// <summary>
        /// Створення нового складу (Тільки Admin або Manager)
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<WarehouseSummaryDto>> Create([FromBody] CreateWarehouseDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest("Вкажіть назву складу");
            }

            var cleanCode = string.IsNullOrWhiteSpace(dto.Code) 
                ? $"WH-{Guid.NewGuid().ToString().Substring(0, 5).ToUpper()}" 
                : dto.Code.Trim().ToUpper();

            if (await _context.Warehouses.AnyAsync(w => w.Code == cleanCode))
            {
                return BadRequest($"Склад з кодом '{cleanCode}' вже існує");
            }

            if (dto.IsDefault)
            {
                var currentDefaults = await _context.Warehouses.Where(w => w.IsDefault).ToListAsync();
                foreach (var d in currentDefaults)
                {
                    d.IsDefault = false;
                }
            }

            var warehouse = new Warehouse
            {
                Id = Guid.NewGuid(),
                Name = dto.Name.Trim(),
                Code = cleanCode,
                Address = dto.Address?.Trim(),
                IsDefault = dto.IsDefault,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                Description = dto.Description?.Trim()
            };

            _context.Warehouses.Add(warehouse);
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Create",
                entityType: "Warehouse",
                entityId: warehouse.Id.ToString(),
                entityName: warehouse.Name,
                details: $"Створено новий склад: '{warehouse.Name}' (Код: {warehouse.Code}).");

            return CreatedAtAction(nameof(GetById), new { id = warehouse.Id }, new WarehouseSummaryDto
            {
                Id = warehouse.Id,
                Name = warehouse.Name,
                Code = warehouse.Code,
                Address = warehouse.Address,
                IsDefault = warehouse.IsDefault,
                IsActive = warehouse.IsActive,
                CreatedAt = warehouse.CreatedAt,
                Description = warehouse.Description,
                TotalItemsCount = 0,
                TotalQuantity = 0,
                TotalValuation = 0
            });
        }

        /// <summary>
        /// Редагування складу
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<WarehouseSummaryDto>> Update(Guid id, [FromBody] UpdateWarehouseDto dto)
        {
            var warehouse = await _context.Warehouses.FindAsync(id);
            if (warehouse == null)
            {
                return NotFound("Склад не знайдено");
            }

            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest("Назва складу не може бути порожньою");
            }

            var cleanCode = dto.Code.Trim().ToUpper();
            if (await _context.Warehouses.AnyAsync(w => w.Code == cleanCode && w.Id != id))
            {
                return BadRequest($"Склад з кодом '{cleanCode}' вже використовується іншим складом");
            }

            if (dto.IsDefault && !warehouse.IsDefault)
            {
                var currentDefaults = await _context.Warehouses.Where(w => w.IsDefault && w.Id != id).ToListAsync();
                foreach (var d in currentDefaults)
                {
                    d.IsDefault = false;
                }
            }

            warehouse.Name = dto.Name.Trim();
            warehouse.Code = cleanCode;
            warehouse.Address = dto.Address?.Trim();
            warehouse.IsDefault = dto.IsDefault;
            warehouse.IsActive = dto.IsActive;
            warehouse.Description = dto.Description?.Trim();

            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Update",
                entityType: "Warehouse",
                entityId: warehouse.Id.ToString(),
                entityName: warehouse.Name,
                details: $"Оновлено реквізити складу '{warehouse.Name}'.");

            return await GetById(id);
        }

        /// <summary>
        /// Видалення або деактивація складу (Тільки Admin)
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var warehouse = await _context.Warehouses
                .Include(w => w.Stocks)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (warehouse == null)
            {
                return NotFound("Склад не знайдено");
            }

            if (warehouse.IsDefault)
            {
                return BadRequest("Неможливо видалити основний склад системи за замовчуванням");
            }

            var totalStockQty = warehouse.Stocks.Sum(s => s.Quantity);
            if (totalStockQty > 0)
            {
                return BadRequest($"Неможливо видалити склад, оскільки на ньому обліковується {totalStockQty} од. товарів. Спочатку виконайте переміщення товарів на інший склад.");
            }

            _context.Warehouses.Remove(warehouse);
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Delete",
                entityType: "Warehouse",
                entityId: warehouse.Id.ToString(),
                entityName: warehouse.Name,
                details: $"Видалено склад '{warehouse.Name}' (Код: {warehouse.Code}).");

            return NoContent();
        }

        /// <summary>
        /// Отримання залишків товарів на конкретному складі
        /// </summary>
        [HttpGet("{id}/stocks")]
        public async Task<ActionResult<IEnumerable<WarehouseStockDto>>> GetWarehouseStocks(
            Guid id,
            [FromQuery] string? search = null)
        {
            var warehouse = await _context.Warehouses.FindAsync(id);
            if (warehouse == null)
            {
                return NotFound("Склад не знайдено");
            }

            var query = _context.WarehouseStocks
                .AsNoTracking()
                .Include(s => s.Product!)
                    .ThenInclude(p => p.Category)
                .Where(s => s.WarehouseId == id);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(x => x.Product != null && (x.Product.Name.ToLower().Contains(s) || x.Product.SKU.ToLower().Contains(s)));
            }

            var stocks = await query
                .OrderByDescending(s => s.Quantity)
                .ThenBy(s => s.Product != null ? s.Product.Name : "")
                .Select(s => new WarehouseStockDto
                {
                    Id = s.Id,
                    WarehouseId = s.WarehouseId,
                    WarehouseName = warehouse.Name,
                    ProductId = s.ProductId,
                    ProductName = s.Product != null ? s.Product.Name : "Товар",
                    ProductSKU = s.Product != null ? s.Product.SKU : "",
                    CategoryName = s.Product != null && s.Product.Category != null ? s.Product.Category.Name : "Без категорії",
                    Unit = s.Product != null ? s.Product.Unit : "шт",
                    UnitPrice = s.Product != null ? s.Product.Price : 0,
                    Quantity = s.Quantity,
                    MinStock = s.MinStock,
                    LocationZone = s.LocationZone,
                    LastUpdated = s.LastUpdated
                })
                .ToListAsync();

            return Ok(stocks);
        }

        /// <summary>
        /// Оновлення комірки зберігання (LocationZone) та страхового запасу товару на складі
        /// </summary>
        [HttpPut("stocks/{stockId}/location")]
        public async Task<IActionResult> UpdateStockLocation(Guid stockId, [FromBody] UpdateWarehouseStockLocationDto dto)
        {
            var stock = await _context.WarehouseStocks.FindAsync(stockId);
            if (stock == null)
            {
                return NotFound("Запис складського залишку не знайдено");
            }

            stock.LocationZone = dto.LocationZone?.Trim();
            if (dto.MinStock.HasValue)
            {
                stock.MinStock = dto.MinStock.Value;
            }
            stock.LastUpdated = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok();
        }

        /// <summary>
        /// Оприбуткування, списання або коригування залишку товару на конкретному складі
        /// </summary>
        [HttpPost("{id}/stocks/adjust")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<WarehouseStockDto>> AdjustStock(Guid id, [FromBody] AdjustWarehouseStockDto dto)
        {
            var warehouse = await _context.Warehouses.FindAsync(id);
            if (warehouse == null || !warehouse.IsActive)
            {
                return NotFound("Склад не знайдено або він деактивований");
            }

            var product = await _context.Products.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == dto.ProductId);
            if (product == null)
            {
                return NotFound("Товар не знайдено");
            }

            var stock = await _context.WarehouseStocks
                .FirstOrDefaultAsync(s => s.WarehouseId == id && s.ProductId == dto.ProductId);

            int oldStockQty = stock?.Quantity ?? 0;
            int newStockQty = dto.IsDelta ? (oldStockQty + dto.Quantity) : dto.Quantity;

            if (newStockQty < 0)
            {
                return BadRequest($"Залишок не може бути меншим за 0. Поточний: {oldStockQty}, коригування: {dto.Quantity}");
            }

            int delta = newStockQty - oldStockQty;

            if (stock == null)
            {
                stock = new WarehouseStock
                {
                    Id = Guid.NewGuid(),
                    WarehouseId = id,
                    ProductId = dto.ProductId,
                    Quantity = newStockQty,
                    MinStock = dto.MinStock ?? product.MinStock,
                    LocationZone = dto.LocationZone?.Trim(),
                    LastUpdated = DateTime.UtcNow
                };
                _context.WarehouseStocks.Add(stock);
            }
            else
            {
                stock.Quantity = newStockQty;
                if (!string.IsNullOrWhiteSpace(dto.LocationZone))
                {
                    stock.LocationZone = dto.LocationZone.Trim();
                }
                if (dto.MinStock.HasValue)
                {
                    stock.MinStock = dto.MinStock.Value;
                }
                stock.LastUpdated = DateTime.UtcNow;
            }

            // Оновлюємо сумарну кількість товару по системі
            product.Quantity = Math.Max(0, product.Quantity + delta);

            // Фіксуємо рух товару при зміні залишку
            if (delta != 0)
            {
                var userName = GetCurrentUserName();
                var movement = new StockMovement
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    WarehouseId = id,
                    Quantity = Math.Abs(delta),
                    Type = delta > 0 ? MovementType.In : MovementType.Out,
                    MovementDate = DateTime.UtcNow,
                    Note = !string.IsNullOrWhiteSpace(dto.Reason) 
                        ? dto.Reason.Trim() 
                        : (delta > 0 ? $"Оприбуткування на склад '{warehouse.Name}'" : $"Списання зі складу '{warehouse.Name}'")
                };
                _context.StockMovements.Add(movement);

                _context.ProductHistories.Add(new ProductHistory
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    Change = delta,
                    StockAfter = product.Quantity,
                    Note = movement.Note,
                    UserName = userName,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "AdjustStock",
                entityType: "WarehouseStock",
                entityId: stock.Id.ToString(),
                entityName: $"{product.Name} @ {warehouse.Name}",
                details: $"Коригування залишку товару '{product.Name}' на складі '{warehouse.Name}': було {oldStockQty}, стало {newStockQty} (дельта: {delta})",
                oldValues: $"{oldStockQty}",
                newValues: $"{newStockQty}"
            );

            await _notifier.NotifyGeneralAsync(
                title: "Залишок оновлено",
                message: $"{product.Name} на складі '{warehouse.Name}': {newStockQty} {product.Unit}",
                severity: "info");

            return Ok(new WarehouseStockDto
            {
                Id = stock.Id,
                WarehouseId = id,
                WarehouseName = warehouse.Name,
                ProductId = product.Id,
                ProductName = product.Name,
                ProductSKU = product.SKU,
                CategoryName = product.Category != null ? product.Category.Name : "Без категорії",
                Unit = product.Unit,
                UnitPrice = product.Price,
                Quantity = stock.Quantity,
                MinStock = stock.MinStock,
                LocationZone = stock.LocationZone,
                LastUpdated = stock.LastUpdated
            });
        }

        /// <summary>
        /// Зведена матриця розподілу всіх товарів за складами
        /// </summary>
        [HttpGet("distribution")]
        public async Task<ActionResult<IEnumerable<ProductStockDistributionDto>>> GetProductDistribution(
            [FromQuery] Guid? categoryId = null,
            [FromQuery] string? search = null)
        {
            var productsQuery = _context.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .AsQueryable();

            if (categoryId.HasValue && categoryId.Value != Guid.Empty)
            {
                productsQuery = productsQuery.Where(p => p.CategoryId == categoryId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                productsQuery = productsQuery.Where(p => p.Name.ToLower().Contains(s) || p.SKU.ToLower().Contains(s));
            }

            var products = await productsQuery.OrderBy(p => p.Name).ToListAsync();
            var productIds = products.Select(p => p.Id).ToList();

            var allStocks = await _context.WarehouseStocks
                .AsNoTracking()
                .Include(s => s.Warehouse)
                .Where(s => productIds.Contains(s.ProductId) && s.Warehouse != null && s.Warehouse.IsActive)
                .ToListAsync();

            var stocksByProduct = allStocks.GroupBy(s => s.ProductId).ToDictionary(g => g.Key, g => g.ToList());

            var result = products.Select(p =>
            {
                stocksByProduct.TryGetValue(p.Id, out var itemStocks);
                var warehouseList = (itemStocks ?? new List<WarehouseStock>())
                    .Select(s => new WarehouseStockItemDto
                    {
                        StockId = s.Id,
                        WarehouseId = s.WarehouseId,
                        WarehouseName = s.Warehouse != null ? s.Warehouse.Name : "Склад",
                        WarehouseCode = s.Warehouse != null ? s.Warehouse.Code : "",
                        Quantity = s.Quantity,
                        MinStock = s.MinStock,
                        LocationZone = s.LocationZone
                    })
                    .ToList();

                return new ProductStockDistributionDto
                {
                    ProductId = p.Id,
                    ProductName = p.Name,
                    SKU = p.SKU,
                    CategoryName = p.Category != null ? p.Category.Name : "Без категорії",
                    Unit = p.Unit,
                    Price = p.Price,
                    TotalQuantity = p.Quantity,
                    Warehouses = warehouseList
                };
            }).ToList();

            return Ok(result);
        }

        // =========================================================================
        // ПЕРЕМІЩЕННЯ МІЖ СКЛАДАМИ (WAREHOUSE TRANSFERS)
        // =========================================================================

        /// <summary>
        /// Отримання списку переміщень між складами
        /// </summary>
        [HttpGet("transfers")]
        public async Task<ActionResult<IEnumerable<WarehouseTransferDto>>> GetTransfers(
            [FromQuery] TransferStatus? status = null,
            [FromQuery] Guid? warehouseId = null,
            [FromQuery] string? search = null)
        {
            var query = _context.WarehouseTransfers
                .AsNoTracking()
                .Include(t => t.FromWarehouse)
                .Include(t => t.ToWarehouse)
                .Include(t => t.Items)
                    .ThenInclude(i => i.Product)
                .AsQueryable();

            if (status.HasValue)
            {
                query = query.Where(t => t.Status == status.Value);
            }

            if (warehouseId.HasValue && warehouseId.Value != Guid.Empty)
            {
                query = query.Where(t => t.FromWarehouseId == warehouseId.Value || t.ToWarehouseId == warehouseId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(t => t.TransferNumber.ToLower().Contains(s) || 
                                         (t.Notes != null && t.Notes.ToLower().Contains(s)));
            }

            var transfers = await query
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => new WarehouseTransferDto
                {
                    Id = t.Id,
                    TransferNumber = t.TransferNumber,
                    FromWarehouseId = t.FromWarehouseId,
                    FromWarehouseName = t.FromWarehouse != null ? t.FromWarehouse.Name : "",
                    ToWarehouseId = t.ToWarehouseId,
                    ToWarehouseName = t.ToWarehouse != null ? t.ToWarehouse.Name : "",
                    CreatedAt = t.CreatedAt,
                    CompletedAt = t.CompletedAt,
                    CreatedByUserName = t.CreatedByUserName,
                    Status = t.Status,
                    Notes = t.Notes,
                    TotalItemsCount = t.TotalItemsCount,
                    TotalQuantity = t.TotalQuantity,
                    Items = t.Items.Select(i => new WarehouseTransferItemDto
                    {
                        Id = i.Id,
                        WarehouseTransferId = i.WarehouseTransferId,
                        ProductId = i.ProductId,
                        ProductName = i.Product != null ? i.Product.Name : "Товар",
                        ProductSKU = i.Product != null ? i.Product.SKU : "",
                        Unit = i.Product != null ? i.Product.Unit : "шт",
                        UnitPrice = i.Product != null ? i.Product.Price : 0,
                        Quantity = i.Quantity,
                        Notes = i.Notes
                    }).ToList()
                })
                .ToListAsync();

            return Ok(transfers);
        }

        /// <summary>
        /// Отримання деталей конкретного переміщення
        /// </summary>
        [HttpGet("transfers/{id}")]
        public async Task<ActionResult<WarehouseTransferDto>> GetTransferById(Guid id)
        {
            var dto = await LoadTransferDtoAsync(id);
            if (dto == null)
            {
                return NotFound("Документ переміщення не знайдено");
            }

            return Ok(dto);
        }

        private async Task<WarehouseTransferDto?> LoadTransferDtoAsync(Guid id)
        {
            var t = await _context.WarehouseTransfers
                .AsNoTracking()
                .Include(x => x.FromWarehouse)
                .Include(x => x.ToWarehouse)
                .Include(x => x.Items)
                    .ThenInclude(i => i.Product)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (t == null)
            {
                return null;
            }

            return new WarehouseTransferDto
            {
                Id = t.Id,
                TransferNumber = t.TransferNumber,
                FromWarehouseId = t.FromWarehouseId,
                FromWarehouseName = t.FromWarehouse != null ? t.FromWarehouse.Name : "",
                ToWarehouseId = t.ToWarehouseId,
                ToWarehouseName = t.ToWarehouse != null ? t.ToWarehouse.Name : "",
                CreatedAt = t.CreatedAt,
                CompletedAt = t.CompletedAt,
                CreatedByUserName = t.CreatedByUserName,
                Status = t.Status,
                Notes = t.Notes,
                TotalItemsCount = t.TotalItemsCount,
                TotalQuantity = t.TotalQuantity,
                Items = t.Items.Select(i => new WarehouseTransferItemDto
                {
                    Id = i.Id,
                    WarehouseTransferId = i.WarehouseTransferId,
                    ProductId = i.ProductId,
                    ProductName = i.Product != null ? i.Product.Name : "Товар",
                    ProductSKU = i.Product != null ? i.Product.SKU : "",
                    Unit = i.Product != null ? i.Product.Unit : "шт",
                    UnitPrice = i.Product != null ? i.Product.Price : 0,
                    Quantity = i.Quantity,
                    Notes = i.Notes
                }).ToList()
            };
        }

        /// <summary>
        /// Створення переміщення між складами
        /// </summary>
        [HttpPost("transfers")]
        public async Task<ActionResult<WarehouseTransferDto>> CreateTransfer([FromBody] CreateWarehouseTransferDto dto)
        {
            if (dto.FromWarehouseId == dto.ToWarehouseId)
            {
                return BadRequest("Склад-відправник та склад-одержувач не можуть бути однаковими");
            }

            var fromWh = await _context.Warehouses.FindAsync(dto.FromWarehouseId);
            var toWh = await _context.Warehouses.FindAsync(dto.ToWarehouseId);
            if (fromWh == null || toWh == null)
            {
                return BadRequest("Один або обидва обрані склади не існують");
            }

            if (!fromWh.IsActive || !toWh.IsActive)
            {
                return BadRequest("Неможливо виконати переміщення для неактивного складу");
            }

            if (dto.Items == null || !dto.Items.Any())
            {
                return BadRequest("Додайте щонайменше один товар для переміщення");
            }

            var now = DateTime.UtcNow;
            var userName = GetCurrentUserName();
            var transferNumber = await GenerateTransferNumberAsync();

            var transfer = new WarehouseTransfer
            {
                Id = Guid.NewGuid(),
                TransferNumber = transferNumber,
                FromWarehouseId = dto.FromWarehouseId,
                ToWarehouseId = dto.ToWarehouseId,
                CreatedAt = now,
                CreatedByUserName = userName,
                Status = dto.CompleteImmediately ? TransferStatus.Completed : TransferStatus.InTransit,
                CompletedAt = dto.CompleteImmediately ? now : null,
                Notes = dto.Notes?.Trim()
            };

            int totalQuantity = 0;

            // Перевіряємо та обробляємо кожну позицію
            foreach (var itemDto in dto.Items)
            {
                if (itemDto.Quantity <= 0)
                {
                    return BadRequest("Кількість для переміщення повинна бути більшою за 0");
                }

                var product = await _context.Products.FindAsync(itemDto.ProductId);
                if (product == null)
                {
                    return BadRequest($"Товар з ID {itemDto.ProductId} не знайдено");
                }

                // Перевіряємо наявність залишку на складі-відправнику
                var sourceStock = await _context.WarehouseStocks
                    .FirstOrDefaultAsync(s => s.WarehouseId == dto.FromWarehouseId && s.ProductId == itemDto.ProductId);

                if (sourceStock == null || sourceStock.Quantity < itemDto.Quantity)
                {
                    var available = sourceStock?.Quantity ?? 0;
                    return BadRequest($"Недостатньо товару '{product.Name}' на складі '{fromWh.Name}'. Доступно: {available} шт., запитано: {itemDto.Quantity} шт.");
                }

                // 1. Списуємо зі складу відправника
                sourceStock.Quantity -= itemDto.Quantity;
                sourceStock.LastUpdated = now;

                // 2. Якщо переміщення миттєве, відразу зараховуємо на склад-одержувач
                if (dto.CompleteImmediately)
                {
                    var targetStock = await _context.WarehouseStocks
                        .FirstOrDefaultAsync(s => s.WarehouseId == dto.ToWarehouseId && s.ProductId == itemDto.ProductId);

                    if (targetStock == null)
                    {
                        targetStock = new WarehouseStock
                        {
                            Id = Guid.NewGuid(),
                            WarehouseId = dto.ToWarehouseId,
                            ProductId = itemDto.ProductId,
                            Quantity = itemDto.Quantity,
                            LocationZone = "Зона прийому",
                            LastUpdated = now
                        };
                        _context.WarehouseStocks.Add(targetStock);
                    }
                    else
                    {
                        targetStock.Quantity += itemDto.Quantity;
                        targetStock.LastUpdated = now;
                    }

                    // Створюємо рух товару Transfer
                    _context.StockMovements.Add(new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        ProductId = product.Id,
                        Type = MovementType.Transfer,
                        Quantity = itemDto.Quantity,
                        WarehouseId = dto.FromWarehouseId,
                        ToWarehouseId = dto.ToWarehouseId,
                        Note = $"Переміщення №{transferNumber} ({fromWh.Name} -> {toWh.Name})",
                        MovementDate = now
                    });

                    // Історія товару
                    _context.ProductHistories.Add(new ProductHistory
                    {
                        Id = Guid.NewGuid(),
                        ProductId = product.Id,
                        Change = 0, // Загальний залишок по системі не змінюється
                        StockAfter = product.Quantity,
                        Note = $"Переміщення {itemDto.Quantity} шт. ({fromWh.Name} -> {toWh.Name})",
                        UserName = userName,
                        CreatedAt = now
                    });
                }
                else
                {
                    // Товар відправлено в дорогу
                    _context.StockMovements.Add(new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        ProductId = product.Id,
                        Type = MovementType.Transfer,
                        Quantity = itemDto.Quantity,
                        WarehouseId = dto.FromWarehouseId,
                        ToWarehouseId = dto.ToWarehouseId,
                        Note = $"Відправка в дорогу за переміщенням №{transferNumber} ({fromWh.Name} -> {toWh.Name})",
                        MovementDate = now
                    });
                }

                transfer.Items.Add(new WarehouseTransferItem
                {
                    Id = Guid.NewGuid(),
                    WarehouseTransferId = transfer.Id,
                    ProductId = itemDto.ProductId,
                    Quantity = itemDto.Quantity,
                    Notes = itemDto.Notes?.Trim()
                });

                totalQuantity += itemDto.Quantity;
            }

            transfer.TotalItemsCount = transfer.Items.Count;
            transfer.TotalQuantity = totalQuantity;

            _context.WarehouseTransfers.Add(transfer);
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "StockTransfer",
                entityType: "WarehouseTransfer",
                entityId: transfer.Id.ToString(),
                entityName: transfer.TransferNumber,
                details: $"Створено документ переміщення {transfer.TransferNumber} ({fromWh.Name} -> {toWh.Name}) на {totalQuantity} од. Статус: {transfer.Status}.");

            await _notifier.NotifyGeneralAsync(
                title: dto.CompleteImmediately ? "Переміщення виконано" : "Товари в дорозі",
                message: $"Переміщення {transfer.TransferNumber} ({fromWh.Name} -> {toWh.Name}): {totalQuantity} од.",
                severity: "info");

            var createdDto = await LoadTransferDtoAsync(transfer.Id);
            return CreatedAtAction(nameof(GetTransferById), new { id = transfer.Id }, createdDto);
        }

        /// <summary>
        /// Приймання товарів на складі-одержувачі (InTransit -> Completed)
        /// </summary>
        [HttpPost("transfers/{id}/receive")]
        public async Task<ActionResult<WarehouseTransferDto>> ReceiveTransfer(Guid id)
        {
            var transfer = await _context.WarehouseTransfers
                .Include(t => t.Items)
                    .ThenInclude(i => i.Product)
                .Include(t => t.FromWarehouse)
                .Include(t => t.ToWarehouse)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transfer == null)
            {
                return NotFound("Документ переміщення не знайдено");
            }

            if (transfer.Status != TransferStatus.InTransit)
            {
                return BadRequest($"Неможливо прийняти переміщення у статусі '{transfer.Status}'. Дозволено лише для 'InTransit' (В дорозі).");
            }

            var now = DateTime.UtcNow;
            var userName = GetCurrentUserName();

            foreach (var item in transfer.Items)
            {
                var targetStock = await _context.WarehouseStocks
                    .FirstOrDefaultAsync(s => s.WarehouseId == transfer.ToWarehouseId && s.ProductId == item.ProductId);

                if (targetStock == null)
                {
                    targetStock = new WarehouseStock
                    {
                        Id = Guid.NewGuid(),
                        WarehouseId = transfer.ToWarehouseId,
                        ProductId = item.ProductId,
                        Quantity = item.Quantity,
                        LocationZone = "Зона прийому",
                        LastUpdated = now
                    };
                    _context.WarehouseStocks.Add(targetStock);
                }
                else
                {
                    targetStock.Quantity += item.Quantity;
                    targetStock.LastUpdated = now;
                }

                // Історія товару
                _context.ProductHistories.Add(new ProductHistory
                {
                    Id = Guid.NewGuid(),
                    ProductId = item.ProductId,
                    Change = 0,
                    StockAfter = item.Product != null ? item.Product.Quantity : 0,
                    Note = $"Прийнято на складі '{transfer.ToWarehouse?.Name}' за №{transfer.TransferNumber}",
                    UserName = userName,
                    CreatedAt = now
                });
            }

            transfer.Status = TransferStatus.Completed;
            transfer.CompletedAt = now;

            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "StockTransfer",
                entityType: "WarehouseTransfer",
                entityId: transfer.Id.ToString(),
                entityName: transfer.TransferNumber,
                details: $"Прийнято переміщення {transfer.TransferNumber} на складі '{transfer.ToWarehouse?.Name}'.");

            await _notifier.NotifyGeneralAsync(
                title: "Переміщення прийнято",
                message: $"Вантаж за документом {transfer.TransferNumber} успішно надійшов на склад {transfer.ToWarehouse?.Name}.",
                severity: "success");

            var receivedDto = await LoadTransferDtoAsync(id);
            return Ok(receivedDto);
        }

        /// <summary>
        /// Скасування переміщення (повертає товари на склад відправника, якщо вони були в дорозі)
        /// </summary>
        [HttpPost("transfers/{id}/cancel")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<WarehouseTransferDto>> CancelTransfer(Guid id, [FromQuery] string? reason = null)
        {
            var transfer = await _context.WarehouseTransfers
                .Include(t => t.Items)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transfer == null)
            {
                return NotFound("Документ переміщення не знайдено");
            }

            if (transfer.Status == TransferStatus.Completed)
            {
                return BadRequest("Неможливо скасувати вже завершене переміщення");
            }

            if (transfer.Status == TransferStatus.Cancelled)
            {
                return BadRequest("Це переміщення вже було скасоване");
            }

            // Якщо товари були відправлені в дорогу (InTransit), повертаємо їх на баланс складу-відправника
            if (transfer.Status == TransferStatus.InTransit)
            {
                var now = DateTime.UtcNow;
                foreach (var item in transfer.Items)
                {
                    var sourceStock = await _context.WarehouseStocks
                        .FirstOrDefaultAsync(s => s.WarehouseId == transfer.FromWarehouseId && s.ProductId == item.ProductId);

                    if (sourceStock != null)
                    {
                        sourceStock.Quantity += item.Quantity;
                        sourceStock.LastUpdated = now;
                    }
                }
            }

            transfer.Status = TransferStatus.Cancelled;
            if (!string.IsNullOrWhiteSpace(reason))
            {
                transfer.Notes = string.IsNullOrWhiteSpace(transfer.Notes) 
                    ? $"Скасовано: {reason}" 
                    : $"{transfer.Notes} | Скасовано: {reason}";
            }

            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Cancel",
                entityType: "WarehouseTransfer",
                entityId: transfer.Id.ToString(),
                entityName: transfer.TransferNumber,
                details: $"Переміщення {transfer.TransferNumber} скасовано. {(string.IsNullOrWhiteSpace(reason) ? "" : $"Причина: {reason}")}");

            var receivedDto = await LoadTransferDtoAsync(id);
            return Ok(receivedDto);
        }
    }
}
