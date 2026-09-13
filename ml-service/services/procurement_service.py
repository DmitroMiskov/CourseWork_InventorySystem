import math
import datetime
from typing import List, Optional
from models.schemas import (
    ProcurementRadarItem, 
    ProcurementRadarResponse,
    WarehouseProductInput
)
from services.dataset_service import get_all_benchmark_products

def calculate_safety_stock(
    daily_demand: float,
    daily_demand_std: float,
    lead_time_days: int,
    lead_time_std: float = 1.0,
    service_level_z: float = 1.65
) -> float:
    """
    Динамічний розрахунок страхового запасу:
    SS = Z * sqrt( L * sigma_D^2 + D_avg^2 * sigma_L^2 )
    """
    variance_demand = lead_time_days * (daily_demand_std ** 2)
    variance_lead_time = (daily_demand ** 2) * (lead_time_std ** 2)
    total_std = math.sqrt(variance_demand + variance_lead_time)
    ss = service_level_z * total_std
    return max(1.0, float(round(ss)))

def calculate_reorder_point(daily_demand: float, lead_time_days: int, safety_stock: float) -> float:
    """
    Точка перезамовлення:
    ROP = (D_daily * L) + SS
    """
    rop = (daily_demand * lead_time_days) + safety_stock
    return float(round(rop))

def calculate_eoq(
    annual_demand: float,
    order_cost_s: float = 500.0,
    holding_cost_h: float = 50.0
) -> float:
    """
    Формула Уілсона (EOQ):
    EOQ = sqrt( (2 * D * S) / H )
    """
    if holding_cost_h <= 0:
        holding_cost_h = 10.0
    val = (2 * annual_demand * order_cost_s) / holding_cost_h
    eoq = math.sqrt(max(1.0, val))
    return max(1.0, float(round(eoq)))

def evaluate_stock_status(current_stock: float, rop: float, safety_stock: float, days_to_depletion: float, lead_time_days: int):
    """
    Визначення статусу критичності товару на складі:
    - ТЕРМІНОВО (urgent): нульовий залишок або вичерпання <= 2 днів
    - КРИТИЧНО (critical): залишок нижче ROP і вичерпання <= часу поставки
    - УВАГА (warning): залишок нижче або дорівнює ROP
    - НОРМА (norm): запас повністю покриває плановий період
    """
    if current_stock == 0.0 or days_to_depletion <= 2.0 or current_stock <= (safety_stock * 0.5):
        return "ТЕРМІНОВО", "urgent"
    elif current_stock < rop and days_to_depletion <= lead_time_days:
        return "КРИТИЧНО", "critical"
    elif current_stock <= rop:
        return "УВАГА (нижче ROP)", "warning"
    else:
        return "НОРМА", "norm"

def get_category_logistics_meta(category: str):
    """
    Визначає логістичні параметри (термін доставки та постачальника) залежно від категорії.
    """
    cat = (category or "").lower()
    if any(k in cat for k in ["ноутбук", "laptop", "комп'ютер"]):
        return 7, 1.0, "ТОВ \"ТехноДистриб'юшн\""
    elif any(k in cat for k in ["смартфон", "телефон", "phone"]):
        return 5, 0.8, "ТОВ \"СмартТрейд Україна\""
    elif any(k in cat for k in ["монітор", "дисплей", "monitor"]):
        return 6, 1.0, "ТОВ \"Дисплей-Плюс\""
    elif any(k in cat for k in ["перифер", "миша", "клавіатур", "гарнітур"]):
        return 4, 0.7, "ТОВ \"Гаджет-Снаб\""
    elif any(k in cat for k in ["комплектуюч", "ssd", "ram", "відеокарт"]):
        return 6, 1.0, "ТОВ \"АйТі-Опт\""
    elif any(k in cat for k in ["мереж", "роутер", "комутатор", "кабель"]):
        return 4, 0.5, "ПП \"КабельСпецМонтаж\""
    elif any(k in cat for k in ["офіс", "принтер", "бфп", "ups", "живленн"]):
        return 5, 0.8, "ТОВ \"Офіс-Трейд\""
    else:
        return 5, 0.9, "ТОВ \"ПостачТрейд\""

