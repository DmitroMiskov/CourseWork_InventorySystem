using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Inventory.Application.Common.Interfaces;
using Inventory.API.Dtos;
using Inventory.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Manager")]
    public class ReportsController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public ReportsController(IApplicationDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Оборотно-сальдова відомість по товарах складу за обраний період
        /// </summary>
        [HttpGet("turnover-statement")]
        public async Task<ActionResult<TurnoverStatementDto>> GetTurnoverStatement(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] Guid? categoryId = null,
            [FromQuery] string? search = null)
        {
            var fromUtc = fromDate.HasValue
                ? DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc)
                : DateTime.UtcNow.Date.AddDays(-30);

            var toUtc = toDate.HasValue
                ? DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc)
                : DateTime.UtcNow;

            var productsQuery = _context.Products.AsNoTracking()
                .Include(p => p.Category)
                .AsQueryable();

            if (categoryId.HasValue)
            {
                productsQuery = productsQuery.Where(p => p.CategoryId == categoryId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                productsQuery = productsQuery.Where(p => p.Name.ToLower().Contains(s) || p.SKU.ToLower().Contains(s));
            }

            var products = await productsQuery.OrderBy(p => p.Name).ToListAsync();
            var productIds = products.Select(p => p.Id).ToList();

            var periodMovements = await _context.StockMovements.AsNoTracking()
                .Where(m => productIds.Contains(m.ProductId) && m.MovementDate >= fromUtc && m.MovementDate <= toUtc)
                .ToListAsync();

            var futureMovements = await _context.StockMovements.AsNoTracking()
                .Where(m => productIds.Contains(m.ProductId) && m.MovementDate > toUtc)
                .ToListAsync();

            var items = new List<TurnoverItemDto>();

            foreach (var p in products)
            {
                var pPeriodMovements = periodMovements.Where(m => m.ProductId == p.Id).ToList();
                var pFutureMovements = futureMovements.Where(m => m.ProductId == p.Id).ToList();

                var inPeriod = pPeriodMovements.Where(m => m.Type == MovementType.In).Sum(m => m.Quantity);
                var outPeriod = pPeriodMovements.Where(m => m.Type == MovementType.Out).Sum(m => m.Quantity);

                var inFuture = pFutureMovements.Where(m => m.Type == MovementType.In).Sum(m => m.Quantity);
                var outFuture = pFutureMovements.Where(m => m.Type == MovementType.Out).Sum(m => m.Quantity);

                // Відкочуємо за залишки на кінець обраного періоду
                var closingQty = p.Quantity - (inFuture - outFuture);
                var openingQty = closingQty - (inPeriod - outPeriod);

                items.Add(new TurnoverItemDto
                {
                    ProductId = p.Id,
                    ProductSKU = p.SKU,
                    ProductName = p.Name,
                    CategoryName = p.Category?.Name ?? "Без категорії",
                    Unit = string.IsNullOrWhiteSpace(p.Unit) ? "шт." : p.Unit,
                    UnitPrice = p.Price,
                    OpeningQuantity = openingQty,
                    OpeningAmount = openingQty * p.Price,
                    InflowQuantity = inPeriod,
                    InflowAmount = inPeriod * p.Price,
                    OutflowQuantity = outPeriod,
                    OutflowAmount = outPeriod * p.Price,
                    ClosingQuantity = closingQty,
                    ClosingAmount = closingQty * p.Price
                });
            }

            var result = new TurnoverStatementDto
            {
                FromDate = fromUtc,
                ToDate = toUtc,
                GeneratedAt = DateTime.UtcNow,
                TotalProductsCount = items.Count,
                TotalOpeningAmount = items.Sum(i => i.OpeningAmount),
                TotalInflowAmount = items.Sum(i => i.InflowAmount),
                TotalOutflowAmount = items.Sum(i => i.OutflowAmount),
                TotalClosingAmount = items.Sum(i => i.ClosingAmount),
                TotalInflowQuantity = items.Sum(i => i.InflowQuantity),
                TotalOutflowQuantity = items.Sum(i => i.OutflowQuantity),
                Items = items
            };

            return Ok(result);
        }

        /// <summary>
        /// Експорт оборотно-сальдової відомості у формат CSV (Excel сумісний)
        /// </summary>
        [HttpGet("turnover-statement/export-csv")]
        public async Task<IActionResult> ExportTurnoverCsv(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] Guid? categoryId = null)
        {
            var res = await GetTurnoverStatement(fromDate, toDate, categoryId);
            if (res.Result is not OkObjectResult okResult || okResult.Value is not TurnoverStatementDto data)
            {
                return BadRequest("Помилка генерації відомості");
            }

            var sb = new StringBuilder();
            sb.AppendLine($"ОБОРОТНО-САЛЬДОВА ВІДОМІСТЬ ПО СКЛАДУ");
            sb.AppendLine($"Період: {data.FromDate:yyyy-MM-dd} — {data.ToDate:yyyy-MM-dd}; Сформовано: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC");
            sb.AppendLine();
            sb.AppendLine("Артикул;Товар;Категорія;Ціна;Початковий (шт);Початковий (грн);Прихід (шт);Прихід (грн);Розхід (шт);Розхід (грн);Кінцевий (шт);Кінцевий (грн)");

            foreach (var item in data.Items)
            {
                var sku = item.ProductSKU;
                var name = item.ProductName.Replace(";", " ");
                var cat = item.CategoryName.Replace(";", " ");
                var price = item.UnitPrice.ToString("F2");

                sb.AppendLine($"{sku};\"{name}\";\"{cat}\";{price};{item.OpeningQuantity};{item.OpeningAmount:F2};{item.InflowQuantity};{item.InflowAmount:F2};{item.OutflowQuantity};{item.OutflowAmount:F2};{item.ClosingQuantity};{item.ClosingAmount:F2}");
            }

            sb.AppendLine();
            sb.AppendLine($"РАЗОМ ПО СКЛАДУ;;;;;{data.TotalOpeningAmount:F2};{data.TotalInflowQuantity};{data.TotalInflowAmount:F2};{data.TotalOutflowQuantity};{data.TotalOutflowAmount:F2};;{data.TotalClosingAmount:F2}");

            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
            var fileName = $"turnover_statement_{data.FromDate:yyyyMMdd}_{data.ToDate:yyyyMMdd}.csv";

            return File(bytes, "text/csv; charset=utf-8", fileName);
        }

        /// <summary>
        /// Звіт по матеріальній оцінці складу в розрізі категорій
        /// </summary>
        [HttpGet("stock-valuation")]
        public async Task<ActionResult<StockValuationReportDto>> GetStockValuation()
        {
            var products = await _context.Products.AsNoTracking()
                .Include(p => p.Category)
                .ToListAsync();

            var totalValuation = products.Sum(p => p.Price * p.Quantity);
            var totalQty = products.Sum(p => p.Quantity);

            var categoryGroups = products
                .GroupBy(p => new { p.CategoryId, Name = p.Category != null ? p.Category.Name : "Без категорії" })
                .Select(g =>
                {
                    var catVal = g.Sum(p => p.Price * p.Quantity);
                    return new CategoryValuationDto
                    {
                        CategoryId = g.Key.CategoryId,
                        CategoryName = g.Key.Name,
                        ProductsCount = g.Count(),
                        TotalQuantity = g.Sum(p => p.Quantity),
                        TotalValuation = catVal,
                        SharePercentage = totalValuation > 0 ? Math.Round((catVal / totalValuation) * 100, 2) : 0
                    };
                })
                .OrderByDescending(c => c.TotalValuation)
                .ToList();

            var result = new StockValuationReportDto
            {
                AsOfDate = DateTime.UtcNow,
                TotalItemsCount = products.Count,
                TotalStockQuantity = totalQty,
                TotalWarehouseValuation = totalValuation,
                Categories = categoryGroups
            };

            return Ok(result);
        }

        /// <summary>
        /// Аналітичний звіт активності контрагентів (постачальники та замовники)
        /// </summary>
        [HttpGet("partners-activity")]
        public async Task<ActionResult<PartnersReportDto>> GetPartnersActivity(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            var fromUtc = fromDate.HasValue
                ? DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc)
                : DateTime.UtcNow.Date.AddDays(-30);

            var toUtc = toDate.HasValue
                ? DateTime.SpecifyKind(toDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc)
                : DateTime.UtcNow;

            var movements = await _context.StockMovements.AsNoTracking()
                .Include(m => m.Product)
                .Include(m => m.Supplier)
                .Include(m => m.Customer)
                .Where(m => m.MovementDate >= fromUtc && m.MovementDate <= toUtc)
                .ToListAsync();

            var topSuppliers = movements
                .Where(m => m.SupplierId.HasValue && m.Supplier != null)
                .GroupBy(m => m.Supplier!)
                .Select(g => new PartnerActivityDto
                {
                    PartnerId = g.Key.Id,
                    PartnerName = g.Key.Name,
                    PartnerType = "Supplier",
                    OperationsCount = g.Count(),
                    TotalQuantity = g.Sum(m => m.Quantity),
                    TotalEstimatedCost = g.Sum(m => m.Quantity * (m.Product?.Price ?? 0)),
                    LastActivityDate = g.Max(m => m.MovementDate)
                })
                .OrderByDescending(s => s.TotalEstimatedCost)
                .Take(10)
                .ToList();

            var topCustomers = movements
                .Where(m => m.CustomerId.HasValue && m.Customer != null)
                .GroupBy(m => m.Customer!)
                .Select(g => new PartnerActivityDto
                {
                    PartnerId = g.Key.Id,
                    PartnerName = g.Key.Name,
                    PartnerType = "Customer",
                    OperationsCount = g.Count(),
                    TotalQuantity = g.Sum(m => m.Quantity),
                    TotalEstimatedCost = g.Sum(m => m.Quantity * (m.Product?.Price ?? 0)),
                    LastActivityDate = g.Max(m => m.MovementDate)
                })
                .OrderByDescending(c => c.TotalEstimatedCost)
                .Take(10)
                .ToList();

            return Ok(new PartnersReportDto
            {
                FromDate = fromUtc,
                ToDate = toUtc,
                TopSuppliers = topSuppliers,
                TopCustomers = topCustomers
            });
        }
    }
}
