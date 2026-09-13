import datetime
import numpy as np
from typing import List, Dict, Any
from models.schemas import HistoricalPoint

BENCHMARK_PRODUCTS = [
    {
        "id": 1,
        "sku": "EL-001",
        "name": "Ноутбук Pro 15.6\" i7/16/512",
        "category": "Електроніка",
        "price": 34500.0,
        "current_stock": 14.0,
        "daily_demand": 1.8,
        "daily_demand_std": 0.9,
        "lead_time_days": 7,
        "lead_time_std": 1.2,
        "old_min_stock": 10.0,
        "dynamic_ss": 4.0,
        "rop": 17.0,
        "eoq": 12.0,
        "supplier": "ТОВ \"ТехноДистриб'юшн\"",
        "demand_pattern": "cyclical",
    },
    {
        "id": 2,
        "sku": "EL-002",
        "name": "Бездротова миша Optical",
        "category": "Електроніка",
        "price": 650.0,
        "current_stock": 42.0,
        "daily_demand": 14.5,
        "daily_demand_std": 3.8,
        "lead_time_days": 5,
        "lead_time_std": 0.8,
        "old_min_stock": 30.0,
        "dynamic_ss": 14.0,
        "rop": 87.0,
        "eoq": 95.0,
        "supplier": "ТОВ \"АйТі-Опт\"",
        "demand_pattern": "high_stable",
    },
    {
        "id": 3,
        "sku": "EL-003",
        "name": "Монітор 27\" IPS 144Hz",
        "category": "Електроніка",
        "price": 8900.0,
        "current_stock": 31.0,
        "daily_demand": 3.2,
        "daily_demand_std": 1.4,
        "lead_time_days": 7,
        "lead_time_std": 1.0,
        "old_min_stock": 15.0,
        "dynamic_ss": 6.0,
        "rop": 29.0,
        "eoq": 22.0,
        "supplier": "ТОВ \"ТехноДистриб'юшн\"",
        "demand_pattern": "weekend_peaks",
    },
    {
        "id": 4,
        "sku": "CM-101",
        "name": "Кабель мережевий UTP Cat5e 305м",
        "category": "Витратні матеріали",
        "price": 2400.0,
        "current_stock": 18.0,
        "daily_demand": 8.0,
        "daily_demand_std": 2.6,
        "lead_time_days": 4,
        "lead_time_std": 0.5,
        "old_min_stock": 20.0,
        "dynamic_ss": 9.0,
        "rop": 41.0,
        "eoq": 48.0,
        "supplier": "ПП \"КабельСпецМонтаж\"",
        "demand_pattern": "corporate_weekday",
    },
    {
        "id": 5,
        "sku": "AU-055",
        "name": "Мастило моторне 5W-40 4л",
        "category": "Автотовари",
        "price": 1450.0,
        "current_stock": 52.0,
        "daily_demand": 6.4,
        "daily_demand_std": 2.1,
        "lead_time_days": 6,
        "lead_time_std": 1.1,
        "old_min_stock": 25.0,
        "dynamic_ss": 9.0,
        "rop": 48.0,
        "eoq": 44.0,
        "supplier": "ТОВ \"АвтоТрейд Груп\"",
        "demand_pattern": "seasonal_trend",
    },
    {
        "id": 6,
        "sku": "AU-089",
        "name": "Фільтр повітряний універсальний",
        "category": "Автотовари",
        "price": 380.0,
        "current_stock": 15.0,
        "daily_demand": 11.2,
        "daily_demand_std": 3.1,
        "lead_time_days": 3,
        "lead_time_std": 0.4,
        "old_min_stock": 20.0,
        "dynamic_ss": 9.0,
        "rop": 43.0,
        "eoq": 62.0,
        "supplier": "ТОВ \"АвтоТрейд Груп\"",
        "demand_pattern": "regular_stable",
    },
    {
        "id": 7,
        "sku": "TL-201",
        "name": "Шуруповерт акумуляторний 18V",
        "category": "Інструменти",
        "price": 3100.0,
        "current_stock": 40.0,
        "daily_demand": 4.1,
        "daily_demand_std": 1.8,
        "lead_time_days": 8,
        "lead_time_std": 1.5,
        "old_min_stock": 15.0,
        "dynamic_ss": 9.0,
        "rop": 42.0,
        "eoq": 28.0,
        "supplier": "ТОВ \"ІнструментМаркет\"",
        "demand_pattern": "weekend_heavy",
    },
    {
        "id": 8,
        "sku": "TL-205",
        "name": "Набір біт та свердел 45 шт",
        "category": "Інструменти",
        "price": 490.0,
        "current_stock": 94.0,
        "daily_demand": 12.8,
        "daily_demand_std": 3.5,
        "lead_time_days": 5,
        "lead_time_std": 0.9,
        "old_min_stock": 25.0,
        "dynamic_ss": 13.0,
        "rop": 77.0,
        "eoq": 85.0,
        "supplier": "ТОВ \"ІнструментМаркет\"",
        "demand_pattern": "concomitant_stable",
    },
    {
        "id": 9,
        "sku": "NT-301",
        "name": "Маршрутизатор Wi-Fi 6 AX3000",
        "category": "Мережеве обладнання",
        "price": 2850.0,
        "current_stock": 21.0,
        "daily_demand": 5.5,
        "daily_demand_std": 1.9,
        "lead_time_days": 6,
        "lead_time_std": 1.0,
        "old_min_stock": 15.0,
        "dynamic_ss": 8.0,
        "rop": 41.0,
        "eoq": 38.0,
        "supplier": "ТОВ \"Мережевий Світ\"",
        "demand_pattern": "linear_growth",
    },
    {
        "id": 10,
        "sku": "NT-304",
        "name": "Комутатор керований 24-Port PoE",
        "category": "Мережеве обладнання",
        "price": 11200.0,
        "current_stock": 12.0,
        "daily_demand": 0.8,
        "daily_demand_std": 0.5,
        "lead_time_days": 10,
        "lead_time_std": 2.0,
        "old_min_stock": 5.0,
        "dynamic_ss": 3.0,
        "rop": 11.0,
        "eoq": 6.0,
        "supplier": "ТОВ \"Мережевий Світ\"",
        "demand_pattern": "low_frequency_expensive",
    }
]

