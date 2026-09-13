from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List

from models.schemas import (
    ForecastRequest,
    ForecastResponse,
    ProcurementRadarRequest,
    ProcurementRadarResponse,
    AbcXyzRequest,
    AbcXyzResponse,
    HistoricalPoint
)
from services.forecasting_service import generate_forecast
from services.procurement_service import generate_procurement_radar
from services.abc_xyz_service import calculate_abc_xyz
from services.dataset_service import (
    get_all_benchmark_products,
    get_benchmark_by_id,
    get_benchmark_by_sku,
    generate_product_timeseries
)

app = FastAPI(
    title="Inventory Intelligence & ML Forecasting Service",
    description="Інтелектуальний мікросервіс прогнозування попиту, оптимізації запасів (SS, ROP, EOQ) та ABC-XYZ класифікації для системи складського обліку.",
    version="1.0.0"
)

# CORS Middleware (дозволяємо звернення з .NET API та React Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Системні"])
def health_check():
    """Перевірка готовності мікросервісу."""
    return {
        "status": "healthy",
        "service": "inventory-ml",
        "version": "1.0.0",
        "description": "Decision Support System (DSS) Inference Engine"
    }

# ==========================================
# 1. Прогнозування попиту (Demand Forecasting)
# ==========================================
@app.post("/api/forecast/{productId}", response_model=ForecastResponse, tags=["Прогнозування"])
def predict_product_demand(
    productId: str,
    request: Optional[ForecastRequest] = None,
    horizon_days: int = Query(default=14, ge=1, le=90, description="Горизонт прогнозу у днях (14 або 30)"),
    model_type: str = Query(default="best", description="Модель: best, holt_winters, ridge, lightgbm")
):
    """
    Генерація прогнозу часових рядів попиту на обраний горизонт
    із розрахунком 95% довірчого інтервалу та метрик точності (MAE, RMSE, MAPE).
    """
    history_records = request.history if request else None
    chosen_horizon = request.horizon_days if request and request.horizon_days else horizon_days
    chosen_model = request.model_type if request and request.model_type else model_type
    
    try:
        response = generate_forecast(
            product_id=productId,
            horizon_days=chosen_horizon,
            history_records=history_records,
            model_type=chosen_model,
            request=request
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка генерації прогнозу: {str(e)}")

# ==========================================
# 2. Радар закупівель (Procurement Radar)
# ==========================================
@app.get("/api/procurement/radar", response_model=ProcurementRadarResponse, tags=["Оптимізація запасів"])
def get_procurement_radar(
    service_level_z: float = Query(default=1.65, description="Квантиль надійності (Z=1.65 для 95% надійності)"),
    order_cost_s: float = Query(default=500.0, description="Постійні витрати на одну поставку (грн)"),
    holding_rate: float = Query(default=0.20, description="Річна ставка витрат на зберігання (20%)")
):
    """
    Отримання повного 'Радару закупівель' з розрахунком динамічного страхового запасу SS,
    точки замовлення ROP, оптимальної партії EOQ та статусів критичності (Норма, Увага, Критично, Терміново).
    """
    return generate_procurement_radar(
        custom_items=None,
        products=None,
        service_level_z=service_level_z,
        order_cost_s=order_cost_s,
        holding_rate=holding_rate
    )

@app.post("/api/procurement/radar", response_model=ProcurementRadarResponse, tags=["Оптимізація запасів"])
def calculate_custom_procurement_radar(request: ProcurementRadarRequest):
    """
    Розрахунок 'Радару закупівель' для довільного списку товарів (наприклад, переданих з .NET API зі складу).
    """
    return generate_procurement_radar(
        custom_items=request.items,
        products=request.products,
        service_level_z=request.service_level_z,
        order_cost_s=request.order_cost_s,
        holding_rate=request.holding_cost_rate_h
    )

# ==========================================
# 3. Аналітика ABC-XYZ (Портфельний аналіз)
# ==========================================
@app.get("/api/analytics/abc-xyz", response_model=AbcXyzResponse, tags=["Аналітика асортименту"])
def get_abc_xyz_analysis(
    period_days: int = Query(default=180, description="Період аналізу в днях")
):
    """
    Класифікація асортименту за матрицею 3x3 ABC-XYZ (Парето + коефіцієнт варіації)
    з формуванням індивідуальних рекомендацій щодо логістичної стратегії.
    """
    return calculate_abc_xyz(products=None, period_days=period_days)

@app.post("/api/analytics/abc-xyz", response_model=AbcXyzResponse, tags=["Аналітика асортименту"])
def post_abc_xyz_analysis(request: Optional[AbcXyzRequest] = None):
    period = request.days_period if request and request.days_period else 180
    products = request.products if request and request.products else None
    return calculate_abc_xyz(products=products, period_days=period)

# ==========================================
# 4. Демонстраційний датасет (10 товарів)
# ==========================================
@app.get("/api/sample-dataset/products", tags=["Експериментальні дані"])
def get_sample_products():
    """Отримання списку 10 еталонних товарів з дипломного дослідження."""
    return get_all_benchmark_products()

@app.get("/api/sample-dataset/history/{sku}", response_model=List[HistoricalPoint], tags=["Експериментальні дані"])
def get_sample_product_history(sku: str, days: int = Query(default=180, ge=30, le=365)):
    """Отримання 180-денної історії операцій для обраного товару."""
    meta = get_benchmark_by_sku(sku)
    return generate_product_timeseries(meta, days=days)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
