import unittest
import main
from models.schemas import (
    ForecastRequest,
    ProcurementRadarRequest,
    AbcXyzRequest,
    CopilotChatRequest,
    WarehouseProductInput
)

class TestApiEndpoints(unittest.TestCase):

    def test_health_check_endpoint(self):
        res = main.health_check()
        self.assertEqual(res["status"], "healthy")
        self.assertEqual(res["service"], "inventory-ml")
        self.assertEqual(res["version"], "1.0.0")

    def test_get_sample_products_endpoint(self):
        products = main.get_sample_products()
        self.assertIsInstance(products, list)
        self.assertGreaterEqual(len(products), 10)
        self.assertIn("sku", products[0])
        self.assertIn("name", products[0])

    def test_get_sample_product_history_endpoint(self):
        # ACC-001 is a benchmark product
        history = main.get_sample_product_history(sku="ACC-001", days=30)
        self.assertEqual(len(history), 30)
        self.assertIsNotNone(history[0].date)
        self.assertGreaterEqual(history[0].actual_quantity, 0.0)

    def test_get_procurement_radar_endpoint(self):
        radar = main.get_procurement_radar(service_level_z=1.65, order_cost_s=500.0, holding_rate=0.20)
        self.assertGreater(radar.total_items_count, 0)
        self.assertEqual(radar.service_level_z, 1.65)
        self.assertIsNotNone(radar.generated_at)

    def test_post_custom_procurement_radar_endpoint(self):
        req = ProcurementRadarRequest(
            products=[
                WarehouseProductInput(
                    product_id="test-1",
                    sku="TEST-SKU",
                    name="Test Item",
                    category="Периферія",
                    unit_price=100.0,
                    current_stock=2.0,
                    min_stock=10.0,
                    daily_demand=2.0
                )
            ],
            service_level_z=1.65
        )
        radar = main.calculate_custom_procurement_radar(req)
        self.assertEqual(radar.total_items_count, 1)
        self.assertEqual(radar.items[0].sku, "TEST-SKU")

    def test_get_abc_xyz_analysis_endpoint(self):
        res = main.get_abc_xyz_analysis(period_days=90)
        self.assertGreater(res.total_products, 0)
        self.assertGreater(res.total_revenue, 0.0)

    def test_post_abc_xyz_analysis_endpoint(self):
        req = AbcXyzRequest(
            days_period=120,
            products=[
                WarehouseProductInput(
                    product_id="p1",
                    sku="SKU-1",
                    name="Product 1",
                    unit_price=500.0,
                    daily_demand=1.0,
                    current_stock=10.0
                )
            ]
        )
        res = main.post_abc_xyz_analysis(req)
        self.assertEqual(res.total_products, 1)

    def test_predict_product_demand_endpoint(self):
        req = ForecastRequest(
            sku="ACC-001",
            name="Wireless Mouse",
            min_stock=5.0,
            unit_price=800.0,
            category="Периферія",
            horizon_days=14,
            model_type="ridge"
        )
        res = main.predict_product_demand(productId="ACC-001", request=req)
        self.assertEqual(res.horizon_days, 14)
        self.assertEqual(len(res.forecast_points), 14)

    def test_chat_with_warehouse_copilot_endpoint(self):
        req = CopilotChatRequest(
            message="Що замовити?",
            provider="offline"
        )
        res = main.chat_with_warehouse_copilot(req)
        self.assertIsNotNone(res.reply)
        self.assertEqual(res.intent, "urgent_procurement")


if __name__ == "__main__":
    unittest.main()
