using System.Threading;
using System.Threading.Tasks;
using Inventory.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProcurementIntelligenceController : ControllerBase
    {
        private readonly IMLForecastService _mlService;

        public ProcurementIntelligenceController(IMLForecastService mlService)
        {
            _mlService = mlService;
        }

        /// <summary>
        /// Перевірка стану та доступності обчислювального Python ML-сервісу
        /// </summary>
        [HttpGet("health")]
        [AllowAnonymous]
        public async Task<IActionResult> CheckHealth(CancellationToken cancellationToken)
        {
            var isHealthy = await _mlService.CheckServiceHealthAsync(cancellationToken);
            return Ok(new
            {
                status = isHealthy ? "Connected" : "Degraded / Offline",
                mlServiceAvailable = isHealthy
            });
        }

        /// <summary>
        /// Отримання прогнозу попиту та метрик для товару (14 або 30 днів)
        /// </summary>
        [HttpGet("forecast/{productId}")]
        public async Task<IActionResult> GetForecast(
            string productId,
            [FromQuery] int horizonDays = 14,
            [FromQuery] string modelType = "best",
            CancellationToken cancellationToken = default)
        {
            var result = await _mlService.GetDemandForecastAsync(productId, horizonDays, modelType, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// Отримання повної зведеної таблиці "Радар закупівель" (SS, ROP, EOQ, статус критичності)
        /// </summary>
        [HttpGet("radar")]
        public async Task<IActionResult> GetRadar(
            [FromQuery] double serviceLevelZ = 1.65,
            CancellationToken cancellationToken = default)
        {
            var result = await _mlService.GetProcurementRadarAsync(serviceLevelZ, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// Отримання матриці портфельного аналізу асортименту ABC-XYZ (Парето + варіація)
        /// </summary>
        [HttpGet("abc-xyz")]
        public async Task<IActionResult> GetAbcXyz(
            [FromQuery] int periodDays = 180,
            CancellationToken cancellationToken = default)
        {
            var result = await _mlService.GetAbcXyzAnalysisAsync(periodDays, cancellationToken);
            return Ok(result);
        }
    }
}
