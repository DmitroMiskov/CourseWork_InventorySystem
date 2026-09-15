from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Union, Any

class MovementRecord(BaseModel):
    date: str
    quantity: float
    type: Optional[str] = "Outgoing"
    unit_price: Optional[float] = 0.0

class WarehouseProductInput(BaseModel):
    product_id: Union[int, str]
    sku: str
    name: str
    category: Optional[str] = "Загальне"
    unit_price: float
    current_stock: float = 0.0
    min_stock: Optional[float] = 3.0
    supplier_name: Optional[str] = None
    daily_demand: Optional[float] = None
    lead_time_days: Optional[int] = None
    history: Optional[List[MovementRecord]] = None

class ForecastRequest(BaseModel):
    product_id: Union[int, str] = 1
    sku: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    unit_price: Optional[float] = None
    current_stock: Optional[float] = None
    min_stock: Optional[float] = None
    horizon_days: int = Field(default=14, ge=1, le=90)
    history: Optional[List[MovementRecord]] = None
    model_type: Optional[str] = "best"  # "holt_winters", "ridge", "lightgbm", "best"

class HistoricalPoint(BaseModel):
    date: str
    actual_quantity: float

class ForecastPoint(BaseModel):
    date: str
    day_index: int
    predicted_demand: float
    lower_bound_95: float
    upper_bound_95: float

class ModelMetrics(BaseModel):
    mae: float
    rmse: float
    mape: float
    r2: Optional[float] = None
    model_name: str

class ForecastResponse(BaseModel):
    product_id: Union[int, str]
    sku: Optional[str]
    name: Optional[str]
    horizon_days: int
    model_used: str
    historical_points: List[HistoricalPoint]
    forecast_points: List[ForecastPoint]
    metrics: ModelMetrics
    trend: str  # "Зростаючий", "Спадний", "Стабільний"
    summary_forecast_qty: float
    avg_daily_demand: float

class ProcurementRadarItem(BaseModel):
    product_id: Union[int, str]
    sku: str
    name: str
    category: str
    unit_price: float
    current_stock: float
    daily_demand: float
    daily_demand_std: float
    lead_time_days: int
    lead_time_std: float = 1.0
    safety_stock: float
    reorder_point: float
    eoq: float
    days_to_depletion: float
    status: str  # "НОРМА", "УВАГА (нижче ROP)", "КРИТИЧНО", "ТЕРМІНОВО"
    status_code: str  # "norm", "warning", "critical", "urgent"
    recommended_order_qty: float
    estimated_order_cost: float
    supplier_name: str

class ProcurementRadarRequest(BaseModel):
    items: Optional[List[ProcurementRadarItem]] = None
    products: Optional[List[WarehouseProductInput]] = None
    service_level_z: float = 1.65  # 95% standard normal quantile
    order_cost_s: float = 500.0    # Fixed cost per order (грн)
    holding_cost_rate_h: float = 0.20  # 20% annual holding cost rate

class ProcurementRadarResponse(BaseModel):
    generated_at: str
    service_level_z: float
    total_items_count: int
    urgent_count: int
    critical_count: int
    warning_count: int
    norm_count: int
    total_recommended_procurement_cost: float
    items: List[ProcurementRadarItem]

class AbcXyzItem(BaseModel):
    product_id: Union[int, str]
    sku: str
    name: str
    category: str
    revenue: float
    share_percent: float
    cumulative_share_percent: float
    abc_class: str  # A, B, C
    cv_percent: float  # Coefficient of Variation
    xyz_class: str  # X, Y, Z
    matrix_cell: str  # AX, AY, AZ, BX, BY, BZ, CX, CY, CZ
    strategy_recommendation: str

class AbcXyzRequest(BaseModel):
    days_period: Optional[int] = 180
    products: Optional[List[WarehouseProductInput]] = None

class AbcXyzResponse(BaseModel):
    generated_at: str
    total_products: int
    total_revenue: float
    matrix_counts: Dict[str, int]
    items: List[AbcXyzItem]

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str

class CopilotAction(BaseModel):
    label: str
    action_type: str  # "open_forecast", "open_radar", "open_abc", "quick_reply", "copy_text"
    payload: Optional[str] = None

class CopilotChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    products: Optional[List[WarehouseProductInput]] = None
    api_key: Optional[str] = None
    provider: Optional[str] = "auto"  # "gemini", "openai", "offline", "auto"

class CopilotChatResponse(BaseModel):
    reply: str
    intent: str
    actions: List[CopilotAction] = []
    model_used: str
    generated_at: str