def generate_procurement_radar(
    custom_items: Optional[List[ProcurementRadarItem]] = None,
    products: Optional[List[WarehouseProductInput]] = None,
    service_level_z: float = 1.65,
    order_cost_s: float = 500.0,
    holding_rate: float = 0.20
) -> ProcurementRadarResponse:
    """
    Генерує повну зведену таблицю 'Радар закупівель'.
    Приймає товари з власної бази даних складу (PostgreSQL) та застосовує
    навчені на реальному датасеті UCI Online Retail статистичні патерни
    попиту, розраховуючи динамічні показники SS, ROP, EOQ.
    """
    raw_items: List[ProcurementRadarItem] = []

    if products and len(products) > 0:
        # Обробка реальних товарів з бази даних складу
        for wp in products:
            price = float(wp.unit_price)
            current_stock = float(wp.current_stock)
            min_stock = float(wp.min_stock if wp.min_stock is not None and wp.min_stock > 0 else 3.0)
            
            # Логістичні параметри постачання
            lead_time, lead_std, default_supplier = get_category_logistics_meta(wp.category)
            if wp.lead_time_days is not None and wp.lead_time_days > 0:
                lead_time = int(wp.lead_time_days)
            supplier_name = wp.supplier_name if wp.supplier_name else default_supplier

            # Оцінка середньоденного попиту (D_daily) та варіації (D_std):
            # Переносимо закономірності роздрібного датасету UCI:
            # коефіцієнт варіації CV для складських товарів становить ~32%
            if wp.daily_demand is not None and wp.daily_demand > 0:
                d_daily = float(wp.daily_demand)
                d_std = max(0.2, round(d_daily * 0.32, 2))
            elif wp.history and len(wp.history) >= 7:
                hist_vals = [h.quantity for h in wp.history]
                d_daily = max(0.5, round(float(sum(hist_vals) / len(hist_vals)), 2))
                d_std = max(0.2, round(float(math.sqrt(sum((x - d_daily) ** 2 for x in hist_vals) / len(hist_vals))), 2))
            else:
                # Калібрування попиту на основі нормативу обіговості MinStock
                d_daily = max(0.5, round(min_stock / 2.5, 2))
                d_std = max(0.2, round(d_daily * 0.32, 2))

            # Розрахунок страхового запасу SS, точки перезамовлення ROP, EOQ
            ss = calculate_safety_stock(d_daily, d_std, lead_time, lead_std, service_level_z)
            rop = calculate_reorder_point(d_daily, lead_time, ss)

            annual_demand = d_daily * 365.0
            holding_cost_h = max(10.0, price * holding_rate)
            eoq = calculate_eoq(annual_demand, order_cost_s, holding_cost_h)

            days_to_depletion = round(current_stock / d_daily, 1) if d_daily > 0 else 999.0
            status_text, status_code = evaluate_stock_status(current_stock, rop, ss, days_to_depletion, lead_time)

            if current_stock <= rop:
                recommended_qty = eoq
                order_cost = round(recommended_qty * price, 2)
            else:
                recommended_qty = 0.0
                order_cost = 0.0

            raw_items.append(ProcurementRadarItem(
                product_id=wp.product_id,
                sku=wp.sku,
                name=wp.name,
                category=wp.category or "Загальне",
                unit_price=price,
                current_stock=current_stock,
                daily_demand=d_daily,
                daily_demand_std=d_std,
                lead_time_days=lead_time,
                lead_time_std=lead_std,
                safety_stock=ss,
                reorder_point=rop,
                eoq=eoq,
                days_to_depletion=days_to_depletion,
                status=status_text,
                status_code=status_code,
                recommended_order_qty=recommended_qty,
                estimated_order_cost=order_cost,
                supplier_name=supplier_name
            ))

    elif custom_items and len(custom_items) > 0:
        raw_items = custom_items
    else:
        # Fallback: Використовуємо еталонні товари з дослідження
        benchmark_list = get_all_benchmark_products()
        for p in benchmark_list:
            d_daily = float(p["daily_demand"])
            d_std = float(p["daily_demand_std"])
            lead_time = int(p["lead_time_days"])
            lead_std = float(p.get("lead_time_std", 1.0))
            price = float(p["price"])
            current_stock = float(p["current_stock"])

            ss = calculate_safety_stock(d_daily, d_std, lead_time, lead_std, service_level_z)
            rop = calculate_reorder_point(d_daily, lead_time, ss)

            annual_demand = d_daily * 365.0
            holding_cost_h = max(5.0, price * holding_rate)
            eoq = calculate_eoq(annual_demand, order_cost_s, holding_cost_h)

            if "dynamic_ss" in p:
                ss = float(p["dynamic_ss"])
            if "rop" in p:
                rop = float(p["rop"])
            if "eoq" in p:
                eoq = float(p["eoq"])

            days_to_depletion = round(current_stock / d_daily, 1) if d_daily > 0 else 999.0
            status_text, status_code = evaluate_stock_status(current_stock, rop, ss, days_to_depletion, lead_time)

            if current_stock <= rop:
                recommended_qty = eoq
                order_cost = round(recommended_qty * price, 2)
            else:
                recommended_qty = 0.0
                order_cost = 0.0

            raw_items.append(ProcurementRadarItem(
                product_id=p["id"],
                sku=p["sku"],
                name=p["name"],
                category=p["category"],
                unit_price=price,
                current_stock=current_stock,
                daily_demand=d_daily,
                daily_demand_std=d_std,
                lead_time_days=lead_time,
                lead_time_std=lead_std,
                safety_stock=ss,
                reorder_point=rop,
                eoq=eoq,
                days_to_depletion=days_to_depletion,
                status=status_text,
                status_code=status_code,
                recommended_order_qty=recommended_qty,
                estimated_order_cost=order_cost,
                supplier_name=p.get("supplier", "ТОВ \"ПостачТрейд\"")
            ))

    urgent_c = sum(1 for x in raw_items if x.status_code == "urgent")
    critical_c = sum(1 for x in raw_items if x.status_code == "critical")
    warning_c = sum(1 for x in raw_items if x.status_code == "warning")
    norm_c = sum(1 for x in raw_items if x.status_code == "norm")
    total_cost = sum(x.estimated_order_cost for x in raw_items)

    return ProcurementRadarResponse(
        generated_at=datetime.datetime.now().isoformat(),
        service_level_z=service_level_z,
        total_items_count=len(raw_items),
        urgent_count=urgent_c,
        critical_count=critical_c,
        warning_count=warning_c,
        norm_count=norm_c,
        total_recommended_procurement_cost=round(total_cost, 2),
        items=raw_items
    )
