import os
import re
import json
import datetime
import urllib.request
import urllib.error
from typing import List, Optional, Tuple, Dict, Any

from models.schemas import (
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotAction,
    WarehouseProductInput
)
from services.procurement_service import generate_procurement_radar
from services.abc_xyz_service import calculate_abc_xyz
from services.dataset_service import get_all_benchmark_products

def detect_product_in_query(query: str, products: List[WarehouseProductInput]) -> Optional[WarehouseProductInput]:
    """
    Знаходить товар у базі даних складу за згадкою в тексті запиту (SKU або ключові слова назви).
    """
    q_lower = query.lower()
    
    # 1. Пошук за прямим збігом артикулу SKU
    for p in products:
        if p.sku.lower() in q_lower:
            return p
            
    # 2. Пошук за ключовими словами у назві
    keywords_map = {
        "4070": "RTX 4070",
        "rtx": "RTX 4070",
        "відеокарт": "RTX 4070",
        "thinkpad": "ThinkPad",
        "lenovo": "ThinkPad",
        "tuf": "TUF Gaming",
        "macbook": "MacBook Air",
        "apple": "MacBook Air",
        "s24": "Galaxy S24",
        "galaxy": "Galaxy S24",
        "iphone": "iPhone 15 Pro",
        "redmi": "Redmi Note",
        "dell": "UltraSharp",
        "odyssey": "Odyssey G5",
        "logitech": "MX Master",
        "миш": "MX Master",
        "keychron": "Keychron",
        "клавіатур": "Keychron",
        "hyperx": "HyperX",
        "гарнітур": "HyperX",
        "990": "990 PRO",
        "ssd": "990 PRO",
        "kingston": "Kingston",
        "ram": "Kingston",
        "пам'ят": "Kingston",
        "mikrotik": "MikroTik",
        "роутер": "MikroTik",
        "tp-link": "TL-SG108",
        "комутатор": "TL-SG108",
        "canon": "MF3010",
        "принтер": "MF3010",
        "бфп": "MF3010",
        "apc": "Back-UPS",
        "ups": "Back-UPS",
        "безперебійн": "Back-UPS",
        "живленн": "Back-UPS",
        "патч-корд": "Патч-корд",
        "кабель": "Патч-корд",
        "arctic": "Arctic MX-4",
        "термопаст": "Arctic MX-4"
    }
    
    for kw, target_sub in keywords_map.items():
        if kw in q_lower:
            for p in products:
                if target_sub.lower() in p.name.lower() or target_sub.lower() in p.sku.lower():
                    return p
                    
    return None

def detect_supplier_in_query(
    query: str,
    products: List[WarehouseProductInput],
    radar_items: List[Any]
) -> Optional[str]:
    """
    Визначає назву постачальника із запиту користувача:
    1. Пошук збігів серед відомих постачальників зі складу.
    2. Витягнення назви з тексту запиту за патернами (лапки, форми власності ТОВ/ФОП/ПП, фрази).
    """
    q_lower = query.lower()
    
    # 1. Збираємо список усіх відомих постачальників з товарів
    known_suppliers = set()
    for p in products:
        if p.supplier_name and p.supplier_name.strip():
            known_suppliers.add(p.supplier_name.strip())
    for it in radar_items:
        if hasattr(it, 'supplier_name') and it.supplier_name and it.supplier_name.strip():
            known_suppliers.add(it.supplier_name.strip())
            
    # Сортуємо за спаданням довжини назви
    for supp in sorted(known_suppliers, key=len, reverse=True):
        supp_clean = supp.lower().replace('"', '').replace('«', '').replace('»', '').replace("'", "").strip()
        core_name = re.sub(r'^(тов|фоп|пп|пат|прат|llc|inc)\s+', '', supp_clean).strip()
        if supp_clean in q_lower:
            return supp
        if len(core_name) >= 3 and core_name in q_lower:
            return supp

    # 2. Якщо серед відомих немає, шукаємо у запиті за патернами
    # У лапках після постачальник
    quote_match = re.search(r'постачальни[ку|ка|ком]\s+["«\']([^"»\']+)["»\']', query, re.IGNORECASE)
    if quote_match:
        return quote_match.group(1).strip()
        
    # Будь-які лапки у запиті, якщо запит стосується постачальника
    if any(w in q_lower for w in ["постачальник", "партнер", "дистриб", "лист"]):
        any_quote = re.search(r'["«\']([^"»\']+)["»\']', query)
        if any_quote:
            return any_quote.group(1).strip()
            
    # Форма власності: постачальнику (ТОВ|ФОП|ПП|...) <Назва>
    org_match = re.search(r'постачальни[ку|ка|ком]\s+((?:тов|фоп|пп|пат|прат)\s+[A-Za-zА-Яа-яІіЇїЄє0-9_\-]+(?:\s+[A-Za-zА-Яа-яІіЇїЄє0-9_\-]+)?)', query, re.IGNORECASE)
    if org_match:
        return org_match.group(1).strip()
        
    # Загальний патерн: постачальнику <Слово/Фраза>
    general_match = re.search(r'постачальни[ку|ка|ком]\s+([A-Za-zА-Яа-яІіЇїЄє0-9_\-]+(?:\s+[A-Za-zА-Яа-яІіЇїЄє0-9_\-]+)?)', query, re.IGNORECASE)
    if general_match:
        candidate = general_match.group(1).strip()
        stop_words = ["на", "про", "щодо", "для", "по", "всіх", "дефіцитних", "термінових", "нових", "наших", "основному", "нашого", "товарів"]
        if candidate.lower() not in stop_words and not any(candidate.lower().startswith(sw + " ") for sw in stop_words):
            return candidate

    return None

