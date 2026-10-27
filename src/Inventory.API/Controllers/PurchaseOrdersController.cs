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
    public class PurchaseOrdersController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IInventoryNotifier _notifier;
        private readonly IAuditService _auditService;

        public PurchaseOrdersController(
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
                ?? "Менеджер";
        }

        private async Task<string> GenerateOrderNumberAsync()
        {
            var today = DateTime.UtcNow.ToString("yyyyMMdd");
            var prefix = $"PO-{today}-";
            
            var lastOrder = await _context.PurchaseOrders
                .Where(o => o.OrderNumber.StartsWith(prefix))
                .OrderByDescending(o => o.OrderNumber)
                .Select(o => o.OrderNumber)
                .FirstOrDefaultAsync();

            int nextNum = 1;
            if (lastOrder != null && lastOrder.Length >= prefix.Length + 3)
            {
                var numPart = lastOrder.Substring(prefix.Length);
                if (int.TryParse(numPart, out int parsed))
                {
                    nextNum = parsed + 1;
                }
            }

            return $"{prefix}{nextNum:D3}";
        }

        /// <summary>
        /// Отримання списку замовлень на закупівлю з фільтрами
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PurchaseOrderSummaryDto>>> GetAll(
            [FromQuery] PurchaseOrderStatus? status = null,
            [FromQuery] Guid? supplierId = null,
            [FromQuery] string? search = null)
        {
            var query = _context.PurchaseOrders
                .AsNoTracking()
                .Include(o => o.Supplier)
                .AsQueryable();

            if (status.HasValue)
            {
                query = query.Where(o => o.Status == status.Value);
            }

            if (supplierId.HasValue && supplierId.Value != Guid.Empty)
            {
                query = query.Where(o => o.SupplierId == supplierId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(o => o.OrderNumber.ToLower().Contains(s) 
                                      || o.Title.ToLower().Contains(s)
                                      || (o.Supplier != null && o.Supplier.Name.ToLower().Contains(s)));
            }

            var orders = await query
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new PurchaseOrderSummaryDto
                {
                    Id = o.Id,
                    OrderNumber = o.OrderNumber,
                    Title = o.Title,
                    SupplierId = o.SupplierId,
                    SupplierName = o.Supplier != null ? o.Supplier.Name : string.Empty,
                    CreatedAt = o.CreatedAt,
                    ExpectedDeliveryDate = o.ExpectedDeliveryDate,
                    ApprovedAt = o.ApprovedAt,
                    CompletedAt = o.CompletedAt,
                    CreatedByUserName = o.CreatedByUserName,
                    ApprovedByUserName = o.ApprovedByUserName,
                    Status = o.Status,
                    TotalAmount = o.TotalAmount,
                    TotalItemsCount = o.TotalItemsCount,
                    TotalOrderedQuantity = o.TotalOrderedQuantity,
                    TotalReceivedQuantity = o.TotalReceivedQuantity,
                    Notes = o.Notes
                })
                .ToListAsync();

            return Ok(orders);
        }

        /// <summary>
        /// Отримання деталей замовлення на закупівлю за Id
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<PurchaseOrderDetailDto>> GetById(Guid id)
        {
            var dto = await LoadOrderDetailDtoAsync(id);
            if (dto == null)
            {
                return NotFound("Замовлення на закупівлю не знайдено");
            }

            return Ok(dto);
        }

        private async Task<PurchaseOrderDetailDto?> LoadOrderDetailDtoAsync(Guid id)
        {
            var order = await _context.PurchaseOrders
                .AsNoTracking()
                .Include(o => o.Supplier)
                .Include(o => o.Items)
                    .ThenInclude(i => i.Product!)
                        .ThenInclude(p => p.Category)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return null;
            }

            return new PurchaseOrderDetailDto
            {
                Id = order.Id,
                OrderNumber = order.OrderNumber,
                Title = order.Title,
                SupplierId = order.SupplierId,
                SupplierName = order.Supplier != null ? order.Supplier.Name : string.Empty,
                CreatedAt = order.CreatedAt,
                ExpectedDeliveryDate = order.ExpectedDeliveryDate,
                ApprovedAt = order.ApprovedAt,
                CompletedAt = order.CompletedAt,
                CreatedByUserName = order.CreatedByUserName,
                ApprovedByUserName = order.ApprovedByUserName,
                Status = order.Status,
                TotalAmount = order.TotalAmount,
                TotalItemsCount = order.TotalItemsCount,
                TotalOrderedQuantity = order.TotalOrderedQuantity,
                TotalReceivedQuantity = order.TotalReceivedQuantity,
                Notes = order.Notes,
                Items = order.Items.Select(i => new PurchaseOrderItemDto
                {
                    Id = i.Id,
                    PurchaseOrderId = i.PurchaseOrderId,
                    ProductId = i.ProductId,
                    ProductName = i.Product != null ? i.Product.Name : "Товар",
                    ProductSKU = i.Product != null ? i.Product.SKU : string.Empty,
                    CategoryName = i.Product?.Category?.Name ?? "Без категорії",
                    Unit = i.Product != null ? i.Product.Unit : "шт",
                    OrderedQuantity = i.OrderedQuantity,
                    ReceivedQuantity = i.ReceivedQuantity,
                    UnitPrice = i.UnitPrice,
                    TotalCost = i.TotalCost,
                    Notes = i.Notes
                }).ToList()
            };
        }

        /// <summary>
        /// Створення нового замовлення на закупівлю (статус Чернетка)
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<PurchaseOrderDetailDto>> Create([FromBody] CreatePurchaseOrderDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title))
            {
                return BadRequest("Вкажіть назву або призначення замовлення");
            }

            var supplier = await _context.Suppliers.FindAsync(dto.SupplierId);
            if (supplier == null)
            {
                return BadRequest("Обраного постачальника не знайдено");
            }

            if (dto.Items == null || !dto.Items.Any())
            {
                return BadRequest("Замовлення повинно містити щонайменше один товар");
            }

            var productIds = dto.Items.Select(i => i.ProductId).Distinct().ToList();
            var existingProducts = await _context.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();
            if (existingProducts.Count != productIds.Count)
            {
                return BadRequest("Один або декілька обраних товарів не існують в системі");
            }

            var orderNumber = await GenerateOrderNumberAsync();
            var order = new PurchaseOrder
            {
                Id = Guid.NewGuid(),
                OrderNumber = orderNumber,
                Title = dto.Title.Trim(),
                SupplierId = dto.SupplierId,
                CreatedAt = DateTime.UtcNow,
                ExpectedDeliveryDate = dto.ExpectedDeliveryDate,
                CreatedByUserName = GetCurrentUserName(),
                Status = PurchaseOrderStatus.Draft,
                Notes = dto.Notes
            };

            decimal totalAmount = 0;
            int totalOrderedQuantity = 0;

            foreach (var itemDto in dto.Items)
            {
                if (itemDto.OrderedQuantity <= 0)
                {
                    return BadRequest("Кількість замовленого товару повинна бути більшою за 0");
                }

                var itemCost = Math.Round(itemDto.OrderedQuantity * itemDto.UnitPrice, 2);
                totalAmount += itemCost;
                totalOrderedQuantity += itemDto.OrderedQuantity;

                var item = new PurchaseOrderItem
                {
                    Id = Guid.NewGuid(),
                    PurchaseOrderId = order.Id,
                    ProductId = itemDto.ProductId,
                    OrderedQuantity = itemDto.OrderedQuantity,
                    ReceivedQuantity = 0,
                    UnitPrice = itemDto.UnitPrice,
                    TotalCost = itemCost,
                    Notes = itemDto.Notes
                };
                order.Items.Add(item);
            }

            order.TotalAmount = totalAmount;
            order.TotalItemsCount = order.Items.Count;
            order.TotalOrderedQuantity = totalOrderedQuantity;
            order.TotalReceivedQuantity = 0;

            _context.PurchaseOrders.Add(order);
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Create",
                entityType: "PurchaseOrder",
                entityId: order.Id.ToString(),
                entityName: order.OrderNumber,
                details: $"Створено замовлення на закупівлю {order.OrderNumber} ({order.Title}) у постачальника {supplier.Name} на суму {order.TotalAmount:N2} грн.");

            var createdDto = await LoadOrderDetailDtoAsync(order.Id);
            return CreatedAtAction(nameof(GetById), new { id = order.Id }, createdDto);
        }

        /// <summary>
        /// Редагування замовлення на закупівлю (тільки для статусів Draft або PendingApproval)
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult<PurchaseOrderDetailDto>> Update(Guid id, [FromBody] UpdatePurchaseOrderDto dto)
        {
            var order = await _context.PurchaseOrders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return NotFound("Замовлення на закупівлю не знайдено");
            }

            if (order.Status != PurchaseOrderStatus.Draft && order.Status != PurchaseOrderStatus.PendingApproval)
            {
                return BadRequest("Редагування дозволено тільки для чернеток або замовлень на погодженні");
            }

            var supplier = await _context.Suppliers.FindAsync(dto.SupplierId);
            if (supplier == null)
            {
                return BadRequest("Обраного постачальника не знайдено");
            }

            if (dto.Items == null || !dto.Items.Any())
            {
                return BadRequest("Замовлення повинно містити щонайменше один товар");
            }

            var productIds = dto.Items.Select(i => i.ProductId).Distinct().ToList();
            var existingProducts = await _context.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();
            if (existingProducts.Count != productIds.Count)
            {
                return BadRequest("Один або декілька обраних товарів не існують в системі");
            }

            order.Title = dto.Title.Trim();
            order.SupplierId = dto.SupplierId;
            order.ExpectedDeliveryDate = dto.ExpectedDeliveryDate;
            order.Notes = dto.Notes;

            // Видаляємо старі позиції та додаємо нові
            _context.PurchaseOrderItems.RemoveRange(order.Items);
            order.Items.Clear();

            decimal totalAmount = 0;
            int totalOrderedQuantity = 0;

            foreach (var itemDto in dto.Items)
            {
                if (itemDto.OrderedQuantity <= 0)
                {
                    return BadRequest("Кількість замовленого товару повинна бути більшою за 0");
                }

                var itemCost = Math.Round(itemDto.OrderedQuantity * itemDto.UnitPrice, 2);
                totalAmount += itemCost;
                totalOrderedQuantity += itemDto.OrderedQuantity;

                var item = new PurchaseOrderItem
                {
                    Id = Guid.NewGuid(),
                    PurchaseOrderId = order.Id,
                    ProductId = itemDto.ProductId,
                    OrderedQuantity = itemDto.OrderedQuantity,
                    ReceivedQuantity = 0,
                    UnitPrice = itemDto.UnitPrice,
                    TotalCost = itemCost,
                    Notes = itemDto.Notes
                };
                order.Items.Add(item);
            }

            order.TotalAmount = totalAmount;
            order.TotalItemsCount = order.Items.Count;
            order.TotalOrderedQuantity = totalOrderedQuantity;
            order.TotalReceivedQuantity = 0;

            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Update",
                entityType: "PurchaseOrder",
                entityId: order.Id.ToString(),
                entityName: order.OrderNumber,
                details: $"Оновлено замовлення на закупівлю {order.OrderNumber} ({order.Title}). Нова сума: {order.TotalAmount:N2} грн.");

            var resultDto = await LoadOrderDetailDtoAsync(id);
            return Ok(resultDto);
        }

        /// <summary>
        /// Відправка чернетки замовлення на погодження (Draft -> PendingApproval)
        /// </summary>
        [HttpPost("{id}/submit")]
        public async Task<ActionResult<PurchaseOrderDetailDto>> SubmitForApproval(Guid id)
        {
            var order = await _context.PurchaseOrders.FindAsync(id);
            if (order == null)
            {
                return NotFound("Замовлення на закупівлю не знайдено");
            }

            if (order.Status != PurchaseOrderStatus.Draft)
            {
                return BadRequest("Відправити на погодження можна лише чернетку замовлення");
            }

            order.Status = PurchaseOrderStatus.PendingApproval;
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Update",
                entityType: "PurchaseOrder",
                entityId: order.Id.ToString(),
                entityName: order.OrderNumber,
                details: $"Замовлення {order.OrderNumber} передано на затвердження керівництву.");

            await _notifier.NotifyGeneralAsync(
                title: "Замовлення на погодженні",
                message: $"Замовлення {order.OrderNumber} передано на затвердження.",
                severity: "info");

            var resultDto = await LoadOrderDetailDtoAsync(id);
            return Ok(resultDto);
        }

        /// <summary>
        /// Затвердження замовлення керівником (PendingApproval / Draft -> Approved)
        /// </summary>
        [HttpPost("{id}/approve")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<PurchaseOrderDetailDto>> Approve(Guid id)
        {
            var order = await _context.PurchaseOrders.FindAsync(id);
            if (order == null)
            {
                return NotFound("Замовлення на закупівлю не знайдено");
            }

            if (order.Status != PurchaseOrderStatus.PendingApproval && order.Status != PurchaseOrderStatus.Draft)
            {
                return BadRequest("Затвердити можна лише замовлення у статусі 'Чернетка' або 'На погодженні'");
            }

            order.Status = PurchaseOrderStatus.Approved;
            order.ApprovedAt = DateTime.UtcNow;
            order.ApprovedByUserName = GetCurrentUserName();

            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Approve",
                entityType: "PurchaseOrder",
                entityId: order.Id.ToString(),
                entityName: order.OrderNumber,
                details: $"Замовлення {order.OrderNumber} затверджено користувачем {order.ApprovedByUserName}.");

            await _notifier.NotifyGeneralAsync(
                title: "Замовлення затверджено",
                message: $"Замовлення {order.OrderNumber} затверджено ({order.ApprovedByUserName}).",
                severity: "success");

            var resultDto = await LoadOrderDetailDtoAsync(id);
            return Ok(resultDto);
        }

        /// <summary>
        /// Відправка замовлення постачальнику (Approved -> Sent)
        /// </summary>
        [HttpPost("{id}/send")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<PurchaseOrderDetailDto>> SendToSupplier(Guid id)
        {
            var order = await _context.PurchaseOrders
                .Include(o => o.Supplier)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return NotFound("Замовлення на закупівлю не знайдено");
            }

            if (order.Status != PurchaseOrderStatus.Approved)
            {
                return BadRequest("Відправити постачальнику можна лише попередньо затверджене замовлення");
            }

            order.Status = PurchaseOrderStatus.Sent;
            await _context.SaveChangesAsync();

            var supplierName = order.Supplier != null ? order.Supplier.Name : "Постачальник";

            await _auditService.LogAsync(
                action: "Send",
                entityType: "PurchaseOrder",
                entityId: order.Id.ToString(),
                entityName: order.OrderNumber,
                details: $"Замовлення {order.OrderNumber} позначено як відправлене постачальнику '{supplierName}'. В дорозі.");

            await _notifier.NotifyGeneralAsync(
                title: "Замовлення в дорозі",
                message: $"Замовлення {order.OrderNumber} відправлено постачальнику {supplierName}.",
                severity: "info");

            var resultDto = await LoadOrderDetailDtoAsync(id);
            return Ok(resultDto);
        }

        /// <summary>
        /// Приймання товарів на склад за замовленням на закупівлю (Approved / Sent / PartiallyReceived)
        /// Автоматично оновлює залишки товарів, створює прибуткові рухи (StockMovement In), ProductHistory та фіксує аудит
        /// </summary>
        [HttpPost("{id}/receive")]
        [Authorize(Roles = "Admin,Manager,WarehouseWorker")]
        public async Task<ActionResult<PurchaseOrderDetailDto>> ReceiveItems(Guid id, [FromBody] ReceivePurchaseOrderItemsDto dto)
        {
            var order = await _context.PurchaseOrders
                .Include(o => o.Items)
                    .ThenInclude(i => i.Product)
                .Include(o => o.Supplier)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return NotFound("Замовлення на закупівлю не знайдено");
            }

            if (order.Status != PurchaseOrderStatus.Approved && 
                order.Status != PurchaseOrderStatus.Sent && 
                order.Status != PurchaseOrderStatus.PartiallyReceived)
            {
                return BadRequest($"Неможливо здійснити приймання для замовлення у статусі '{order.Status}'. Дозволено лише для Approved, Sent або PartiallyReceived.");
            }

            if (dto.Items == null || !dto.Items.Any())
            {
                return BadRequest("Вкажіть хоча б одну позицію для приймання");
            }

            var now = DateTime.UtcNow;
            var userName = GetCurrentUserName();
            int totalReceivedThisBatch = 0;
            var itemsDict = order.Items.ToDictionary(i => i.Id);

            foreach (var receiveInput in dto.Items)
            {
                if (receiveInput.QuantityToReceive <= 0)
                {
                    continue; // Пропускаємо позиції з нулем
                }

                if (!itemsDict.TryGetValue(receiveInput.ItemId, out var item))
                {
                    return BadRequest($"Позицію {receiveInput.ItemId} не знайдено в цьому замовленні");
                }

                var remainingAllowed = item.OrderedQuantity - item.ReceivedQuantity;
                if (receiveInput.QuantityToReceive > remainingAllowed)
                {
                    return BadRequest($"Кількість приймання ({receiveInput.QuantityToReceive}) перевищує залишок очікування ({remainingAllowed}) для товару {item.Product?.Name ?? item.ProductId.ToString()}");
                }

                var product = item.Product ?? await _context.Products.FindAsync(item.ProductId);
                if (product == null)
                {
                    return BadRequest($"Товар з ID {item.ProductId} не знайдено в системі");
                }

                // 1. Оновлюємо кількість у позиції замовлення
                item.ReceivedQuantity += receiveInput.QuantityToReceive;
                totalReceivedThisBatch += receiveInput.QuantityToReceive;

                // 2. Оновлюємо фактичний залишок товару на складі
                product.Quantity += receiveInput.QuantityToReceive;

                // 3. Додаємо запис про рух товару (StockMovement - Type: In)
                var receiptNote = $"Приймання за PO №{order.OrderNumber}";
                if (!string.IsNullOrWhiteSpace(dto.Notes))
                {
                    receiptNote += $" ({dto.Notes.Trim()})";
                }

                var movement = new StockMovement
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    Type = MovementType.In,
                    Quantity = receiveInput.QuantityToReceive,
                    Note = receiptNote,
                    MovementDate = now,
                    SupplierId = order.SupplierId
                };
                _context.StockMovements.Add(movement);

                // 4. Додаємо запис в історію продукту
                _context.ProductHistories.Add(new ProductHistory
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    Change = receiveInput.QuantityToReceive,
                    StockAfter = product.Quantity,
                    Note = receiptNote,
                    UserName = userName,
                    CreatedAt = now
                });

                // 5. Сповіщаємо підписників через SignalR
                await _notifier.NotifyProductChangeAsync(new ProductChangeEvent
                {
                    Action = "StockUpdated",
                    ProductId = product.Id,
                    ProductName = product.Name,
                    NewQuantity = product.Quantity,
                    Message = $"Замовлення {order.OrderNumber}: оприбутковано +{receiveInput.QuantityToReceive} шт. {product.Name}. Новий залишок: {product.Quantity} шт."
                });
            }

            if (totalReceivedThisBatch == 0)
            {
                return BadRequest("Кількість товарів для приймання повинна бути більшою за 0");
            }

            // Оновлюємо загальну кількість прийнятих товарів у замовленні
            order.TotalReceivedQuantity = order.Items.Sum(i => i.ReceivedQuantity);

            // Перевіряємо, чи всі позиції повністю прийняті
            bool isFullyReceived = order.Items.All(i => i.ReceivedQuantity >= i.OrderedQuantity);

            if (isFullyReceived)
            {
                order.Status = PurchaseOrderStatus.Completed;
                order.CompletedAt = now;
            }
            else
            {
                order.Status = PurchaseOrderStatus.PartiallyReceived;
            }

            await _context.SaveChangesAsync();

            // Аудит
            await _auditService.LogAsync(
                action: "StockOperation",
                entityType: "PurchaseOrder",
                entityId: order.Id.ToString(),
                entityName: order.OrderNumber,
                details: $"Оприбутковано {totalReceivedThisBatch} од. товарів за замовленням {order.OrderNumber}. Статус замовлення тепер: {order.Status}.");

            // SignalR сповіщення
            await _notifier.NotifyGeneralAsync(
                title: isFullyReceived ? "Замовлення повністю виконано" : "Товари частково прийнято",
                message: $"Замовлення {order.OrderNumber}: оприбутковано {totalReceivedThisBatch} од. Поточний статус: {(isFullyReceived ? "Виконано" : "Частково прийнято")}.",
                severity: "success");

            var resultDto = await LoadOrderDetailDtoAsync(id);
            return Ok(resultDto);
        }

        /// <summary>
        /// Скасування замовлення на закупівлю
        /// </summary>
        [HttpPost("{id}/cancel")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<PurchaseOrderDetailDto>> Cancel(Guid id, [FromQuery] string? reason = null)
        {
            var order = await _context.PurchaseOrders.FindAsync(id);
            if (order == null)
            {
                return NotFound("Замовлення на закупівлю не знайдено");
            }

            if (order.Status == PurchaseOrderStatus.Completed)
            {
                return BadRequest("Неможливо скасувати вже повністю виконане замовлення");
            }

            if (order.Status == PurchaseOrderStatus.Cancelled)
            {
                return BadRequest("Це замовлення вже було скасоване");
            }

            order.Status = PurchaseOrderStatus.Cancelled;
            if (!string.IsNullOrWhiteSpace(reason))
            {
                order.Notes = string.IsNullOrWhiteSpace(order.Notes) 
                    ? $"Причина скасування: {reason}" 
                    : $"{order.Notes} | Причина скасування: {reason}";
            }

            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Cancel",
                entityType: "PurchaseOrder",
                entityId: order.Id.ToString(),
                entityName: order.OrderNumber,
                details: $"Замовлення {order.OrderNumber} скасовано. {(string.IsNullOrWhiteSpace(reason) ? "" : $"Причина: {reason}")}");

            await _notifier.NotifyGeneralAsync(
                title: "Замовлення скасовано",
                message: $"Замовлення {order.OrderNumber} було скасовано.",
                severity: "warning");

            var resultDto = await LoadOrderDetailDtoAsync(id);
            return Ok(resultDto);
        }

        /// <summary>
        /// Видалення замовлення (дозволено лише для чернеток або скасованих замовлень)
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var order = await _context.PurchaseOrders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return NotFound("Замовлення на закупівлю не знайдено");
            }

            if (order.Status != PurchaseOrderStatus.Draft && order.Status != PurchaseOrderStatus.Cancelled)
            {
                return BadRequest("Видалити можна лише чернетку або скасоване замовлення");
            }

            _context.PurchaseOrders.Remove(order);
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                action: "Delete",
                entityType: "PurchaseOrder",
                entityId: order.Id.ToString(),
                entityName: order.OrderNumber,
                details: $"Видалено замовлення на закупівлю {order.OrderNumber}.");

            return NoContent();
        }
    }
}
