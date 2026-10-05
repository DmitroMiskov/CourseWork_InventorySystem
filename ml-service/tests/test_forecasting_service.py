import unittest
import numpy as np
from models.schemas import MovementRecord, ForecastRequest
from services.forecasting_service import (
    create_lag_features,
    calculate_mape,
    train_and_forecast_holt_winters,
    train_and_forecast_ridge,
    train_and_forecast_lightgbm,
    generate_custom_product_timeseries,
    generate_forecast
)

class TestForecastingService(unittest.TestCase):

    def setUp(self):
        # Create a synthetic time series of 60 days with weekly seasonality
        np.random.seed(42)
        base = 10.0
        weekly_pattern = np.array([1.0, 1.2, 1.1, 1.1, 0.9, 0.7, 0.6] * 9)[:60]
        noise = np.random.normal(0, 1.0, 60)
        self.series = np.maximum(1.0, base * weekly_pattern + noise)

    def test_create_lag_features(self):
        lags = [1, 2, 3, 7, 14]
        X, y = create_lag_features(self.series, lags)
        # Length should be len(series) - max(lags) = 60 - 14 = 46
        self.assertEqual(len(X), 46)
        self.assertEqual(len(y), 46)
        # Each row has: len(lags) + ma7 + ma14 + day_of_week = 5 + 1 + 1 + 1 = 8 features
        self.assertEqual(X.shape[1], 8)

    def test_calculate_mape(self):
        y_true = np.array([10.0, 20.0, 30.0])
        # Perfect predictions
        self.assertAlmostEqual(calculate_mape(y_true, y_true), 0.0, places=3)

        # 10% error
        y_pred = np.array([11.0, 22.0, 33.0])
        mape = calculate_mape(y_true, y_pred)
        self.assertAlmostEqual(mape, 10.0, delta=0.5)

        # All zeros in true values shouldn't raise exception
        y_zero = np.array([0.0, 0.0, 0.0])
        self.assertEqual(calculate_mape(y_zero, y_pred), 0.0)

    def test_train_and_forecast_holt_winters(self):
        horizon = 14
        preds, res_std, metrics = train_and_forecast_holt_winters(self.series, horizon)
        self.assertEqual(len(preds), horizon)
        self.assertGreater(res_std, 0.0)
        self.assertIsNotNone(metrics.mae)
        self.assertIsNotNone(metrics.rmse)
        self.assertIsNotNone(metrics.mape)
        self.assertIn("Holt-Winters", metrics.model_name)
        # Predictions should not be negative
        self.assertTrue(np.all(preds >= 0.0))

    def test_train_and_forecast_ridge(self):
        horizon = 14
        preds, res_std, metrics = train_and_forecast_ridge(self.series, horizon)
        self.assertEqual(len(preds), horizon)
        self.assertGreater(res_std, 0.0)
        self.assertIsNotNone(metrics.mae)
        self.assertIn("Ridge", metrics.model_name)
        self.assertTrue(np.all(preds >= 0.0))

    def test_train_and_forecast_lightgbm(self):
        horizon = 14
        preds, res_std, metrics = train_and_forecast_lightgbm(self.series, horizon)
        self.assertEqual(len(preds), horizon)
        self.assertGreater(res_std, 0.0)
        self.assertIsNotNone(metrics.mae)
        self.assertTrue(np.all(preds >= 0.0))

    def test_generate_custom_product_timeseries(self):
        points = generate_custom_product_timeseries(sku="TEST-SKU", min_stock=5.0, price=1500.0, days=90)
        self.assertEqual(len(points), 90)
        for p in points:
            self.assertIsNotNone(p.date)
            self.assertGreaterEqual(p.actual_quantity, 0.0)

    def test_generate_forecast_benchmark(self):
        # Forecast for benchmark product 1
        resp = generate_forecast(product_id="1", horizon_days=14, model_type="ridge")
        self.assertEqual(resp.horizon_days, 14)
        self.assertEqual(len(resp.forecast_points), 14)
        self.assertGreater(len(resp.historical_points), 0)
        self.assertIn(resp.trend, ["Зростаючий", "Спадний", "Стабільний"])
        self.assertGreater(resp.summary_forecast_qty, 0.0)

        # Verify confidence intervals
        for fp in resp.forecast_points:
            self.assertLessEqual(fp.lower_bound_95, fp.predicted_demand)
            self.assertGreaterEqual(fp.upper_bound_95, fp.predicted_demand)

    def test_generate_forecast_with_custom_history(self):
        # Provide external movement history (20 days)
        records = [
            MovementRecord(date=f"2026-09-{i+1:02d}", quantity=5.0 + (i % 3))
            for i in range(20)
        ]
        req = ForecastRequest(
            sku="CUSTOM-001",
            name="Custom Router",
            min_stock=5.0,
            unit_price=2500.0,
            category="Мережеве обладнання"
        )
        resp = generate_forecast(
            product_id="custom-1",
            horizon_days=7,
            history_records=records,
            model_type="best",
            request=req
        )
        self.assertEqual(resp.sku, "CUSTOM-001")
        self.assertEqual(resp.name, "Custom Router")
        self.assertEqual(len(resp.forecast_points), 7)
        self.assertEqual(len(resp.historical_points), 20)


if __name__ == "__main__":
    unittest.main()