def build_warehouse_system_context(products: List[WarehouseProductInput]) -> Dict[str, Any]:
    """
    Збирає структурований аналітичний контекст поточного стану складу:
    Радар закупівель (дефіцити), матрицю ABC-XYZ (виручка), категорії, постачальників та оцінку запасів.
    """
    radar = generate_procurement_radar(products=products)
    abc_xyz = calculate_abc_xyz(products=products, period_days=180)
    
    urgent_items = [it for it in radar.items if it.status_code == "urgent"]
    critical_items = [it for it in radar.items if it.status_code == "critical"]
    warning_items = [it for it in radar.items if it.status_code == "warning"]
    norm_items = [it for it in radar.items if it.status_code == "norm"]
    
    group_a_items = [it for it in abc_xyz.items if it.abc_class == "A"]

    total_valuation = sum(float(p.current_stock) * float(p.unit_price) for p in products)
    total_units = sum(float(p.current_stock) for p in products)

    # Категорії
    categories: Dict[str, Dict[str, Any]] = {}
    for p in products:
        c_name = p.category or "Загальне"
        if c_name not in categories:
            categories[c_name] = {"count": 0, "units": 0.0, "valuation": 0.0, "items": []}
        categories[c_name]["count"] += 1
        categories[c_name]["units"] += float(p.current_stock)
        categories[c_name]["valuation"] += float(p.current_stock) * float(p.unit_price)
        categories[c_name]["items"].append(p)

    # Постачальники
    suppliers: Dict[str, Dict[str, Any]] = {}
    for p in products:
        s_name = p.supplier_name or "ТОВ \"ПостачТрейд\""
        if s_name not in suppliers:
            suppliers[s_name] = {"count": 0, "valuation": 0.0, "items": []}
        suppliers[s_name]["count"] += 1
        suppliers[s_name]["valuation"] += float(p.current_stock) * float(p.unit_price)
        suppliers[s_name]["items"].append(p)

    out_of_stock = [p for p in products if float(p.current_stock) <= 0.0]
    top_expensive = sorted(products, key=lambda p: float(p.unit_price), reverse=True)[:5]
    top_stocked = sorted(products, key=lambda p: float(p.current_stock), reverse=True)[:5]
    
    return {
        "radar": radar,
        "abc_xyz": abc_xyz,
        "total_count": radar.total_items_count,
        "urgent_items": urgent_items,
        "critical_items": critical_items,
        "warning_items": warning_items,
        "norm_items": norm_items,
        "group_a_items": group_a_items,
        "total_order_cost": radar.total_recommended_procurement_cost,
        "total_revenue": abc_xyz.total_revenue,
        "total_valuation": total_valuation,
        "total_units": total_units,
        "categories": categories,
        "suppliers": suppliers,
        "out_of_stock": out_of_stock,
        "top_expensive": top_expensive,
        "top_stocked": top_stocked
    }

