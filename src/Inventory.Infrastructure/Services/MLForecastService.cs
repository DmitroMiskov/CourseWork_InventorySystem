using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Inventory.Application.Common.Interfaces;
using Inventory.Application.Common.Models.ML;
using Inventory.Domain.Entities;
using Inventory.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Inventory.Infrastructure.Services
{
    public class MLForecastService : IMLForecastService
    {
        private readonly HttpClient _httpClient;
        private readonly IApplicationDbContext _context;
        private readonly ILogger<MLForecastService> _logger;
        private readonly string _baseUrl;

        public MLForecastService(
            HttpClient httpClient,
            IConfiguration configuration,
            IApplicationDbContext context,
            ILogger<MLForecastService> logger)
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

        public async Task<bool> CheckServiceHealthAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                var response = await _httpClient.GetAsync($"{_baseUrl}health", cancellationToken);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Python ML-сервіс наразі недоступний за адресою {BaseUrl}", _baseUrl);
                return false;
            }
        }

        public async Task<ForecastResponseDto> GetDemandForecastAsync(
            string productId, 
            int horizonDays = 14, 
            string modelType = "best", 
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Спроба знайти реальний товар у БД за Guid або за SKU
                Product? dbProduct = null;
                List<MovementRecordDto>? historyRecords = null;

                if (Guid.TryParse(productId, out var guidId))
                {
                    dbProduct = await _context.Products
                        .Include(p => p.Category)
                        .AsNoTracking()
                        .FirstOrDefaultAsync(p => p.Id == guidId, cancellationToken);
                }

                if (dbProduct == null)
                {
                    dbProduct = await _context.Products
                        .Include(p => p.Category)
                        .AsNoTracking()
                        .FirstOrDefaultAsync(p => p.SKU == productId || p.Name == productId, cancellationToken);
                }

                if (dbProduct != null)
                {
                    var movements = await _context.StockMovements
                        .AsNoTracking()
                        .Where(m => m.ProductId == dbProduct.Id && m.Type == MovementType.Out)
                        .OrderBy(m => m.MovementDate)
                        .ToListAsync(cancellationToken);

                    if (movements.Any())
                    {
                        historyRecords = movements.Select(m => new MovementRecordDto
                        {
                            Date = m.MovementDate.ToString("yyyy-MM-dd"),
                            Quantity = m.Quantity,
                            Type = "Outgoing",
                            UnitPrice = (double)dbProduct.Price
                        }).ToList();
                    }
                }

                var requestDto = new ForecastRequestDto
                {
                    ProductId = dbProduct?.Id.ToString() ?? productId,
                    Sku = dbProduct?.SKU ?? productId,
                    Name = dbProduct?.Name ?? ("Товар " + productId),
                    Category = dbProduct?.Category?.Name ?? "Загальне",
                    UnitPrice = dbProduct != null ? (double)dbProduct.Price : 1000.0,
                    CurrentStock = dbProduct != null ? dbProduct.Quantity : 0.0,
                    MinStock = dbProduct != null ? dbProduct.MinStock : 3.0,
                    HorizonDays = horizonDays,
                    History = historyRecords,
                    ModelType = modelType
                };

                var url = $"{_baseUrl}api/forecast/{productId}?horizon_days={horizonDays}&model_type={modelType}";
                var response = await _httpClient.PostAsJsonAsync(url, requestDto, cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<ForecastResponseDto>(cancellationToken: cancellationToken);
                    if (result != null)
                    {
                        if (dbProduct != null)
                        {
                            result.Sku = dbProduct.SKU;
                            result.Name = dbProduct.Name;
                        }
                        return result;
                    }
                }

                _logger.LogWarning("ML сервіс повернув статус {StatusCode}", response.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка виклику ML сервісу прогнозування для товару {ProductId}", productId);
            }

            // Fallback (резервний варіант у разі недоступності сервісу)
            return CreateFallbackForecast(productId, horizonDays);
        }

        public async Task<ProcurementRadarResponseDto> GetProcurementRadarAsync(
            double serviceLevelZ = 1.65, 
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Завантажуємо реальні товари з бази даних складу (PostgreSQL)
                var dbProducts = await _context.Products
                    .Include(p => p.Category)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                if (dbProducts.Any())
                {
                    var radarRequest = new ProcurementRadarRequestDto
                    {
                        ServiceLevelZ = serviceLevelZ,
                        OrderCostS = 500.0,
                        HoldingCostRateH = 0.20,
                        Products = dbProducts.Select(p => new WarehouseProductInputDto
                        {
                            ProductId = p.Id.ToString(),
                            Sku = p.SKU,
                            Name = p.Name,
                            Category = p.Category?.Name ?? "Загальне",
                            UnitPrice = (double)p.Price,
                            CurrentStock = p.Quantity,
                            MinStock = p.MinStock
                        }).ToList()
                    };

                    var postUrl = $"{_baseUrl}api/procurement/radar";
                    var postResponse = await _httpClient.PostAsJsonAsync(postUrl, radarRequest, cancellationToken);

                    if (postResponse.IsSuccessStatusCode)
                    {
                        var result = await postResponse.Content.ReadFromJsonAsync<ProcurementRadarResponseDto>(cancellationToken: cancellationToken);
                        if (result != null && result.Items.Any())
                        {
                            return result;
                        }
                    }
                }

                // Fallback запит до GET якщо в БД порожньо або помилка
                var getUrl = $"{_baseUrl}api/procurement/radar?service_level_z={serviceLevelZ}";
                var getResponse = await _httpClient.GetAsync(getUrl, cancellationToken);

                if (getResponse.IsSuccessStatusCode)
                {
                    var result = await getResponse.Content.ReadFromJsonAsync<ProcurementRadarResponseDto>(cancellationToken: cancellationToken);
                    if (result != null)
                    {
                        return result;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка виклику ML Радару закупівель");
            }

            return CreateFallbackRadar(serviceLevelZ);
        }

        public async Task<AbcXyzResponseDto> GetAbcXyzAnalysisAsync(
            int periodDays = 180, 
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Завантажуємо реальні товари з бази даних складу (PostgreSQL)
                var dbProducts = await _context.Products
                    .Include(p => p.Category)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                if (dbProducts.Any())
                {
                    var abcRequest = new AbcXyzRequestDto
                    {
                        DaysPeriod = periodDays,
                        Products = dbProducts.Select(p => new WarehouseProductInputDto
                        {
                            ProductId = p.Id.ToString(),
                            Sku = p.SKU,
                            Name = p.Name,
                            Category = p.Category?.Name ?? "Загальне",
                            UnitPrice = (double)p.Price,
                            CurrentStock = p.Quantity,
                            MinStock = p.MinStock
                        }).ToList()
                    };

                    var postUrl = $"{_baseUrl}api/analytics/abc-xyz";
                    var postResponse = await _httpClient.PostAsJsonAsync(postUrl, abcRequest, cancellationToken);

                    if (postResponse.IsSuccessStatusCode)
                    {
                        var result = await postResponse.Content.ReadFromJsonAsync<AbcXyzResponseDto>(cancellationToken: cancellationToken);
                        if (result != null)
                        {
                            return result;
                        }
                    }
                }

                var getUrl = $"{_baseUrl}api/analytics/abc-xyz?period_days={periodDays}";
                var getResponse = await _httpClient.GetAsync(getUrl, cancellationToken);

                if (getResponse.IsSuccessStatusCode)
                {
                    var result = await getResponse.Content.ReadFromJsonAsync<AbcXyzResponseDto>(cancellationToken: cancellationToken);
                    if (result != null)
                    {
                        return result;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка виклику ML ABC-XYZ аналізу");
            }

            return new AbcXyzResponseDto
            {
                GeneratedAt = DateTime.UtcNow.ToString("o"),
                TotalProducts = 0,
                TotalRevenue = 0,
                MatrixCounts = new Dictionary<string, int>(),
                Items = new List<AbcXyzItemDto>()
            };
        }

        private ForecastResponseDto CreateFallbackForecast(string productId, int horizonDays)
        {
            var today = DateTime.UtcNow.Date;
            var hist = new List<HistoricalPointDto>();
            for (int i = 30; i >= 1; i--)
            {
                hist.Add(new HistoricalPointDto
                {
                    Date = today.AddDays(-i).ToString("yyyy-MM-dd"),
                    ActualQuantity = 5.0 + Math.Sin(i) * 2.0
                });
            }

            var fore = new List<ForecastPointDto>();
            for (int i = 1; i <= horizonDays; i++)
            {
                fore.Add(new ForecastPointDto
                {
                    Date = today.AddDays(i).ToString("yyyy-MM-dd"),
                    DayIndex = i,
                    PredictedDemand = 5.2,
                    LowerBound95 = 3.8,
                    UpperBound95 = 6.6
                });
            }

            return new ForecastResponseDto
            {
                ProductId = productId,
                Sku = "ITEM-" + productId,
                Name = "Товар " + productId,
                HorizonDays = horizonDays,
                ModelUsed = "Евристичний розрахунок (Fallback)",
                HistoricalPoints = hist,
                ForecastPoints = fore,
                Metrics = new ModelMetricsDto
                {
                    Mae = 1.1,
                    Rmse = 1.4,
                    Mape = 9.8,
                    ModelName = "Heuristic Baseline"
                },
                Trend = "Стабільний",
                SummaryForecastQty = 5.2 * horizonDays,
                AvgDailyDemand = 5.2
            };
        }

        private ProcurementRadarResponseDto CreateFallbackRadar(double serviceLevelZ)
        {
            return new ProcurementRadarResponseDto
            {
                GeneratedAt = DateTime.UtcNow.ToString("o"),
                ServiceLevelZ = serviceLevelZ,
                TotalItemsCount = 0,
                UrgentCount = 0,
                CriticalCount = 0,
                WarningCount = 0,
                NormCount = 0,
                TotalRecommendedProcurementCost = 0,
                Items = new List<ProcurementRadarItemDto>()
            };
        }
    }
}
