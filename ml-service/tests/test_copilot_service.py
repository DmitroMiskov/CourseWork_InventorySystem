import unittest
from models.schemas import WarehouseProductInput, CopilotChatRequest
from services.copilot_service import (
    detect_product_in_query,
    detect_supplier_in_query,
    build_warehouse_system_context,
    generate_offline_heuristic_reply,
    process_chat_message
)

class TestCopilotService(unittest.TestCase):

    def setUp(self):
        self.products = [
            WarehouseProductInput(
                product_id="prod-gpu",
                sku="GPU-4070-OC",
                name="ASUS GeForce RTX 4070 Dual OC 12GB",
                category="Комплектуючі",
                unit_price=28000.0,
                current_stock=1.0,
                min_stock=5.0,
                daily_demand=1.0,
                lead_time_days=6,
                supplier_name="ТОВ \"АйТі-Опт\""
            ),
            WarehouseProductInput(
                product_id="prod-nb",
                sku="NB-LEN-TP",
                name="Lenovo ThinkPad E16 Gen 1",
                category="Ноутбуки",
                unit_price=42000.0,
                current_stock=10.0,
                min_stock=4.0,
                daily_demand=0.5,
                lead_time_days=7,
                supplier_name="ТОВ \"ТехноДистриб'юшн\""
            ),
            WarehouseProductInput(
                product_id="prod-ssd",
                sku="SSD-SAM-990",
                name="Samsung 990 PRO 2TB NVMe",
                category="Комплектуючі",
                unit_price=8500.0,
                current_stock=25.0,
                min_stock=5.0,
                daily_demand=1.5,
                lead_time_days=6,
                supplier_name="ТОВ \"АйТі-Опт\""
            )
        ]
        self.context = build_warehouse_system_context(self.products)

    def test_detect_product_in_query_by_sku(self):
        # Case insensitive SKU match
        matched = detect_product_in_query("Яка ситуація по gpu-4070-oc на складі?", self.products)
        self.assertIsNotNone(matched)
        self.assertEqual(matched.sku, "GPU-4070-OC")

    def test_detect_product_in_query_by_keywords(self):
        # Search by RTX / 4070 keyword
        matched = detect_product_in_query("Поясни статус для RTX 4070", self.products)
        self.assertIsNotNone(matched)
        self.assertEqual(matched.sku, "GPU-4070-OC")

        # Search by thinkpad keyword
        matched_nb = detect_product_in_query("Чи достатньо у нас thinkpad ноутбуків?", self.products)
        self.assertIsNotNone(matched_nb)
        self.assertEqual(matched_nb.sku, "NB-LEN-TP")

        # Search with no match
        unmatched = detect_product_in_query("Скільки яблук на складі?", self.products)
        self.assertIsNone(unmatched)

    def test_detect_supplier_in_query(self):
        # Known supplier name in query
        supp = detect_supplier_in_query("Зв'яжися з ТОВ АйТі-Опт щодо поставки", self.products, self.context["radar"].items)
        self.assertIsNotNone(supp)
        self.assertIn("АйТі-Опт", supp)

        # Supplier in quotes
        supp_quote = detect_supplier_in_query("Напиши лист постачальнику \"Електронік-Світ\"", self.products, self.context["radar"].items)
        self.assertEqual(supp_quote, "Електронік-Світ")

    def test_generate_offline_heuristic_reply_explain_product(self):
        query = "Чому для RTX 4070 призначено такий статус?"
        reply, intent, actions = generate_offline_heuristic_reply(query, self.products, self.context)

        self.assertEqual(intent, "explain_product")
        self.assertIn("Аналітична картка товару", reply)
        self.assertIn("RTX 4070", reply)
        # Should contain actions to open forecast and open radar
        action_types = [a.action_type for a in actions]
        self.assertIn("open_forecast", action_types)
        self.assertIn("open_radar", action_types)

    def test_generate_offline_heuristic_reply_urgent_procurement(self):
        query = "Що сьогодні треба терміново замовити?"
        reply, intent, actions = generate_offline_heuristic_reply(query, self.products, self.context)

        self.assertEqual(intent, "urgent_procurement")
        self.assertIn("Аудит дефіциту", reply)
        action_types = [a.action_type for a in actions]
        self.assertIn("open_radar", action_types)

    def test_generate_offline_heuristic_reply_supplier_draft(self):
        query = "Склади офіційний лист постачальнику на замовлення"
        reply, intent, actions = generate_offline_heuristic_reply(query, self.products, self.context)

        self.assertEqual(intent, "supplier_draft")
        self.assertIn("Шановні партнери!", reply)
        action_types = [a.action_type for a in actions]
        self.assertIn("download_pdf", action_types)
        self.assertIn("copy_text", action_types)

    def test_generate_offline_heuristic_reply_abc_analysis(self):
        query = "Які товари входять до групи А за правилом Парето?"
        reply, intent, actions = generate_offline_heuristic_reply(query, self.products, self.context)

        self.assertEqual(intent, "abc_xyz_analysis")
        self.assertIn("Матриця ABC-XYZ", reply)
        action_types = [a.action_type for a in actions]
        self.assertIn("open_abc", action_types)

    def test_generate_offline_heuristic_reply_general_help(self):
        query = "Добрий день! Що ти вмієш?"
        reply, intent, actions = generate_offline_heuristic_reply(query, self.products, self.context)

        self.assertEqual(intent, "help")
        self.assertIn("Warehouse AI Copilot", reply)
        self.assertTrue(len(actions) > 0)

    def test_process_chat_message_offline_end_to_end(self):
        req = CopilotChatRequest(
            message="Покажи дефіцитні позиції",
            provider="offline",
            products=self.products
        )
        resp = process_chat_message(req)
        self.assertEqual(resp.intent, "urgent_procurement")
        self.assertIn("Warehouse DSS Cognitive Engine", resp.model_used)
        self.assertTrue(len(resp.actions) > 0)


if __name__ == "__main__":
    unittest.main()
