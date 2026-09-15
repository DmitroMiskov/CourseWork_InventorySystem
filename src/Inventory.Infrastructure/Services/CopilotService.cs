using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Inventory.Application.Common.Interfaces;
using Inventory.Application.Common.Models.Copilot;
using Inventory.Application.Common.Models.ML;
using Inventory.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Inventory.Infrastructure.Services
{
    public class CopilotService : ICopilotService
    {
        private readonly HttpClient _httpClient;
        private readonly IApplicationDbContext _context;
        private readonly ILogger<CopilotService> _logger;
        private readonly string _baseUrl;

        public CopilotService(
            HttpClient httpClient,
            IConfiguration configuration,
            IApplicationDbContext context,
            ILogger<CopilotService> logger)
        {
            _httpClient = httpClient;
            _context = context;
            _logger = logger;

            _baseUrl = configuration["MlService:BaseUrl"] ?? "http://localhost:8000";
            if (!_baseUrl.EndsWith("/"))
            {
                _baseUrl += "/";
            }
        }

        public async Task<CopilotChatResponseDto> ProcessChatAsync(
            CopilotChatRequestDto request, 
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Якщо клієнт не передав список товарів, підвантажуємо актуальний каталог з PostgreSQL
                if (request.Products == null || !request.Products.Any())
                {
                    request.Products = await LoadWarehouseProductsAsync(cancellationToken);
                }

                var url = $"{_baseUrl}api/copilot/chat";
                var response = await _httpClient.PostAsJsonAsync(url, request, cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<CopilotChatResponseDto>(cancellationToken: cancellationToken);
                    if (result != null)
                    {
                        return result;
                    }
                }

                var errorText = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("ML Copilot повернув статус {StatusCode}: {ErrorText}", response.StatusCode, errorText);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка комунікації з ML Copilot сервісом за адресою {BaseUrl}", _baseUrl);
            }

            // Fallback у разі збою зовнішнього виклику
            return new CopilotChatResponseDto
            {
                Reply = "⚠️ Сервіс штучного інтелекту тимчасово недоступний. Будь ласка, переконайтеся, що обчислювальний контейнер `inventory-ml` активний.",
                Intent = "error",
                ModelUsed = "API Gateway Fallback Engine",
                GeneratedAt = DateTime.UtcNow.ToString("o"),
                Actions = new List<CopilotActionDto>()
            };
        }

        private async Task<List<WarehouseProductInputDto>> LoadWarehouseProductsAsync(CancellationToken cancellationToken)
        {
            try
            {
                var dbProducts = await _context.Products
                    .Include(p => p.Category)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                if (!dbProducts.Any())
                {
                    return new List<WarehouseProductInputDto>();
                }

                // Завантажуємо постачальників
                var suppliers = await _context.Suppliers
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                // Завантажуємо історію руху за останні 30 днів
                var sinceDate = DateTime.UtcNow.AddDays(-30);
                var recentMovements = await _context.StockMovements
                    .Where(m => m.MovementDate >= sinceDate)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                var salesByProduct = recentMovements
                    .Where(m => m.Type == MovementType.Out)
                    .GroupBy(m => m.ProductId)
                    .ToDictionary(g => g.Key, g => g.Select(m => (double)m.Quantity).ToList());

                var supplierMap = recentMovements
                    .Where(m => m.Type == MovementType.In && m.SupplierId.HasValue)
                    .OrderByDescending(m => m.MovementDate)
                    .GroupBy(m => m.ProductId)
                    .ToDictionary(g => g.Key, g => g.First().SupplierId);

                return dbProducts.Select(p =>
                {
                    string supplierName = "ТОВ \"ТехноДистриб'юшн\"";
                    if (supplierMap.TryGetValue(p.Id, out var suppId) && suppId.HasValue)
                    {
                        var s = suppliers.FirstOrDefault(x => x.Id == suppId.Value);
                        if (s != null && !string.IsNullOrWhiteSpace(s.Name))
                        {
                            supplierName = s.Name;
                        }
                    }
                    else if (suppliers.Any())
                    {
                        supplierName = suppliers.First().Name;
                    }

                    List<double>? sales = null;
                    if (salesByProduct.TryGetValue(p.Id, out var list) && list.Any())
                    {
                        sales = list;
                    }

                    return new WarehouseProductInputDto
                    {
                        ProductId = p.Id.ToString(),
                        Sku = p.SKU,
                        Name = p.Name,
                        Category = p.Category?.Name ?? "Загальне",
                        UnitPrice = (double)p.Price,
                        CurrentStock = p.Quantity,
                        MinStock = p.MinStock,
                        MaxStock = Math.Max(p.MinStock * 4, 30),
                        LeadTimeDays = 5,
                        SupplierName = supplierName,
                        DailySalesHistory = sales
                    };
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка завантаження товарів для Copilot");
                return new List<WarehouseProductInputDto>();
            }
        }
    }
}