def generate_offline_heuristic_reply(
    query: str,
    products: List[WarehouseProductInput],
    context: Dict[str, Any]
) -> Tuple[str, str, List[CopilotAction]]:
    """
    Автономний евристичний рушій на основі правил логістичного аналізу (Offline NLP Engine).
    Працює без доступу до Інтернету, гарантуючи 100% працездатність на захисті дипломного проєкту.
    """
    q_lower = query.lower()
    actions: List[CopilotAction] = []
    
    # 1. Фінансова оцінка та вартість складу (Financial Valuation & Inventory Balance)
    if any(w in q_lower for w in ["вартіст", "баланс", "капітал", "оцінк", "коштує склад", "грошей у товар", "актив", "сума складу", "інвентарн"]):
        total_val = context["total_valuation"]
        total_units = context["total_units"]
        total_skus = context["total_count"]
        cats = context["categories"]
        
        reply = "### 💰 Фінансово-інвентарна оцінка складу\n\n"
        reply += f"• **Загальна балансова вартість запасів**: **{total_val:,.2f} ₴**\n"
        reply += f"• **Сукупна фізична кількість товару**: **{total_units:,.0f} шт.**\n"
        reply += f"• **Активна номенклатура (SKU)**: **{total_skus} найменувань**\n\n"
        
        reply += "#### 📊 Розподіл замороженого капіталу за категоріями:\n"
        # Сортуємо категорії за капіталізацією
        sorted_cats = sorted(cats.items(), key=lambda c: c[1]["valuation"], reverse=True)
        for cat_name, c_data in sorted_cats:
            share = (c_data["valuation"] / total_val * 100.0) if total_val > 0 else 0.0
            reply += f"• **{cat_name}**: **{c_data['valuation']:,.2f} ₴** ({share:.1f}%) — {c_data['count']} SKU ({c_data['units']:,.0f} шт)\n"
            
        reply += "\n#### 💎 Топ-3 найцінніших позицій за замороженим капіталом:\n"
        top_val_items = sorted(products, key=lambda p: float(p.current_stock) * float(p.unit_price), reverse=True)[:3]
        for idx, p in enumerate(top_val_items, 1):
            pos_val = float(p.current_stock) * float(p.unit_price)
            reply += f"{idx}. **{p.name}** (`{p.sku}`): {p.current_stock} шт × {p.unit_price:,.2f} ₴ = **{pos_val:,.2f} ₴**\n"
            
        actions.append(CopilotAction(
            label="📦 Переглянути залишки товарів",
            action_type="open_stock"
        ))
        actions.append(CopilotAction(
            label="📑 Відкрити аналітичні звіти",
            action_type="open_reports"
        ))
        actions.append(CopilotAction(
            label="🎯 Перевірити потреби в Радарі",
            action_type="open_radar"
        ))
        return reply, "inventory_valuation", actions

    # 2. Мультискладський облік та внутрішні переміщення (Multi-Warehouse & Transfers)
    if any(w in q_lower for w in ["мультисклад", "складів", "переміщенн", "трансфер", "філі", "розподільч", "головний склад", "регіональн", "між складами", "як перемістити", "складами"]):
        reply = "### 🏢 Мультискладський облік та логістичні переміщення\n\n"
        reply += "Система підтримує повноцінну ієрархічну мережу складів та розподільчих центрів:\n\n"
        reply += "1. **Головний розподільчий склад (Central Hub)**:\n"
        reply += "   • Акумулює основний страховий запас ($SS$) та приймає оптові поставки від постачальників.\n"
        reply += "   • Здійснює постачання на регіональні філії за моделлю *Hub-and-Spoke*.\n\n"
        reply += "2. **Регіональні склади та магазини (Branches)**:\n"
        reply += "   • Обслуговують локальний споживчий попит та підтримують нормативний залишок на рівні точки перезамовлення ($ROP$).\n\n"
        reply += "3. **Життєвий цикл внутрішнього переміщення (Stock Transfer)**:\n"
        reply += "   • `Draft` (Чернетка) — формування накладної переміщення між складами-відправниками та одержувачами.\n"
        reply += "   • `InTransit` (В дорозі) — товар списується зі складу відправлення та резервується в дорозі, унеможливлюючи подвійний облік.\n"
        reply += "   • `Received` (Отримано) — фіксація прийому товару комірником цільового складу та зарахування на баланс.\n"
        reply += "   • `Cancelled` (Скасовано) — повернення зарезервованого товару у вільний залишок складу відправлення.\n\n"
        reply += "💡 *Ви можете перемикати активний робочий простір складу у верхній панелі інтерфейсу або перейти до журналу переміщень.*"
        
        actions.append(CopilotAction(
            label="🏢 Керування складами",
            action_type="open_warehouses"
        ))
        actions.append(CopilotAction(
            label="🚚 Внутрішні переміщення",
            action_type="open_transfers"
        ))
        return reply, "multi_warehouse", actions

    # 3. Замовлення на закупівлю (Purchase Orders Lifecycle)
    if any(w in q_lower for w in ["purchase order", "замовлення на закупівлю", "замовлень на закупівлю", "закупівл", "статус замовлення", "життєвий цикл замовлення", "як створити замовлення", "порядок закупівлі"]):
        reply = "### 🛒 Модуль замовлень на закупівлю (Purchase Orders)\n\n"
        reply += "Модуль замовлень на закупівлю автоматизує взаємодію з постачальниками та оприбуткування:\n\n"
        reply += "• **Етапи життєвого циклу замовлення**:\n"
        reply += "  1. `Draft` (Чернетка) — формування списку позицій із фіксацією договірної ціни за одиницю та авторозрахунком підсумкової вартості.\n"
        reply += "  2. `Approved` (Схвалено) — верифікація бюджету керівником відділу постачання.\n"
        reply += "  3. `SentToSupplier` (Відправлено постачальнику) — генерація офіційного листа/PDF та відправка контрагенту.\n"
        reply += "  4. `Received` (Отримано / Оприбутковано) — автоматичне оприбуткування партії на вибраний склад з оновленням залишків та записом у журнал аудиту.\n"
        reply += "  5. `Cancelled` (Скасовано) — анулювання замовлення без зміни залишків.\n\n"
        reply += "⚡ **Пряма інтеграція з Радаром закупівель**:\n"
        reply += "Рекомендовані Радаром дефіцитні позиції можна автоматично імпортувати в нове замовлення в 1 клік!"
        
        actions.append(CopilotAction(
            label="🛒 Журнал замовлень на закупівлю",
            action_type="open_purchase_orders"
        ))
        actions.append(CopilotAction(
            label="🎯 Радар закупівель",
            action_type="open_radar"
        ))
        return reply, "purchase_orders", actions

    # 4. Машинне навчання та прогнозні моделі (ML Forecasting Models & Hybrid Ensemble)
    if any(w in q_lower for w in ["машинне навчання", "модел", "prophet", "lightgbm", "ансамбл", "гібридн", "як працює прогноз", "прогнозуванн", "алгоритм", "holt-winters", "ridge", "метрики", "mape", "rmse", "r2", "r²", "довірчий інтервал"]):
        reply = "### 🧠 Архітектура інтелектуального ML-прогнозування попиту\n\n"
        reply += "Система використовує **гібридний адаптивний стек із 4 прогностичних моделей**:\n\n"
        reply += "1. **Holt-Winters (Трьохпараметричне експоненційне згладжування)**:\n"
        reply += "   • Моделює базовий рівень ($\alpha$), лінійний тренд ($\beta$) та тижневу адитивну сезонність ($\gamma$, $m=7$).\n"
        reply += "   • Ідеально підходить для товарів із вираженими днями пікового попиту (наприклад, п'ятниця-субота).\n\n"
        reply += "2. **LightGBM (Градієнтний бустинг дерев рішень)**:\n"
        reply += "   • Будує високоточну нелінійну регресію з використанням 20+ інженерних ознак: часові лаги (Lags 1, 7, 14, 28, 30), ковзні середні, дисперсії та мін/макс за вікнами 7, 14, 30 днів.\n\n"
        reply += "3. **Prophet (Адитивна регресійна модель Meta)**:\n"
        reply += "   • Декомпонує часовий ряд на тренд із точками перелому, тижневу/місячну сезонність та **календар державних свят України (`UA`)**.\n\n"
        reply += "4. **Ridge Regression (L2-регуляризована лінійна модель)**:\n"
        reply += "   • Надійний бейзлайн для захисту від перенавчання (overfitting).\n\n"
        reply += "🎯 **Адаптивний гібридний ансамбль (Adaptive Hybrid Ensemble)**:\n"
        reply += "Моделі автоматично комбінуються за схемою зважування, обернено пропорційного валідаційній помилці RMSE ($w_m \\propto 1 / \\text{RMSE}_m$). "
        reply += "Розраховуються метрики точності **MAPE**, **RMSE**, **$R^2$**, а також **95% довірчий інтервал** прогнозу ($\\pm 1.96 \\cdot \\text{RMSE}$)."
        
        actions.append(CopilotAction(
            label="📈 Відкрити ML-прогнозування",
            action_type="open_forecast"
        ))
        actions.append(CopilotAction(
            label="🔮 What-If моделювання",
            action_type="open_what_if"
        ))
        return reply, "ml_models_explanation", actions

    # 5. Пояснювальний ШІ та What-If аналіз (Explainable AI TreeSHAP & Scenario Simulation)
    if any(w in q_lower for w in ["shap", "xai", "what-if", "сценар", "еластичн", "чутливіст", "симуляц", "вплив ціни", "фактор впливу"]):
        reply = "### 🔮 Пояснювальний ШІ (TreeSHAP) та What-If моделювання\n\n"
        reply += "Для підтримки управлінських рішень впроваджено два інструменти аналітики:\n\n"
        reply += "1. **Explainable AI через TreeSHAP (SHapley Additive exPlanations)**:\n"
        reply += "   • Теорія кооперативних ігор дозволяє розкласти кожен прогноз $\\hat{y}$ на базове середнє $\\phi_0$ та індивідуальні внески ознак $\\phi_i$:\n"
        reply += "     $$\\hat{y} = \\phi_0 + \\sum \\phi_i$$\n"
        reply += "   • Ви бачите точний вплив: чому саме модель прогнозує ріст попиту (наприклад, сезонність $+35\\%$, маркетинг $+20\\%$, цінова еластичність $-10\\%$).\n\n"
        reply += "2. **What-If Симулятор сценаріїв**:\n"
        reply += "   • Дозволяє протестувати бізнес-гіпотези **до закупівлі товару**:\n"
        reply += "     - *Зміна роздрібної ціни* ($\Delta P$): розрахунок попиту з урахуванням коефіцієнта цінової еластичності.\n"
        reply += "     - *Проведення маркетингової акції*: симуляція припливу покупців (+15-50%).\n"
        reply += "     - *Сезонні сплески*: коригування потреби під святкові піки."
        
        actions.append(CopilotAction(
            label="🔮 Симулятор What-If сценаріїв",
            action_type="open_what_if"
        ))
        actions.append(CopilotAction(
            label="📈 ML-прогноз та SHAP",
            action_type="open_forecast"
        ))
        return reply, "explainable_ai_and_what_if", actions

    # 6. Логістичні формули та теорія запасів (Logistics Formulas & Inventory Theory)
    if any(w in q_lower for w in ["формул", "страховий запас", "safety stock", "як рахується", "як обчислюється", "rop", "eoq", "вільсон", "вілсон", "теорія запасів", "норматив запасу"]):
        reply = "### 📐 Класичні оптимізаційні формули управління запасами\n\n"
        reply += "Система використовує стандартні формули математичної логістики Wilson / Silver-Peterson:\n\n"
        reply += "1. **Динамічний страховий запас (Safety Stock, $SS$)**:\n"
        reply += "   $$SS = Z \\cdot \\sqrt{L \\cdot \\sigma_D^2 + D^2 \\cdot \\sigma_L^2}$$\n"
        reply += "   • $Z = 1.65$ — коефіцієнт нормального розподілу для 95% рівня готовності до обслуговування (Cycle Service Level).\n"
        reply += "   • $D$ — середньоденний темп попиту, $\\sigma_D$ — стандартне відхилення попиту.\n"
        reply += "   • $L$ — термін доставки (Lead Time), $\\sigma_L$ — варіативність доставки постачальника.\n\n"
        reply += "2. **Точка перезамовлення (Reorder Point, $ROP$)**:\n"
        reply += "   $$ROP = D \\cdot L + SS$$\n"
        reply += "   Сигналізує про необхідність виставити нове замовлення постачальнику, щоб товар встиг прибути до вичерпання запасів.\n\n"
        reply += "3. **Оптимальна партія замовлення (Wilson EOQ)**:\n"
        reply += "   $$EOQ = \\sqrt{\\frac{2 \\cdot D_{\\text{рік}} \\cdot S}{H}}$$\n"
        reply += "   Де $S$ — фіксовані витрати на оформлення однієї поставки, $H$ — річна вартість зберігання одиниці товару на складі.\n\n"
        reply += "4. **Очікуваний час вичерпання запасів**: $\\text{Days} = \\frac{\\text{Поточний залишок}}{D}$."
        
        actions.append(CopilotAction(
            label="🎯 Перевірити параметри в Радарі",
            action_type="open_radar"
        ))
        actions.append(CopilotAction(
            label="📊 Матриця ABC-XYZ",
            action_type="open_abc"
        ))
        return reply, "logistics_formulas", actions

    # 7. Структура асортименту та категорії (Categories & Assortment Breakdown)
    if any(w in q_lower for w in ["категорі", "асортимент", "структур", "види товарів", "групи товарів", "скільки категорій"]):
        cats = context["categories"]
        total_val = context["total_valuation"]
        
        reply = f"### 🗂️ Структура товарного асортименту ({len(cats)} категорій)\n\n"
        sorted_cats = sorted(cats.items(), key=lambda c: c[1]["count"], reverse=True)
        for cat_name, c_data in sorted_cats:
            share = (c_data["valuation"] / total_val * 100.0) if total_val > 0 else 0.0
            reply += f"• **{cat_name}**:\n"
            reply += f"  - Кількість найменувань: **{c_data['count']} SKU**\n"
            reply += f"  - Фізичний обсяг: **{c_data['units']:,.0f} шт.**\n"
            reply += f"  - Загальна вартість: **{c_data['valuation']:,.2f} ₴** ({share:.1f}% від капіталу складу)\n"
            
        actions.append(CopilotAction(
            label="🗂️ Довідник категорій",
            action_type="open_categories"
        ))
        actions.append(CopilotAction(
            label="📦 Товари на складі",
            action_type="open_stock"
        ))
        return reply, "category_breakdown", actions

    # 8. Контрагенти та постачальники (Suppliers & Partner Directory)
    if any(w in q_lower for w in ["база постачальників", "список постачальників", "хто постачальник", "контрагент", "партнер", "дистриб'ютор", "з якими постачальниками"]):
        supps = context["suppliers"]
        reply = f"### 👥 Реєстр активних постачальників ({len(supps)} контрагентів)\n\n"
        reply += "Наразі укладено договори та закріплено номенклатуру за наступними партнерами:\n\n"
        
        sorted_supps = sorted(supps.items(), key=lambda s: s[1]["valuation"], reverse=True)
        for supp_name, s_data in sorted_supps:
            reply += f"• **{supp_name}**:\n"
            reply += f"  - Закріплено товарів: **{s_data['count']} SKU**\n"
            reply += f"  - Загальна вартість запасів на складі: **{s_data['valuation']:,.2f} ₴**\n"
            
        reply += "\n💡 *Рекомендація системи: для товарів групи A підтримуйте мінімум двох альтернативних постачальників задля уникнення логістичних розривів.*"
        
        actions.append(CopilotAction(
            label="👥 Каталог контрагентів",
            action_type="open_partners"
        ))
        actions.append(CopilotAction(
            label="🛒 Замовлення на закупівлю",
            action_type="open_purchase_orders"
        ))
        return reply, "suppliers_overview", actions

    # 9. Генерація ділового листа постачальнику (Supplier Letter Drafting)
    if any(w in q_lower for w in ["лист", "шаблон", "накладн", "зверненн", "напиши лист", "сформуй лист"]):
        urgent_or_crit = context["urgent_items"] + context["critical_items"]
        if not urgent_or_crit:
            urgent_or_crit = context["radar"].items[:3]

        # 1. Шукаємо постачальника із запиту користувача
        detected_supplier = detect_supplier_in_query(query, products, context["radar"].items)
        matched_product = detect_product_in_query(query, products)
        
        if detected_supplier:
            supplier = detected_supplier
            # Фільтруємо позиції саме для цього постачальника
            items_for_supplier = [
                it for it in urgent_or_crit 
                if it.supplier_name and (detected_supplier.lower() in it.supplier_name.lower() or it.supplier_name.lower() in detected_supplier.lower())
            ]
            # Якщо серед термінових немає, шукаємо серед усіх товарів радара
            if not items_for_supplier:
                items_for_supplier = [
                    it for it in context["radar"].items 
                    if it.supplier_name and (detected_supplier.lower() in it.supplier_name.lower() or it.supplier_name.lower() in detected_supplier.lower())
                ]
            # Якщо користувач зазначив конкретний товар, додаємо/використовуємо його
            if matched_product:
                prod_radar = next((it for it in context["radar"].items if str(it.product_id) == str(matched_product.product_id)), None)
                if prod_radar and prod_radar not in items_for_supplier:
                    items_for_supplier.insert(0, prod_radar)
            # Якщо за цим постачальником не закріплено товарів у базі, але користувач звернувся саме до нього:
            if not items_for_supplier:
                items_for_supplier = urgent_or_crit[:3]
        else:
            # Постачальника не вказано явно
            if matched_product:
                prod_radar = next((it for it in context["radar"].items if str(it.product_id) == str(matched_product.product_id)), None)
                if prod_radar:
                    supplier = prod_radar.supplier_name or "ТОВ \"ТехноДистриб'юшн\""
                    items_for_supplier = [prod_radar]
                else:
                    supplier = urgent_or_crit[0].supplier_name if urgent_or_crit else "ТОВ \"ТехноДистриб'юшн\""
                    items_for_supplier = urgent_or_crit[:2]
            else:
                supplier = urgent_or_crit[0].supplier_name if urgent_or_crit else "ТОВ \"ТехноДистриб'юшн\""
                items_for_supplier = [it for it in urgent_or_crit if it.supplier_name == supplier]
                if not items_for_supplier:
                    items_for_supplier = urgent_or_crit[:2]
            
        today_str = datetime.date.today().strftime("%d.%m.%Y")
        total_supplier_cost = sum(it.estimated_order_cost for it in items_for_supplier)
        
        draft = f"Вихідний № {datetime.date.today().strftime('%Y%m%d')}-01 від {today_str}\n"
        draft += f"Кому: Відділ оптових продажів {supplier}\n"
        draft += "Від кого: ТОВ \"Складські Системи та Логістика\"\n"
        draft += "Тема: Замовлення на поповнення складських запасів згідно з договором постачання\n\n"
        draft += "Шановні партнери!\n\n"
        draft += "Просимо виставити рахунок-фактуру та погодити графік відвантаження наступної номенклатури продукції:\n\n"
        
        for idx, it in enumerate(items_for_supplier, 1):
            draft += f"{idx}. {it.name} (Артикул: {it.sku}) — {it.recommended_order_qty} шт. по ціні {it.unit_price:,.2f} ₴ (Сума: {it.estimated_order_cost:,.2f} ₴)\n"
            
        draft += f"\nСукупна планова вартість поставки: {total_supplier_cost:,.2f} ₴ з ПДВ.\n"
        draft += "Бажаний термін прибуття товару на наш розподільчий склад: протягом 5-7 робочих днів.\n"
        draft += "Оплату гарантуємо згідно з умовами чинного договору.\n\n"
        draft += "З повагою,\nКерівник відділу матеріально-технічного забезпечення\nТОВ \"Складські Системи\""
        
        reply = f"### 📝 Сформовано проєкт офіційного замовлення для постачальника **{supplier}**:\n\n"
        reply += f"```text\n{draft}\n```\n\n"
        reply += "Ви можете скопіювати цей текст та відправити його електронною поштою постачальнику."
        
        actions.append(CopilotAction(
            label="📄 Завантажити лист (PDF)",
            action_type="download_pdf",
            payload=draft
        ))
        actions.append(CopilotAction(
            label="📋 Скопіювати текст листа",
            action_type="copy_text",
            payload=draft
        ))
        actions.append(CopilotAction(
            label="🎯 Перевірити в Радарі",
            action_type="open_radar"
        ))
        return reply, "supplier_draft", actions

    # 10. Інвентаризація, списання та аудит залишків (Inventory Audit & Adjustments)
    if any(w in q_lower for w in ["інвентаризаці", "списанн", "коригуванн", "переоблік", "нестач", "надлишк", "журнал аудиту", "аудит дій", "розбіжност"]):
        reply = "### 📋 Інвентаризація, списання та аудит дій\n\n"
        reply += "Система забезпечує повний контроль складської відповідності між обліковими та фактичними залишками:\n\n"
        reply += "1. **Проведення інвентаризації (Stock Take)**:\n"
        reply += "   • Комірник вносить фактично пораховану кількість одиниць товару.\n"
        reply += "   • Система автоматично вираховує розбіжність: $\\Delta = \\text{Факт} - \\text{Облік}$.\n"
        reply += "   • $\\Delta > 0$ — фіксація **надлишку** (оприбуткування).\n"
        reply += "   • $\\Delta < 0$ — фіксація **нестачі** (списання / усушка / бій).\n\n"
        reply += "2. **Коригування залишків (Inventory Adjustments)**:\n"
        reply += "   • Можливість швидкого точкового коригування із зазначенням обов'язкової причини (брак, повернення покупця, пересортування).\n\n"
        reply += "3. **Журнал аудиту (Audit Trail)**:\n"
        reply += "   • Незмінна історія всіх операцій: хто, коли, з якої IP-адреси та для якого товару змінив баланс складу.\n"
        
        actions.append(CopilotAction(
            label="📋 Провести інвентаризацію",
            action_type="open_audit"
        ))
        actions.append(CopilotAction(
            label="📜 Журнал аудиту дій",
            action_type="open_audit_log"
        ))
        return reply, "inventory_audit_operations", actions

    # 11. Екстремальні товари та топи (Top & Extreme Products)
    if any(w in q_lower for w in ["найдорожч", "найдешевш", "топ товар", "найбільш залиш", "найменш залиш", "нульовий залишок", "відсутні", "немає на складі", "закінчилися"]):
        reply = "### 🏆 Рейтинг ключових позицій складу\n\n"
        
        out_of_stock = context["out_of_stock"]
        top_exp = context["top_expensive"]
        top_stk = context["top_stocked"]
        
        if out_of_stock:
            reply += f"#### ❌ Товари з нульовим залишком ({len(out_of_stock)} позицій):\n"
            for p in out_of_stock[:5]:
                reply += f"• **{p.name}** (`{p.sku}`) — 0 шт на складі (постачальник: {p.supplier_name})\n"
            reply += "\n"
        else:
            reply += "✅ **Товарів із нульовим залишком не зафіксовано.**\n\n"
            
        reply += "#### 💎 Топ найдорожчих товарів за ціною за одиницю:\n"
        for idx, p in enumerate(top_exp[:4], 1):
            reply += f"{idx}. **{p.name}** (`{p.sku}`): **{p.unit_price:,.2f} ₴** (залишок: {p.current_stock} шт)\n"
            
        reply += "\n#### 📦 Топ товарів за фізичною кількістю на складі:\n"
        for idx, p in enumerate(top_stk[:4], 1):
            reply += f"{idx}. **{p.name}** (`{p.sku}`): **{p.current_stock:,.0f} шт** ({p.category})\n"
            
        actions.append(CopilotAction(
            label="📦 Відкрити список залишків",
            action_type="open_stock"
        ))
        actions.append(CopilotAction(
            label="🎯 Перевірити дефіцити в Радарі",
            action_type="open_radar"
        ))
        return reply, "top_and_extreme_products", actions

    # 12. Термінові замовлення та дефіцити (Procurement Radar)
    if any(w in q_lower for w in ["термінов", "замов", "дефіцит", "закінч", "поповн", "купити", "радар", "що треба", "потреби"]):
        urgent = context["urgent_items"]
        critical = context["critical_items"]
        total_cost = context["total_order_cost"]
        
        reply = "### 🚨 Аудит дефіциту та рекомендації щодо закупівлі\n\n"
        reply += f"За результатами роботи **Радару закупівель** у зоні ризику виявлено **{len(urgent) + len(critical)} позицій**:\n\n"
        
        if urgent:
            reply += "#### 🔴 Статус «ТЕРМІНОВО» (нульовий залишок або вичерпання <= 2 днів):\n"
            for it in urgent:
                reply += f"• **{it.name}** (`{it.sku}`): залишок **{it.current_stock} шт** $\\rightarrow$ рекомендовано замовити **+{it.recommended_order_qty} шт** ({it.estimated_order_cost:,.0f} ₴, {it.supplier_name})\n"
            reply += "\n"
            
        if critical:
            reply += "#### 🟠 Статус «КРИТИЧНО» (запас нижче ROP і вичерпується швидше за поставку):\n"
            for it in critical:
                reply += f"• **{it.name}** (`{it.sku}`): залишок **{it.current_stock} шт** (ROP: {it.reorder_point} шт, вичерпання: {it.days_to_depletion} дн) $\\rightarrow$ замовлення: **+{it.recommended_order_qty} шт** ({it.estimated_order_cost:,.0f} ₴)\n"
            reply += "\n"
            
        reply += f"💰 **Сукупний рекомендований бюджет на поповнення**: **{total_cost:,.2f} ₴**\n\n"
        reply += "Оберіть дію нижче для швидкого переходу до оформлення або генерації листа постачальнику."
        
        actions.append(CopilotAction(
            label="🎯 Відкрити Радар закупівель",
            action_type="open_radar"
        ))
        actions.append(CopilotAction(
            label="✉️ Скласти лист постачальнику",
            action_type="quick_reply",
            payload="Склади лист постачальнику на замовлення дефіцитних товарів"
        ))
        return reply, "urgent_procurement", actions

    # 13. Аналітика матриці ABC-XYZ
    if any(w in q_lower for w in ["abc", "xyz", "парето", "виручк", "прибут", "неліквід", "стратег"]):
        abc_res = context["abc_xyz"]
        group_a = context["group_a_items"]
        
        reply = "### 📈 Портфельний аналіз асортименту (Матриця ABC-XYZ)\n\n"
        reply += f"За результатами моделювання піврічного періоду сукупна виручка складу становить **{abc_res.total_revenue:,.2f} ₴**:\n\n"
        reply += f"• **Група A (80% обороту)**: {len(group_a)} ключових високодохідних позицій ("
        reply += ", ".join([f"{it.name} ({it.share_percent}%)" for it in group_a[:4]]) + "...)\n"
        reply += "• **Категорія стабільності X (CV <= 20%)**: масові аксесуари та витратні матеріали $\\rightarrow$ рекомендація: постачання фіксованими партіями EOQ.\n"
        reply += "• **Категорія коливань Y (20% < CV <= 35%)**: ноутбуки та смартфони $\\rightarrow$ рекомендація: потижневе календарне планування під сезонні тренди.\n"
        reply += "• **Категорія Z (CV > 35%)**: рідкісні або специфічні товари (офісні БФП, резервне живлення) $\\rightarrow$ рекомендація: робота під індивідуальне замовлення клієнта.\n\n"
        reply += "Бажаєте відкрити інтерактивну 3×3 матрицю асортименту?"
        
        actions.append(CopilotAction(
            label="📊 Відкрити матрицю ABC-XYZ",
            action_type="open_abc"
        ))
        return reply, "abc_xyz_analysis", actions

    # 14. Запит інформації по конкретному товару (Direct Product Lookup & XAI)
    matched_product = detect_product_in_query(query, products)
    if matched_product:
        radar_item = next((it for it in context["radar"].items if str(it.product_id) == str(matched_product.product_id) or it.sku == matched_product.sku), None)
        abc_item = next((it for it in context["abc_xyz"].items if str(it.product_id) == str(matched_product.product_id) or it.sku == matched_product.sku), None)
        
        if radar_item:
            status_badge = "🟢 НОРМА"
            if radar_item.status_code == "urgent":
                status_badge = "🔴 ТЕРМІНОВО"
            elif radar_item.status_code == "critical":
                status_badge = "🟠 КРИТИЧНО"
            elif radar_item.status_code == "warning":
                status_badge = "🟡 УВАГА (нижче точки ROP)"
                
            reply = f"### 📊 Аналітична картка товару: **{radar_item.name}** (`{radar_item.sku}`)\n\n"
            reply += f"• **Поточний статус безпеки**: {status_badge}\n"
            reply += f"• **Фізичний залишок на складі**: **{radar_item.current_stock} шт** (мінімальний норматив MinStock: {matched_product.min_stock} шт)\n"
            reply += f"• **Ціна за одиницю**: **{radar_item.unit_price:,.2f} ₴** (капіталізація залишку: **{radar_item.current_stock * radar_item.unit_price:,.2f} ₴**)\n"
            reply += f"• **Середньодобовий темп попиту ($D$)**: **{radar_item.daily_demand} шт/день** (дисперсія $\\sigma_D = {radar_item.daily_demand_std}$)\n"
            reply += f"• **Логістичне плече поставки ($L$)**: **{radar_item.lead_time_days} днів** (постачальник: *{radar_item.supplier_name}*)\n"
            reply += f"• **Динамічний страховий запас ($SS$)**: **{radar_item.safety_stock} шт** (95% рівень захисту від дефіциту)\n"
            reply += f"• **Точка перезамовлення ($ROP$)**: **{radar_item.reorder_point} шт**\n"
            reply += f"• **Оптимальна партія закупівлі ($EOQ$)**: **{radar_item.eoq} шт**\n"
            reply += f"• **Очікуваний термін вичерпання залишку**: **{radar_item.days_to_depletion} дн**\n\n"
            
            # Логічне пояснення XAI
            reply += "#### 🧠 Пояснення рішення штучного інтелекту (Explainable AI):\n"
            if radar_item.status_code == "urgent":
                reply += f"Запас товару дорівнює **{radar_item.current_stock} шт**, що створює безпосередню зупинку продажів (дефіцит). "
                reply += f"Система рекомендує **негайне формування замовлення** на оптимальну партію **{radar_item.recommended_order_qty} шт** на суму **{radar_item.estimated_order_cost:,.2f} ₴**."
            elif radar_item.status_code == "critical":
                reply += f"Залишок товару ({radar_item.current_stock} шт) впав нижче або впритул до точки перезамовлення ({radar_item.reorder_point} шт), "
                reply += f"а часу до повного вичерпання ({radar_item.days_to_depletion} дн) менше або рівно терміну доставки постачальником ({radar_item.lead_time_days} дн). "
                reply += f"Рекомендовано замовити партію **{radar_item.recommended_order_qty} шт**."
            elif radar_item.status_code == "warning":
                reply += f"Поточний залишок ({radar_item.current_stock} шт) досяг межі точки перезамовлення ROP ({radar_item.reorder_point} шт). "
                reply += f"За поточного темпу споживання запасів вистачить на {radar_item.days_to_depletion} днів. Необхідно ініціювати закупівлю."
            else:
                reply += f"Запасів на складі ({radar_item.current_stock} шт) достатньо для покриття попиту на {radar_item.days_to_depletion} днів. "
                reply += f"Рівень запасів вищий за точку перезамовлення ({radar_item.reorder_point} шт). Додаткове замовлення наразі не потрібне."
                
            if abc_item:
                reply += f"\n\n*У портфелі товар має класифікацію **{abc_item.matrix_cell}** (частка у виручці: {abc_item.share_percent}%, стабільність попиту: CV={abc_item.cv_percent}%).*"
                
            actions.append(CopilotAction(
                label="📈 Відкрити ML-прогноз попиту",
                action_type="open_forecast",
                payload=str(radar_item.product_id)
            ))
            actions.append(CopilotAction(
                label="🎯 Переглянути в Радарі",
                action_type="open_radar"
            ))
            return reply, "explain_product", actions

    # 15. Загальне привітання та довідка (Enhanced Knowledge Base Help)
    reply = "👋 **Вітаю! Я ваш інтелектуальний асистент складу (Warehouse AI Copilot).**\n\n"
    reply += "Я маю доступ до повної бази даних складу PostgreSQL, математичних моделей ML (Prophet, LightGBM, Holt-Winters), оптимізаційних формул логістики та журналів операцій.\n\n"
    reply += "🎯 **Ось теми та питання, на які я можу відповісти:**\n\n"
    reply += "• 💰 **Фінансова оцінка**: *«Яка загальна вартість складу та баланс?»*\n"
    reply += "• 🏢 **Мультисклад**: *«Як працює переміщення між складами?»*\n"
    reply += "• 🛒 **Замовлення на закупівлю**: *«Який життєвий цикл замовлення постачальнику?»*\n"
    reply += "• 🧠 **Машинне навчання**: *«Які ML-моделі прогнозують попит і як працює ансамбль?»*\n"
    reply += "• 🔮 **XAI та What-If**: *«Як працює TreeSHAP та моделювання знижок?»*\n"
    reply += "• 📐 **Формули логістики**: *«Як розраховуються SS, ROP та EOQ Вільсона?»*\n"
    reply += "• 🚨 **Дефіцити та Радар**: *«Що сьогодні треба терміново замовити?»*\n"
    reply += "• ✉️ **Ділові листи**: *«Склади лист постачальнику ТОВ ТехноДистриб'юшн»*\n"
    reply += "• 📦 **Конкретний товар**: запитайте про *«RTX 4070»*, *«ThinkPad»*, *«Galaxy S24»* або введіть артикул.\n\n"
    reply += "Оберіть швидку підказку нижче або введіть запитання своїми словами:"
    
    actions.append(CopilotAction(
        label="💰 Вартість складу та баланс",
        action_type="quick_reply",
        payload="Яка загальна вартість складу та капітал у товарах?"
    ))
    actions.append(CopilotAction(
        label="🚨 Що треба замовити?",
        action_type="quick_reply",
        payload="Що сьогодні треба терміново замовити і який бюджет потрібен?"
    ))
    actions.append(CopilotAction(
        label="🏢 Мультисклад і трансфери",
        action_type="quick_reply",
        payload="Як працює мультискладський облік та внутрішні переміщення?"
    ))
    actions.append(CopilotAction(
        label="🧠 Які ML-моделі працюють?",
        action_type="quick_reply",
        payload="Які моделі машинного навчання використовуються для прогнозування попиту?"
    ))
    actions.append(CopilotAction(
        label="📐 Формули SS, ROP та EOQ",
        action_type="quick_reply",
        payload="Як розраховуються формули страхового запасу SS, точки перезамовлення ROP та EOQ?"
    ))
    actions.append(CopilotAction(
        label="🛒 Життєвий цикл замовлень",
        action_type="quick_reply",
        payload="Який життєвий цикл замовлення на закупівлю?"
    ))
    
    return reply, "help", actions

