using System;
using System.Threading;
using System.Threading.Tasks;
using Inventory.Application.Common.Models.ML;

namespace Inventory.Application.Common.Interfaces
{
    public interface IMLForecastService
    {
        /// <summary>
        /// Отримання прогнозу попиту для товару на вказаний горизонт (14 або 30 днів)
        /// </summary>
        Task<ForecastResponseDto> GetDemandForecastAsync(
            string productId, 
            int horizonDays = 14, 
            string modelType = "best", 
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Отримання зведеної аналітики "Радар закупівель" (SS, ROP, EOQ, ризики обнулення)
        /// </summary>
        Task<ProcurementRadarResponseDto> GetProcurementRadarAsync(
            double serviceLevelZ = 1.65, 
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Отримання матриці портфельного аналізу ABC-XYZ за період
        /// </summary>
        Task<AbcXyzResponseDto> GetAbcXyzAnalysisAsync(
            int periodDays = 180, 
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Перевірка доступності Python ML-мікросервісу
        /// </summary>
        Task<bool> CheckServiceHealthAsync(CancellationToken cancellationToken = default);
    }
}