def generate_product_timeseries(product_meta: Dict[str, Any], days: int = 180) -> List[HistoricalPoint]:
    """
    Повертає реальний часовий ряд попиту для товару (з датасету реальних транзакцій UCI Online Retail)
    або генерує його у разі відсутності ретроспективи.
    """
    if "history" in product_meta and len(product_meta["history"]) > 0:
        raw_hist = product_meta["history"][-days:]
        return [HistoricalPoint(date=p["date"], actual_quantity=float(p["actual_quantity"])) for p in raw_hist]

    np.random.seed(42 + int(product_meta["id"]))
    base_demand = float(product_meta["daily_demand"])
    std = float(product_meta["daily_demand_std"])
    pattern = product_meta.get("demand_pattern", "regular_stable")
    
    end_date = datetime.date.today() - datetime.timedelta(days=1)
    start_date = end_date - datetime.timedelta(days=days - 1)
    
    points: List[HistoricalPoint] = []
    
    for i in range(days):
        current_date = start_date + datetime.timedelta(days=i)
        weekday = current_date.weekday()  # 0: Monday, ..., 6: Sunday
        
        # Базове значення
        val = base_demand
        
        # Щотижнева сезонність
        if pattern == "weekend_heavy" or pattern == "weekend_peaks":
            if weekday in (4, 5):  # П'ятниця, субота
                val *= 1.45
            elif weekday == 6:     # Неділя
                val *= 1.30
            else:
                val *= 0.85
        elif pattern == "corporate_weekday":
            if weekday in (0, 1, 2, 3):  # Пн-Чт
                val *= 1.25
            elif weekday == 4:           # Пт
                val *= 1.10
            else:                        # Вихідні
                val *= 0.35
        else:
            # Невелика сезонність дня тижня (середина тижня активніша)
            day_factors = [0.95, 1.05, 1.15, 1.10, 1.05, 0.90, 0.80]
            val *= day_factors[weekday]
            
        # Тренд
        if pattern == "linear_growth":
            val += (i / days) * 1.8
        elif pattern == "seasonal_trend":
            val += np.sin(2 * np.pi * i / 90) * 1.5
            
        # Додавання нормального стохастичного шуму
        noise = np.random.normal(0, std)
        val = max(0.0, round(val + noise, 1))
        
        points.append(HistoricalPoint(
            date=current_date.isoformat(),
            actual_quantity=val
        ))
        
    return points

import os
import json

def load_active_products() -> List[Dict[str, Any]]:
    json_path = os.path.join(os.path.dirname(__file__), "..", "data", "uci_online_retail_real.json")
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if data and len(data) > 0:
                    return data
        except Exception:
            pass
    return BENCHMARK_PRODUCTS

def get_all_benchmark_products() -> List[Dict[str, Any]]:
    return load_active_products()

def get_benchmark_by_id(product_id: Any) -> Dict[str, Any]:
    prods = load_active_products()
    id_str = str(product_id).strip().lower()
    for p in prods:
        if str(p["id"]) == id_str or p["sku"].lower() == id_str:
            return p
    try:
        idx = int(product_id)
        for p in prods:
            if p["id"] == idx:
                return p
    except Exception:
        pass
    return prods[0]

def get_benchmark_by_sku(sku: str) -> Dict[str, Any]:
    prods = load_active_products()
    for p in prods:
        if p["sku"].lower() == sku.lower():
            return p
    return prods[0]