def query_cloud_llm(
    query: str,
    context: Dict[str, Any],
    api_key: Optional[str] = None
) -> Optional[str]:
    """
    Звернення до хмарного LLM API (Google Gemini 2.0 Flash) за наявності API ключа.
    Використовує стандартну бібліотеку urllib без сторонніх залежностей.
    """
    key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        return None
        
    radar_summary = f"Всього товарів: {context['total_count']}. Фізичний залишок: {context.get('total_units', 0):,.0f} шт на суму {context.get('total_valuation', 0):,.2f} грн. Термінових до закупівлі: {len(context['urgent_items'])}, Критичних: {len(context['critical_items'])}, Увага: {len(context['warning_items'])}, Норма: {len(context['norm_items'])}. Рекомендована сума замовлення: {context['total_order_cost']:,.0f} грн."
    urgent_names = ", ".join([f"{it.name} ({it.recommended_order_qty} шт)" for it in context['urgent_items']])
    
    system_prompt = (
        "Ти — AI-Копілот системи складського обліку та оптимізації запасів підприємства (DSS Copilot). "
        "Відповідай українською мовою, професійно, структуровано, використовуючи Markdown (списки, жирний шрифт, емодзі). "
        f"Поточний стан складу: {radar_summary}. Термінові позиції до замовлення: {urgent_names}. "
        "Ти маєш експертні знання про мультискладський облік, замовлення на закупівлю (Purchase Orders), "
        "машинне навчання (Holt-Winters, LightGBM, Prophet з українськими святами, Ridge, адаптивний гібридний ансамбль), "
        "Explainable AI (TreeSHAP) та What-If сценарії, "
        "а також формули логістики: середньоденний попит (D), термін доставки (L), страховий запас (SS), точку перезамовлення (ROP), оптимальну партію (EOQ)."
    )
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{system_prompt}\n\nЗапит менеджера складу: {query}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 800
        }
    }
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                res_data = json.loads(response.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
    except Exception:
        # У разі мережевої помилки або блокування переходимо до автономного евристичного рушія
        pass
        
    return None

def process_chat_message(request: CopilotChatRequest) -> CopilotChatResponse:
    """
    Головна точка входу для обробки повідомлень AI-Копілота.
    Реалізує двомодальний режим:
    1. Онлайн-генерація через LLM (за наявності ключа).
    2. Автономний евристичний рушій (Offline Fallback Engine), що гарантує безвідмовність.
    """
    products = request.products
    if not products or len(products) == 0:
        # Fallback до еталонних товарів
        benchmark_list = get_all_benchmark_products()
        products = [
            WarehouseProductInput(
                product_id=p["id"],
                sku=p["sku"],
                name=p["name"],
                category=p.get("category", "Електроніка"),
                unit_price=float(p["price"]),
                current_stock=float(p["current_stock"]),
                min_stock=float(p.get("old_min_stock", 3.0)),
                supplier_name=p.get("supplier", "ТОВ \"ПостачТрейд\"")
            )
            for p in benchmark_list
        ]
        
    context = build_warehouse_system_context(products)
    
    # 1. Спроба викликати хмарну LLM (якщо дозволено і передано ключ)
    llm_reply = None
    if request.provider != "offline":
        llm_reply = query_cloud_llm(request.message, context, request.api_key)
        
    if llm_reply:
        # Формуємо дії для хмарної відповіді
        actions: List[CopilotAction] = [
            CopilotAction(label="🎯 Відкрити Радар закупівель", action_type="open_radar"),
            CopilotAction(label="📊 Відкрити матрицю ABC-XYZ", action_type="open_abc")
        ]
        return CopilotChatResponse(
            reply=llm_reply,
            intent="cloud_llm_query",
            actions=actions,
            model_used="Google Gemini 2.0 Flash (Cloud LLM)",
            generated_at=datetime.datetime.now().isoformat()
        )
        
    # 2. Автономний офлайн-рушій (Explainable AI Rules Engine)
    reply, intent, actions = generate_offline_heuristic_reply(request.message, products, context)
    
    return CopilotChatResponse(
        reply=reply,
        intent=intent,
        actions=actions,
        model_used="Warehouse DSS Cognitive Engine (Автономний XAI-рушій)",
        generated_at=datetime.datetime.now().isoformat()
    )
