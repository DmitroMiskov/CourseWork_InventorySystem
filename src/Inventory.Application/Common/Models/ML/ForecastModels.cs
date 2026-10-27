using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Inventory.Application.Common.Models.ML
{
    public class MovementRecordDto
    {
        [JsonPropertyName("date")]
        public string Date { get; set; } = string.Empty;

        [JsonPropertyName("quantity")]
        public double Quantity { get; set; }

        [JsonPropertyName("type")]
        public string Type { get; set; } = "Outgoing";

        [JsonPropertyName("unit_price")]
        public double UnitPrice { get; set; }
    }

    public class ForecastRequestDto
    {
        [JsonPropertyName("product_id")]
        public object ProductId { get; set; } = 1;

        [JsonPropertyName("sku")]
        public string? Sku { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("category")]
        public string? Category { get; set; }

        [JsonPropertyName("unit_price")]
        public double? UnitPrice { get; set; }

        [JsonPropertyName("current_stock")]
        public double? CurrentStock { get; set; }

        [JsonPropertyName("min_stock")]
        public double? MinStock { get; set; }

        [JsonPropertyName("horizon_days")]
        public int HorizonDays { get; set; } = 14;

        [JsonPropertyName("history")]
        public List<MovementRecordDto>? History { get; set; }

        [JsonPropertyName("model_type")]
        public string ModelType { get; set; } = "best";
    }

    public class HistoricalPointDto
    {
        [JsonPropertyName("date")]
        public string Date { get; set; } = string.Empty;

        [JsonPropertyName("actual_quantity")]
        public double ActualQuantity { get; set; }
    }

    public class ForecastPointDto
    {
        [JsonPropertyName("date")]
        public string Date { get; set; } = string.Empty;

        [JsonPropertyName("day_index")]
        public int DayIndex { get; set; }

        [JsonPropertyName("predicted_demand")]
        public double PredictedDemand { get; set; }

        [JsonPropertyName("lower_bound_95")]
        public double LowerBound95 { get; set; }

        [JsonPropertyName("upper_bound_95")]
        public double UpperBound95 { get; set; }
    }

    public class CandidateModelMetricDto
    {
        [JsonPropertyName("model_name")]
        public string ModelName { get; set; } = string.Empty;

        [JsonPropertyName("mae")]
        public double Mae { get; set; }

        [JsonPropertyName("rmse")]
        public double Rmse { get; set; }

        [JsonPropertyName("mape")]
        public double Mape { get; set; }

        [JsonPropertyName("r2")]
        public double? R2 { get; set; }

        [JsonPropertyName("weight")]
        public double? Weight { get; set; }
    }

    public class ModelMetricsDto
    {
        [JsonPropertyName("mae")]
        public double Mae { get; set; }

        [JsonPropertyName("rmse")]
        public double Rmse { get; set; }

        [JsonPropertyName("mape")]
        public double Mape { get; set; }

        [JsonPropertyName("r2")]
        public double? R2 { get; set; }

        [JsonPropertyName("model_name")]
        public string ModelName { get; set; } = string.Empty;

        [JsonPropertyName("is_hybrid")]
        public bool IsHybrid { get; set; } = false;

        [JsonPropertyName("ensemble_weights")]
        public Dictionary<string, double>? EnsembleWeights { get; set; }

        [JsonPropertyName("candidate_metrics")]
        public List<CandidateModelMetricDto>? CandidateMetrics { get; set; }
    }

    public class ShapFeatureContributionDto
    {
        [JsonPropertyName("feature_key")]
        public string FeatureKey { get; set; } = string.Empty;

        [JsonPropertyName("feature_name")]
        public string FeatureName { get; set; } = string.Empty;

        [JsonPropertyName("feature_value")]
        public double? FeatureValue { get; set; }

        [JsonPropertyName("contribution")]
        public double Contribution { get; set; }

        [JsonPropertyName("percentage")]
        public double Percentage { get; set; }

        [JsonPropertyName("impact_type")]
        public string ImpactType { get; set; } = "neutral";

        [JsonPropertyName("description")]
        public string Description { get; set; } = string.Empty;
    }

    public class ExplainabilityReportDto
    {
        [JsonPropertyName("base_value")]
        public double BaseValue { get; set; }

        [JsonPropertyName("final_prediction")]
        public double FinalPrediction { get; set; }

        [JsonPropertyName("summary_text")]
        public string SummaryText { get; set; } = string.Empty;

        [JsonPropertyName("top_positive_factors")]
        public List<ShapFeatureContributionDto> TopPositiveFactors { get; set; } = new();

        [JsonPropertyName("top_negative_factors")]
        public List<ShapFeatureContributionDto> TopNegativeFactors { get; set; } = new();

        [JsonPropertyName("all_contributions")]
        public List<ShapFeatureContributionDto> AllContributions { get; set; } = new();
    }

    public class ForecastResponseDto
    {
        [JsonPropertyName("product_id")]
        public object ProductId { get; set; } = 1;

        [JsonPropertyName("sku")]
        public string? Sku { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("horizon_days")]
        public int HorizonDays { get; set; }

        [JsonPropertyName("model_used")]
        public string ModelUsed { get; set; } = string.Empty;

        [JsonPropertyName("historical_points")]
        public List<HistoricalPointDto> HistoricalPoints { get; set; } = new();

        [JsonPropertyName("forecast_points")]
        public List<ForecastPointDto> ForecastPoints { get; set; } = new();

        [JsonPropertyName("metrics")]
        public ModelMetricsDto Metrics { get; set; } = new();

        [JsonPropertyName("trend")]
        public string Trend { get; set; } = "Стабільний";

        [JsonPropertyName("summary_forecast_qty")]
        public double SummaryForecastQty { get; set; }

        [JsonPropertyName("avg_daily_demand")]
        public double AvgDailyDemand { get; set; }

        [JsonPropertyName("explainability")]
        public ExplainabilityReportDto? Explainability { get; set; }
    }

    public class WhatIfScenarioRequestDto
    {
        [JsonPropertyName("product_id")]
        public object ProductId { get; set; } = 1;

        [JsonPropertyName("horizon_days")]
        public int HorizonDays { get; set; } = 14;

        [JsonPropertyName("price_change_percent")]
        public double PriceChangePercent { get; set; } = 0.0;

        [JsonPropertyName("is_promo_active")]
        public bool IsPromoActive { get; set; } = false;

        [JsonPropertyName("marketing_campaign_boost")]
        public double MarketingCampaignBoost { get; set; } = 0.0;
    }

    public class WhatIfScenarioResponseDto
    {
        [JsonPropertyName("product_id")]
        public object ProductId { get; set; } = 1;

        [JsonPropertyName("sku")]
        public string? Sku { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("horizon_days")]
        public int HorizonDays { get; set; }

        [JsonPropertyName("base_summary_demand")]
        public double BaseSummaryDemand { get; set; }

        [JsonPropertyName("simulated_summary_demand")]
        public double SimulatedSummaryDemand { get; set; }

        [JsonPropertyName("delta_demand_units")]
        public double DeltaDemandUnits { get; set; }

        [JsonPropertyName("delta_demand_percent")]
        public double DeltaDemandPercent { get; set; }

        [JsonPropertyName("recommended_procurement_qty")]
        public double RecommendedProcurementQty { get; set; }

        [JsonPropertyName("simulated_forecast_points")]
        public List<ForecastPointDto> SimulatedForecastPoints { get; set; } = new();

        [JsonPropertyName("drivers")]
        public List<ShapFeatureContributionDto> Drivers { get; set; } = new();

        [JsonPropertyName("insights")]
        public string Insights { get; set; } = string.Empty;
    }

    public class ProcurementRadarItemDto
    {
        [JsonPropertyName("product_id")]
        public object ProductId { get; set; } = 1;

        [JsonPropertyName("sku")]
        public string Sku { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("category")]
        public string Category { get; set; } = string.Empty;

        [JsonPropertyName("unit_price")]
        public double UnitPrice { get; set; }

        [JsonPropertyName("current_stock")]
        public double CurrentStock { get; set; }

        [JsonPropertyName("daily_demand")]
        public double DailyDemand { get; set; }

        [JsonPropertyName("daily_demand_std")]
        public double DailyDemandStd { get; set; }

        [JsonPropertyName("lead_time_days")]
        public int LeadTimeDays { get; set; }

        [JsonPropertyName("lead_time_std")]
        public double LeadTimeStd { get; set; } = 1.0;

        [JsonPropertyName("safety_stock")]
        public double SafetyStock { get; set; }

        [JsonPropertyName("reorder_point")]
        public double ReorderPoint { get; set; }

        [JsonPropertyName("eoq")]
        public double Eoq { get; set; }

        [JsonPropertyName("days_to_depletion")]
        public double DaysToDepletion { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("status_code")]
        public string StatusCode { get; set; } = "norm";

        [JsonPropertyName("recommended_order_qty")]
        public double RecommendedOrderQty { get; set; }

        [JsonPropertyName("estimated_order_cost")]
        public double EstimatedOrderCost { get; set; }

        [JsonPropertyName("supplier_name")]
        public string SupplierName { get; set; } = string.Empty;
    }

    public class ProcurementRadarResponseDto
    {
        [JsonPropertyName("generated_at")]
        public string GeneratedAt { get; set; } = string.Empty;

        [JsonPropertyName("service_level_z")]
        public double ServiceLevelZ { get; set; }

        [JsonPropertyName("total_items_count")]
        public int TotalItemsCount { get; set; }

        [JsonPropertyName("urgent_count")]
        public int UrgentCount { get; set; }

        [JsonPropertyName("critical_count")]
        public int CriticalCount { get; set; }

        [JsonPropertyName("warning_count")]
        public int WarningCount { get; set; }

        [JsonPropertyName("norm_count")]
        public int NormCount { get; set; }

        [JsonPropertyName("total_recommended_procurement_cost")]
        public double TotalRecommendedProcurementCost { get; set; }

        [JsonPropertyName("items")]
        public List<ProcurementRadarItemDto> Items { get; set; } = new();
    }

    public class AbcXyzItemDto
    {
        [JsonPropertyName("product_id")]
        public object ProductId { get; set; } = 1;

        [JsonPropertyName("sku")]
        public string Sku { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("category")]
        public string Category { get; set; } = string.Empty;

        [JsonPropertyName("revenue")]
        public double Revenue { get; set; }

        [JsonPropertyName("share_percent")]
        public double SharePercent { get; set; }

        [JsonPropertyName("cumulative_share_percent")]
        public double CumulativeSharePercent { get; set; }

        [JsonPropertyName("abc_class")]
        public string AbcClass { get; set; } = string.Empty;

        [JsonPropertyName("cv_percent")]
        public double CvPercent { get; set; }

        [JsonPropertyName("xyz_class")]
        public string XyzClass { get; set; } = string.Empty;

        [JsonPropertyName("matrix_cell")]
        public string MatrixCell { get; set; } = string.Empty;

        [JsonPropertyName("strategy_recommendation")]
        public string StrategyRecommendation { get; set; } = string.Empty;
    }

    public class AbcXyzResponseDto
    {
        [JsonPropertyName("generated_at")]
        public string GeneratedAt { get; set; } = string.Empty;

        [JsonPropertyName("total_products")]
        public int TotalProducts { get; set; }

        [JsonPropertyName("total_revenue")]
        public double TotalRevenue { get; set; }

        [JsonPropertyName("matrix_counts")]
        public Dictionary<string, int> MatrixCounts { get; set; } = new();

        [JsonPropertyName("items")]
        public List<AbcXyzItemDto> Items { get; set; } = new();
    }

    public class WarehouseProductInputDto
    {
        [JsonPropertyName("product_id")]
        public object ProductId { get; set; } = string.Empty;

        [JsonPropertyName("sku")]
        public string Sku { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("category")]
        public string Category { get; set; } = "Загальне";

        [JsonPropertyName("unit_price")]
        public double UnitPrice { get; set; }

        [JsonPropertyName("current_stock")]
        public double CurrentStock { get; set; }

        [JsonPropertyName("min_stock")]
        public double MinStock { get; set; }

        [JsonPropertyName("max_stock")]
        public double? MaxStock { get; set; }

        [JsonPropertyName("lead_time_days")]
        public int? LeadTimeDays { get; set; }

        [JsonPropertyName("daily_sales_history")]
        public List<double>? DailySalesHistory { get; set; }

        [JsonPropertyName("supplier_name")]
        public string? SupplierName { get; set; }
    }

    public class ProcurementRadarRequestDto
    {
        [JsonPropertyName("products")]
        public List<WarehouseProductInputDto>? Products { get; set; }

        [JsonPropertyName("service_level_z")]
        public double ServiceLevelZ { get; set; } = 1.65;

        [JsonPropertyName("order_cost_s")]
        public double OrderCostS { get; set; } = 500.0;

        [JsonPropertyName("holding_cost_rate_h")]
        public double HoldingCostRateH { get; set; } = 0.20;
    }

    public class AbcXyzRequestDto
    {
        [JsonPropertyName("days_period")]
        public int DaysPeriod { get; set; } = 180;

        [JsonPropertyName("products")]
        public List<WarehouseProductInputDto>? Products { get; set; }
    }
}
