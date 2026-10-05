import unittest
from models.schemas import WarehouseProductInput
from services.procurement_service import (
    calculate_safety_stock,
    calculate_reorder_point,
    calculate_eoq,
    evaluate_stock_status,
    get_category_logistics_meta,
    generate_procurement_radar
)

class TestProcurementService(unittest.TestCase):

    def test_calculate_safety_stock_standard(self):
        # Daily demand = 10, std = 2. Lead time = 5 days, lead time std = 1.0, z = 1.65
        # variance_demand = 5 * 4 = 20
        # variance_lead_time = 100 * 1 = 100
        # total_std = sqrt(120) ~= 10.954
        # ss = 1.65 * 10.954 ~= 18.07 -> round = 18
        ss = calculate_safety_stock(
            daily_demand=10.0,
            daily_demand_std=2.0,
            lead_time_days=5,
            lead_time_std=1.0,
            service_level_z=1.65
        )
        self.assertGreaterEqual(ss, 1.0)
        self.assertEqual(ss, 18.0)

    def test_calculate_safety_stock_sensitivity(self):
        # Higher Z should produce higher safety stock
        ss_90 = calculate_safety_stock(daily_demand=10.0, daily_demand_std=2.0, lead_time_days=5, service_level_z=1.28)
        ss_95 = calculate_safety_stock(daily_demand=10.0, daily_demand_std=2.0, lead_time_days=5, service_level_z=1.65)
        ss_99 = calculate_safety_stock(daily_demand=10.0, daily_demand_std=2.0, lead_time_days=5, service_level_z=2.33)

        self.assertLess(ss_90, ss_95)
        self.assertLess(ss_95, ss_99)

    def test_calculate_safety_stock_zero_variance(self):
        # Edge case: zero demand and zero std
        ss = calculate_safety_stock(daily_demand=0.0, daily_demand_std=0.0, lead_time_days=0)
        # Should return at least 1.0
        self.assertEqual(ss, 1.0)

    def test_calculate_reorder_point(self):
        # ROP = (daily_demand * lead_time) + safety_stock
        daily_demand = 5.0
        lead_time = 6
        safety_stock = 15.0
        rop = calculate_reorder_point(daily_demand, lead_time, safety_stock)
        self.assertEqual(rop, 45.0)

    def test_calculate_eoq_standard(self):
        # EOQ = sqrt( (2 * D * S) / H )
        # Annual demand = 1000, Order cost = 500, Holding cost = 50
        # 2 * 1000 * 500 / 50 = 20,000 -> sqrt(20000) ~= 141.42 -> 141.0
        eoq = calculate_eoq(annual_demand=1000.0, order_cost_s=500.0, holding_cost_h=50.0)
        self.assertEqual(eoq, 141.0)

    def test_calculate_eoq_zero_holding_cost_fallback(self):
        # Holding cost <= 0 should fallback to 10.0 and avoid ZeroDivisionError
        eoq = calculate_eoq(annual_demand=100.0, order_cost_s=100.0, holding_cost_h=0.0)
        self.assertGreater(eoq, 0.0)

    def test_evaluate_stock_status_urgent(self):
        # Stock is 0 -> urgent
        text, code = evaluate_stock_status(current_stock=0.0, rop=50.0, safety_stock=20.0, days_to_depletion=0.0, lead_time_days=7)
        self.assertEqual(code, "urgent")

        # Depletion in <= 2 days -> urgent
        text, code = evaluate_stock_status(current_stock=10.0, rop=50.0, safety_stock=20.0, days_to_depletion=1.5, lead_time_days=7)
        self.assertEqual(code, "urgent")

        # Stock <= 50% safety stock -> urgent
        text, code = evaluate_stock_status(current_stock=5.0, rop=50.0, safety_stock=20.0, days_to_depletion=10.0, lead_time_days=7)
        self.assertEqual(code, "urgent")

    def test_evaluate_stock_status_critical(self):
        # Stock < rop and days_to_depletion <= lead_time_days
        text, code = evaluate_stock_status(current_stock=25.0, rop=50.0, safety_stock=10.0, days_to_depletion=5.0, lead_time_days=7)
        self.assertEqual(code, "critical")

    def test_evaluate_stock_status_warning(self):
        # Stock <= rop but days_to_depletion > lead_time_days
        text, code = evaluate_stock_status(current_stock=40.0, rop=50.0, safety_stock=10.0, days_to_depletion=12.0, lead_time_days=7)
        self.assertEqual(code, "warning")

    def test_evaluate_stock_status_norm(self):
        # Stock > rop and days_to_depletion > lead_time_days
        text, code = evaluate_stock_status(current_stock=80.0, rop=50.0, safety_stock=10.0, days_to_depletion=25.0, lead_time_days=7)
        self.assertEqual(code, "norm")

    def test_get_category_logistics_meta(self):
        lead, std, supplier = get_category_logistics_meta("Ноутбуки та ПК")
        self.assertEqual(lead, 7)
        self.assertIn("ТехноДистриб'юшн", supplier)

        lead_unknown, std_unknown, supp_unknown = get_category_logistics_meta("НевідомаКатегорія")
        self.assertEqual(lead_unknown, 5)
        self.assertIn("ПостачТрейд", supp_unknown)

    def test_generate_procurement_radar_with_warehouse_products(self):
        products = [
            WarehouseProductInput(
                product_id="prod-1",
                sku="LAP-001",
                name="Dell Latitude 5520",
                category="Ноутбуки",
                unit_price=35000.0,
                current_stock=1.0,
                min_stock=5.0,
                daily_demand=1.5,
                lead_time_days=7,
                supplier_name="Dell Ukraine"
            ),
            WarehouseProductInput(
                product_id="prod-2",
                sku="MOU-001",
                name="Logitech MX Master 3",
                category="Периферія",
                unit_price=4200.0,
                current_stock=50.0,
                min_stock=10.0,
                daily_demand=2.0,
                lead_time_days=4,
                supplier_name="Logi Distro"
            )
        ]

        radar = generate_procurement_radar(products=products)
        self.assertEqual(radar.total_items_count, 2)
        # LAP-001 has current_stock 1.0, days_to_depletion < 1 day -> urgent
        self.assertGreaterEqual(radar.urgent_count, 1)
        self.assertGreater(radar.total_recommended_procurement_cost, 0.0)

        item_lap = next(it for it in radar.items if it.sku == "LAP-001")
        self.assertEqual(item_lap.status_code, "urgent")
        self.assertGreater(item_lap.recommended_order_qty, 0.0)

        item_mou = next(it for it in radar.items if it.sku == "MOU-001")
        self.assertEqual(item_mou.status_code, "norm")
        self.assertEqual(item_mou.recommended_order_qty, 0.0)


if __name__ == "__main__":
    unittest.main()
