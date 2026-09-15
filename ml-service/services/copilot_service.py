import os
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

def build_warehouse_system_context(products: List[WarehouseProductInput]) -> Dict[str, Any]:
    """
    Збирає структурований аналітичний контекст поточного стану складу:
    Радар закупівель (дефіцити) та матрицю ABC-XYZ (виручка).
    """
    radar = generate_procurement_radar(products=products)
    abc_xyz = calculate_abc_xyz(products=products, period_days=180)
    
    urgent_items = [it for it in radar.items if it.status_code == "urgent"]
    critical_items = [it for it in radar.items if it.status_code == "critical"]
    warning_items = [it for it in radar.items if it.status_code == "warning"]
    norm_items = [it for it in radar.items if it.status_code == "norm"]
    
    group_a_items = [it for it in abc_xyz.items if it.abc_class == "A"]
    
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
        "total_revenue": abc_xyz.total_revenue
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
    
    # 1. Пошук пояснення по конкретному товару (Explainable AI - XAI)
    matched_product = detect_product_in_query(query, products)
    if matched_product and any(w in q_lower for w in ["чому", "поясн", "статус", "попит", "скільки", "інформац", "товар", "прогноз"]):
        # Знаходимо розрахункові параметри в радарі
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
                label="📑 Переглянути в Радарі",
                action_type="open_radar"
            ))
            return reply, "explain_product", actions

    # 2. Генерація ділового листа постачальнику
    if any(w in q_lower for w in ["лист", "постачальник", "шаблон", "накладн", "зверненн", "напиши", "сформуй замовлення"]):
        urgent_or_crit = context["urgent_items"] + context["critical_items"]
        if not urgent_or_crit:
            urgent_or_crit = context["radar"].items[:3]
            
        # Групуємо за основним постачальником
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
        
        reply = f"### 📝 Сформовано проєкт офіційного замовлення для постачальника:\n\n"
        reply += f"```text\n{draft}\n```\n\n"
        reply += "Ви можете скопіювати цей текст та відправити його електронною поштою постачальнику."
        
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

    # 3. Термінові замовлення та дефіцити
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

    # 4. Аналітика матриці ABC-XYZ
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

    # 5. Загальне привітання та довідка
    reply = "👋 **Вітаю! Я ваш інтелектуальний асистент складу (Warehouse AI Copilot).**\n\n"
    reply += "Я маю прямий доступ до **бази даних складу PostgreSQL**, математичних моделей **LightGBM**, розрахунків страхового запасу ($SS, ROP, EOQ$) та матриці **ABC-XYZ**.\n\n"
    reply += "Ось чим я можу допомогти вам прямо зараз:\n"
    reply += "1. 🚨 **Моніторинг дефіциту**: запитайте *«Що сьогодні треба терміново замовити?»*\n"
    reply += "2. 🧠 **Пояснювальний ШІ (XAI)**: запитайте *«Чому для RTX 4070 статус УВАГА?»*\n"
    reply += "3. ✉️ **Ділові листи**: напишіть *«Склади лист постачальнику на замовлення ноутбуків»*\n"
    reply += "4. 📊 **Аналітика прибутку**: запитайте *«Які товари приносять 80% виручки?»*\n\n"
    reply += "Оберіть швидку підказку нижче або введіть власне запитання:"
    
    actions.append(CopilotAction(
        label="🔴 Термінові замовлення",
        action_type="quick_reply",
        payload="Що сьогодні треба терміново замовити і який бюджет потрібен?"
    ))
    actions.append(CopilotAction(
        label="🧠 Пояснити статус товару",
        action_type="quick_reply",
        payload="Чому для відеокарти RTX 4070 призначено статус Увага?"
    ))
    actions.append(CopilotAction(
        label="✉️ Написати постачальнику",
        action_type="quick_reply",
        payload="Склади офіційний лист постачальнику на поповнення дефіцитних товарів"
    ))
    actions.append(CopilotAction(
        label="📊 Товари групи А (80% виручки)",
        action_type="quick_reply",
        payload="Які товари входять до групи А за правилом Парето?"
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
        
    radar_summary = f"Всього товарів: {context['total_count']}. Термінових: {len(context['urgent_items'])}, Критичних: {len(context['critical_items'])}, Увага: {len(context['warning_items'])}, Норма: {len(context['norm_items'])}. Сума замовлення: {context['total_order_cost']:,.0f} грн."
    urgent_names = ", ".join([f"{it.name} ({it.recommended_order_qty} шт)" for it in context['urgent_items']])
    
    system_prompt = (
        "Ти — AI-Копілот системи складського обліку та оптимізації запасів підприємства (DSS Copilot). "
        "Відповідай українською мовою, професійно, структуровано, використовуючи Markdown (списки, жирний шрифт, емодзі). "
        f"Поточний стан складу: {radar_summary}. Термінові позиції до замовлення: {urgent_names}. "
        "У поясненнях спирайся на показники: середньоденний попит (D), термін доставки (L), страховий запас (SS), точку перезамовлення (ROP), оптимальну партію (EOQ)."
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
