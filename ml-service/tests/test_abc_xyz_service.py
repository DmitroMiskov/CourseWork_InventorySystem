import unittest
from models.schemas import WarehouseProductInput
from services.abc_xyz_service import calculate_abc_xyz, STRATEGIES

class TestAbcXyzService(unittest.TestCase):

    def test_calculate_abc_xyz_fallback_benchmarks(self):
        # When products is None, uses the 12 benchmark products from UCI dataset
        response = calculate_abc_xyz(products=None, period_days=180)
        self.assertEqual(response.total_products, 12)
        self.assertGreater(response.total_revenue, 0.0)
        self.assertEqual(len(response.items), 12)
        
        # Verify cumulative shares are monotonically increasing up to 100%
        prev_cum = 0.0
        for item in response.items:
            self.assertGreaterEqual(item.cumulative_share_percent, prev_cum)
            prev_cum = item.cumulative_share_percent
            self.assertIn(item.abc_class, ["A", "B", "C"])
            self.assertIn(item.xyz_class, ["X", "Y", "Z"])
            self.assertEqual(item.matrix_cell, f"{item.abc_class}{item.xyz_class}")
            self.assertIn(item.matrix_cell, STRATEGIES)
            self.assertEqual(item.strategy_recommendation, STRATEGIES[item.matrix_cell])

        self.assertAlmostEqual(prev_cum, 100.0, delta=1.0)

    def test_calculate_abc_xyz_custom_products_pareto(self):
        # 3 products:
        # High revenue (A)
        # Medium revenue (B)
        # Low revenue (C)
        products = [
            WarehouseProductInput(
                product_id="prod-high",
                sku="SRV-001",
                name="Server Rack Unit",
                category="Сервери",
                unit_price=7000.0,
                daily_demand=1.0,
                current_stock=10.0
            ),
            WarehouseProductInput(
                product_id="prod-med",
                sku="MON-001",
                name="Office Monitor 24\"",
                category="Монітори",
                unit_price=2000.0,
                daily_demand=1.0,
                current_stock=30.0
            ),
            WarehouseProductInput(
                product_id="prod-low",
                sku="CAB-001",
                name="Patch Cord 1m",
                category="Периферія",
                unit_price=1000.0,
                daily_demand=1.0,
                current_stock=200.0
            )
        ]

        response = calculate_abc_xyz(products=products, period_days=100)
        self.assertEqual(response.total_products, 3)

        # First item should be the highest revenue item (SRV-001)
        self.assertEqual(response.items[0].sku, "SRV-001")
        self.assertEqual(response.items[0].abc_class, "A")

        # Second item should be MON-001
        self.assertEqual(response.items[1].sku, "MON-001")
        self.assertIn(response.items[1].abc_class, ["A", "B"])

        # Third item should be CAB-001
        self.assertEqual(response.items[2].sku, "CAB-001")
        self.assertEqual(response.items[2].abc_class, "C")

        # Matrix counts check
        total_cells_count = sum(response.matrix_counts.values())
        self.assertEqual(total_cells_count, 3)

    def test_strategies_completeness(self):
        expected_cells = [f"{a}{x}" for a in ["A", "B", "C"] for x in ["X", "Y", "Z"]]
        for cell in expected_cells:
            self.assertIn(cell, STRATEGIES)
            self.assertTrue(len(STRATEGIES[cell]) > 10)


if __name__ == "__main__":
    unittest.main()
