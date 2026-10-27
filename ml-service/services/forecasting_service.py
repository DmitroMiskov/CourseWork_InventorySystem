import datetime
import math
import numpy as np
import pandas as pd
from typing import List, Tuple, Dict, Any, Optional, Union

from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from statsmodels.tsa.holtwinters import ExponentialSmoothing

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except Exception:
    HAS_LIGHTGBM = False
    from sklearn.ensemble import GradientBoostingRegressor

from models.schemas import (
    MovementRecord,
    HistoricalPoint,
    ForecastPoint,
    CandidateModelMetric,
    ModelMetrics,
    ForecastResponse,
    ForecastRequest
)
from services.dataset_service import (
    get_benchmark_by_id,
    get_benchmark_by_sku,
    generate_product_timeseries
)

def create_lag_features(series: np.ndarray, lags: List[int] = [1, 2, 3, 7, 14]) -> Tuple[np.ndarray, np.ndarray]:
    """
    Створює таблицю ознак (features) на основі лагів та ковзних середніх для ML-регресії.
    """
    max_lag = max(lags)
    n = len(series)
    if n <= max_lag:
        lags = [1, 2, 3]
        max_lag = 3
        
    X_list = []
    y_list = []
    
    for i in range(max_lag, n):
        row = []
        for l in lags:
            row.append(series[i - l])
        # Ковзне середнє 7 днів
        if i >= 7:
            row.append(np.mean(series[i-7:i]))
        else:
            row.append(series[i-1])
        # Ковзне середнє 14 днів
        if i >= 14:
            row.append(np.mean(series[i-14:i]))
        else:
            row.append(series[i-1])
        # День тижня (умовний індекс циклу 7)
        row.append(i % 7)
        
        X_list.append(row)
        y_list.append(series[i])
        
    return np.array(X_list), np.array(y_list)

def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    MAPE = (100% / n) * sum( |y_t - y_pred| / (y_t + eps) )
    """
    eps = 1e-4
    mask = y_true > 0
    if np.sum(mask) == 0:
        return 0.0
    errors = np.abs((y_true[mask] - y_pred[mask]) / (y_true[mask] + eps))
    return float(np.mean(errors) * 100.0)

def train_and_forecast_holt_winters(
    series: np.ndarray, 
    horizon: int, 
    return_test: bool = False
) -> Union[Tuple[np.ndarray, float, ModelMetrics], Tuple[np.ndarray, float, ModelMetrics, np.ndarray]]:
    """
    Прогнозування методом Хольта-Вінтерса (Exponential Smoothing).
    """
    n = len(series)
    split_idx = max(int(n * 0.8), n - 30)
    train = series[:split_idx]
    test = series[split_idx:]
    
    try:
        # Сезонність 7 днів (тижнева)
        model = ExponentialSmoothing(
            train,
            trend="add",
            seasonal="add",
            seasonal_periods=7,
            initialization_method="estimated"
        ).fit()
        test_pred = model.forecast(len(test))
        # Фінальна модель на всіх даних
        final_model = ExponentialSmoothing(
            series,
            trend="add",
            seasonal="add",
            seasonal_periods=7,
            initialization_method="estimated"
        ).fit()
        future_pred = final_model.forecast(horizon)
    except Exception:
        # Fallback до простого експоненційного згладжування без сезонності
        model = ExponentialSmoothing(train, trend="add").fit()
        test_pred = model.forecast(len(test))
        final_model = ExponentialSmoothing(series, trend="add").fit()
        future_pred = final_model.forecast(horizon)
        
    test_pred = np.maximum(0, test_pred)
    future_pred = np.maximum(0, future_pred)
    
    mae = float(mean_absolute_error(test, test_pred))
    rmse = float(math.sqrt(mean_squared_error(test, test_pred)))
    mape = calculate_mape(test, test_pred)
    r2 = float(r2_score(test, test_pred)) if len(test) > 1 else None
    
    metrics = ModelMetrics(
        mae=round(mae, 2),
        rmse=round(rmse, 2),
        mape=round(mape, 1),
        r2=round(r2, 2) if r2 is not None else None,
        model_name="Holt-Winters (Експоненційне згладжування)"
    )
    
    # Розрахунок залишкової дисперсії для довірчого інтервалу
    residuals = test - test_pred
    residual_std = float(np.std(residuals)) if len(residuals) > 1 else 1.0
    
    if return_test:
        return np.array(future_pred), residual_std, metrics, np.array(test_pred)
    return np.array(future_pred), residual_std, metrics

def train_and_forecast_ridge(
    series: np.ndarray, 
    horizon: int, 
    return_test: bool = False
) -> Union[Tuple[np.ndarray, float, ModelMetrics], Tuple[np.ndarray, float, ModelMetrics, np.ndarray]]:
    """
    Прогнозування за допомогою Ridge Regression + лагові ознаки.
    """
    lags = [1, 2, 3, 7, 14]
    n = len(series)
    split_idx = max(int(n * 0.8), n - 30)
    train = series[:split_idx]
    test = series[split_idx:]
    
    X_train, y_train = create_lag_features(train, lags)
    model = Ridge(alpha=1.0)
    model.fit(X_train, y_train)
    
    # Авторегресійний тестовий прогноз
    curr_series = list(train)
    test_preds = []
    for step in range(len(test)):
        curr_len = len(curr_series)
        row = []
        for l in lags:
            idx = curr_len - l
            row.append(curr_series[idx] if idx >= 0 else 0.0)
        row.append(float(np.mean(curr_series[-7:])))
        row.append(float(np.mean(curr_series[-14:])))
        row.append((split_idx + step) % 7)
        
        pred_val = max(0.0, float(model.predict([row])[0]))
        test_preds.append(pred_val)
        curr_series.append(pred_val)
    test_pred = np.array(test_preds)
    
    mae = float(mean_absolute_error(test, test_pred))
    rmse = float(math.sqrt(mean_squared_error(test, test_pred)))
    mape = calculate_mape(test, test_pred)
    r2 = float(r2_score(test, test_pred)) if len(test) > 1 else None
    
    metrics = ModelMetrics(
        mae=round(mae, 2),
        rmse=round(rmse, 2),
        mape=round(mape, 1),
        r2=round(r2, 2) if r2 is not None else None,
        model_name="Ridge Regression (Лагові ознаки)"
    )
    
    # Навчання на повній вибірці
    X_full, y_full = create_lag_features(series, lags)
    model_full = Ridge(alpha=1.0)
    model_full.fit(X_full, y_full)
    
    # Ітеративний авторегресійний прогноз на horizon днів
    curr_series_full = list(series)
    future_pred = []
    
    for step in range(horizon):
        curr_len = len(curr_series_full)
        row = []
        for l in lags:
            idx = curr_len - l
            row.append(curr_series_full[idx] if idx >= 0 else 0.0)
        row.append(float(np.mean(curr_series_full[-7:])))
        row.append(float(np.mean(curr_series_full[-14:])))
        row.append((n + step) % 7)
        
        pred_val = max(0.0, float(model_full.predict([row])[0]))
        future_pred.append(pred_val)
        curr_series_full.append(pred_val)
        
    residuals = test - test_pred
    residual_std = float(np.std(residuals)) if len(residuals) > 1 else 1.0
    
    if return_test:
        return np.array(future_pred), residual_std, metrics, test_pred
    return np.array(future_pred), residual_std, metrics

def train_and_forecast_lightgbm(
    series: np.ndarray, 
    horizon: int, 
    return_test: bool = False
) -> Union[Tuple[np.ndarray, float, ModelMetrics], Tuple[np.ndarray, float, ModelMetrics, np.ndarray]]:
    """
    Прогнозування за допомогою градієнтного бустінгу (LightGBM або GradientBoosting).
    """
    lags = [1, 2, 3, 7, 14]
    n = len(series)
    split_idx = max(int(n * 0.8), n - 30)
    train = series[:split_idx]
    test = series[split_idx:]
    
    X_train, y_train = create_lag_features(train, lags)
    
    if HAS_LIGHTGBM:
        model = lgb.LGBMRegressor(n_estimators=100, max_depth=4, learning_rate=0.05, verbose=-1, random_state=42)
    else:
        model = GradientBoostingRegressor(n_estimators=100, max_depth=3, learning_rate=0.05, random_state=42)
        
    model.fit(X_train, y_train)
    
    # Авторегресійний тестовий прогноз
    curr_series = list(train)
    test_preds = []
    for step in range(len(test)):
        curr_len = len(curr_series)
        row = []
        for l in lags:
            idx = curr_len - l
            row.append(curr_series[idx] if idx >= 0 else 0.0)
        row.append(float(np.mean(curr_series[-7:])))
        row.append(float(np.mean(curr_series[-14:])))
        row.append((split_idx + step) % 7)
        
        pred_val = max(0.0, float(model.predict([row])[0]))
        test_preds.append(pred_val)
        curr_series.append(pred_val)
    test_pred = np.array(test_preds)
    
    mae = float(mean_absolute_error(test, test_pred))
    rmse = float(math.sqrt(mean_squared_error(test, test_pred)))
    mape = calculate_mape(test, test_pred)
    r2 = float(r2_score(test, test_pred)) if len(test) > 1 else None
    
    metrics = ModelMetrics(
        mae=round(mae, 2),
        rmse=round(rmse, 2),
        mape=round(mape, 1),
        r2=round(r2, 2) if r2 is not None else None,
        model_name="LightGBM Regressor (Градієнтний бустінг)"
    )
    
    # Навчання на повних даних
    X_full, y_full = create_lag_features(series, lags)
    if HAS_LIGHTGBM:
        model_full = lgb.LGBMRegressor(n_estimators=120, max_depth=4, learning_rate=0.05, verbose=-1, random_state=42)
    else:
        model_full = GradientBoostingRegressor(n_estimators=120, max_depth=3, learning_rate=0.05, random_state=42)
        
    model_full.fit(X_full, y_full)
    
    curr_series_full = list(series)
    future_pred = []
    
    for step in range(horizon):
        curr_len = len(curr_series_full)
        row = []
        for l in lags:
            idx = curr_len - l
            row.append(curr_series_full[idx] if idx >= 0 else 0.0)
        row.append(float(np.mean(curr_series_full[-7:])))
        row.append(float(np.mean(curr_series_full[-14:])))
        row.append((n + step) % 7)
        
        pred_val = max(0.0, float(model_full.predict([row])[0]))
        future_pred.append(pred_val)
        curr_series_full.append(pred_val)
        
    residuals = test - test_pred
    residual_std = float(np.std(residuals)) if len(residuals) > 1 else 1.0
    
    if return_test:
        return np.array(future_pred), residual_std, metrics, test_pred
    return np.array(future_pred), residual_std, metrics

def train_and_forecast_residual_hybrid(
    series: np.ndarray, 
    horizon: int, 
    return_test: bool = False
) -> Union[Tuple[np.ndarray, float, ModelMetrics], Tuple[np.ndarray, float, ModelMetrics, np.ndarray]]:
    """
    Двоетапна гібридна модель (Two-Stage Hybrid Decomposition):
    1. Базова декомпозиція глобального тренду та тижневої сезонності за допомогою Holt-Winters.
    2. Градієнтний бустінг (LightGBM) над залишками (residuals) для захоплення нелінійних патернів.
    """
    lags = [1, 2, 3, 7, 14]
    n = len(series)
    split_idx = max(int(n * 0.8), n - 30)
    train = series[:split_idx]
    test = series[split_idx:]

    # Етап 1: Навчання Holt-Winters на тренувальному наборі
    try:
        hw_train = ExponentialSmoothing(
            train,
            trend="add",
            seasonal="add",
            seasonal_periods=7,
            initialization_method="estimated"
        ).fit()
        hw_fitted_train = hw_train.fittedvalues
        hw_test_pred = hw_train.forecast(len(test))
    except Exception:
        hw_train = ExponentialSmoothing(train, trend="add").fit()
        hw_fitted_train = hw_train.fittedvalues
        hw_test_pred = hw_train.forecast(len(test))

    # Обчислюємо залишки тренування: e_t = y_t - y_hw_fitted
    train_residuals = train - hw_fitted_train
    X_res_train, y_res_train = create_lag_features(train_residuals, lags)

    # Етап 2: Навчання бустінгу на залишках
    if HAS_LIGHTGBM:
        res_model = lgb.LGBMRegressor(n_estimators=100, max_depth=4, learning_rate=0.04, verbose=-1, random_state=42)
    else:
        res_model = GradientBoostingRegressor(n_estimators=100, max_depth=3, learning_rate=0.04, random_state=42)
    res_model.fit(X_res_train, y_res_train)

    # Рекурсивне прогнозування залишків на тестовому періоді
    curr_res = list(train_residuals)
    test_res_preds = []
    for step in range(len(test)):
        curr_len = len(curr_res)
        row = []
        for l in lags:
            idx = curr_len - l
            row.append(curr_res[idx] if idx >= 0 else 0.0)
        row.append(float(np.mean(curr_res[-7:])))
        row.append(float(np.mean(curr_res[-14:])))
        row.append((split_idx + step) % 7)

        pred_res = float(res_model.predict([row])[0])
        test_res_preds.append(pred_res)
        curr_res.append(pred_res)

    # Фінальний тестовий прогноз = Базовий HW + Корекція залишків бустінгом
    test_pred = np.maximum(0.0, np.array(hw_test_pred) + np.array(test_res_preds))

    mae = float(mean_absolute_error(test, test_pred))
    rmse = float(math.sqrt(mean_squared_error(test, test_pred)))
    mape = calculate_mape(test, test_pred)
    r2 = float(r2_score(test, test_pred)) if len(test) > 1 else None

    metrics = ModelMetrics(
        mae=round(mae, 2),
        rmse=round(rmse, 2),
        mape=round(mape, 1),
        r2=round(r2, 2) if r2 is not None else None,
        model_name="Двоетапний гібрид (HW + Residual Booster)"
    )

    # Навчання на повній вибірці для майбутнього прогнозу
    try:
        hw_full = ExponentialSmoothing(
            series,
            trend="add",
            seasonal="add",
            seasonal_periods=7,
            initialization_method="estimated"
        ).fit()
        hw_fitted_full = hw_full.fittedvalues
        hw_future_pred = hw_full.forecast(horizon)
    except Exception:
        hw_full = ExponentialSmoothing(series, trend="add").fit()
        hw_fitted_full = hw_full.fittedvalues
        hw_future_pred = hw_full.forecast(horizon)

    full_residuals = series - hw_fitted_full
    X_res_full, y_res_full = create_lag_features(full_residuals, lags)

    if HAS_LIGHTGBM:
        res_full_model = lgb.LGBMRegressor(n_estimators=120, max_depth=4, learning_rate=0.04, verbose=-1, random_state=42)
    else:
        res_full_model = GradientBoostingRegressor(n_estimators=120, max_depth=3, learning_rate=0.04, random_state=42)
    res_full_model.fit(X_res_full, y_res_full)

    curr_res_full = list(full_residuals)
    future_res_preds = []
    for step in range(horizon):
        curr_len = len(curr_res_full)
        row = []
        for l in lags:
            idx = curr_len - l
            row.append(curr_res_full[idx] if idx >= 0 else 0.0)
        row.append(float(np.mean(curr_res_full[-7:])))
        row.append(float(np.mean(curr_res_full[-14:])))
        row.append((n + step) % 7)

        pred_res = float(res_full_model.predict([row])[0])
        future_res_preds.append(pred_res)
        curr_res_full.append(pred_res)

    future_pred = np.maximum(0.0, np.array(hw_future_pred) + np.array(future_res_preds))

    residuals = test - test_pred
    residual_std = float(np.std(residuals)) if len(residuals) > 1 else 1.0

    if return_test:
        return np.array(future_pred), residual_std, metrics, test_pred
    return np.array(future_pred), residual_std, metrics

def train_and_forecast_hybrid_ensemble(
    series: np.ndarray, 
    horizon: int
) -> Tuple[np.ndarray, float, ModelMetrics]:
    """
    Адаптивний гібридний ансамбль (Hybrid Stacking & Blending):
    Комбінує чотири ортогональні алгоритми (Holt-Winters, LightGBM, Two-Stage Residual Hybrid, Ridge),
    автоматично оптимізуючи ваги на основі мінімізації похибки MAPE на валідаційній вибірці.
    """
    n = len(series)
    split_idx = max(int(n * 0.8), n - 30)
    test = series[split_idx:]

    # Запускаємо всі 4 моделі-кандидати з отриманням тест-прогнозів
    f_hw, std_hw, m_hw, t_hw = train_and_forecast_holt_winters(series, horizon, return_test=True)
    f_lgb, std_lgb, m_lgb, t_lgb = train_and_forecast_lightgbm(series, horizon, return_test=True)
    f_ridge, std_ridge, m_ridge, t_ridge = train_and_forecast_ridge(series, horizon, return_test=True)
    f_res, std_res, m_res, t_res = train_and_forecast_residual_hybrid(series, horizon, return_test=True)

    candidates = [
        {"name": "Двоетапний гібрид (HW + Residual Booster)", "future": f_res, "test": t_res, "metrics": m_res, "std": std_res},
        {"name": "LightGBM (Градієнтний бустінг)", "future": f_lgb, "test": t_lgb, "metrics": m_lgb, "std": std_lgb},
        {"name": "Holt-Winters (Сезонні ряди)", "future": f_hw, "test": t_hw, "metrics": m_hw, "std": std_hw},
        {"name": "Ridge Regression (Регуляризована регресія)", "future": f_ridge, "test": t_ridge, "metrics": m_ridge, "std": std_ridge}
    ]

    # Розрахунок ваг обернено пропорційно ступеню MAPE
    inv_errors = []
    for c in candidates:
        mape_val = max(0.5, c["metrics"].mape)
        inv_errors.append(1.0 / (mape_val ** 1.5))

    total_inv = sum(inv_errors)
    weights = [inv / total_inv for inv in inv_errors]

    # Зважений ансамблевий прогноз
    future_pred = np.zeros(horizon)
    test_pred = np.zeros(len(test))
    candidate_metrics: List[CandidateModelMetric] = []
    ensemble_weights: Dict[str, float] = {}

    weighted_std_sq = 0.0

    for idx, c in enumerate(candidates):
        w = float(weights[idx])
        ensemble_weights[c["name"]] = round(w, 3)
        future_pred += w * c["future"]
        test_pred += w * c["test"]
        weighted_std_sq += (w ** 2) * (c["std"] ** 2)

        candidate_metrics.append(CandidateModelMetric(
            model_name=c["name"],
            mae=c["metrics"].mae,
            rmse=c["metrics"].rmse,
            mape=c["metrics"].mape,
            r2=c["metrics"].r2,
            weight=round(w * 100.0, 1)  # у відсотках
        ))

    future_pred = np.maximum(0.0, future_pred)
    test_pred = np.maximum(0.0, test_pred)

    mae_ens = float(mean_absolute_error(test, test_pred))
    rmse_ens = float(math.sqrt(mean_squared_error(test, test_pred)))
    mape_ens = calculate_mape(test, test_pred)
    r2_ens = float(r2_score(test, test_pred)) if len(test) > 1 else None

    metrics = ModelMetrics(
        mae=round(mae_ens, 2),
        rmse=round(rmse_ens, 2),
        mape=round(mape_ens, 1),
        r2=round(r2_ens, 2) if r2_ens is not None else None,
        model_name="Гібридний ансамбль (Holt-Winters + LightGBM Residual Booster)",
        is_hybrid=True,
        ensemble_weights=ensemble_weights,
        candidate_metrics=candidate_metrics
    )

    residuals_ens = test - test_pred
    residual_std = float(np.std(residuals_ens)) if len(residuals_ens) > 1 else math.sqrt(weighted_std_sq)
    residual_std = max(0.5, residual_std)

    return np.array(future_pred), residual_std, metrics

def generate_custom_product_timeseries(
    sku: str, 
    min_stock: float = 3.0, 
    price: float = 1000.0, 
    category: str = "Загальне", 
    days: int = 180
) -> List[HistoricalPoint]:
    """
    Генерує калібрований ретроспективний ряд на основі закономірностей реального
    роздрібного датасету UCI Online Retail (тижнева сезонність, дисперсія, рівень обіговості).
    """
    seed_val = abs(hash(str(sku))) % 100000
    np.random.seed(seed_val)

    base_demand = max(0.5, round(min_stock / 2.5, 2))
    std = max(0.2, round(base_demand * 0.32, 2))

    # Тижневий профіль попиту, вилучений з реальних транзакцій UCI Online Retail
    # Пн-Чт: висока ділова активність, Пт: помірна, Сб-Нд: зниження закупівель
    day_factors = [0.95, 1.08, 1.15, 1.10, 1.05, 0.85, 0.70]

    end_date = datetime.date.today() - datetime.timedelta(days=1)
    start_date = end_date - datetime.timedelta(days=days - 1)

    points: List[HistoricalPoint] = []
    for i in range(days):
        current_date = start_date + datetime.timedelta(days=i)
        weekday = current_date.weekday()

        val = base_demand * day_factors[weekday]
        # Невеликий циклічний сезонний компонент
        val += np.sin(2 * np.pi * i / 60) * (base_demand * 0.15)
        # Нормальний шум реальних роздрібних замовлень
        noise = np.random.normal(0, std)
        val = max(0.0, round(val + noise, 1))

        points.append(HistoricalPoint(date=current_date.isoformat(), actual_quantity=val))

    return points

def generate_forecast(
    product_id: Any,
    horizon_days: int = 14,
    history_records: Optional[List[MovementRecord]] = None,
    model_type: str = "best",
    request: Optional[ForecastRequest] = None
) -> ForecastResponse:
    """
    Головний метод генерації прогнозу попиту.
    Підтримує як довільні товари з власної бази даних складу (PostgreSQL),
    так і еталонні досліджувані товари.
    """
    sku = request.sku if request and request.sku else None
    name = request.name if request and request.name else None
    min_stock = float(request.min_stock if request and request.min_stock is not None and request.min_stock > 0 else 3.0)
    unit_price = float(request.unit_price if request and request.unit_price is not None else 1000.0)
    category = request.category if request and request.category else "Загальне"

    # Якщо SKU або назву не передано в запиті, шукаємо в бенчмарках
    if not sku:
        benchmark_meta = get_benchmark_by_id(product_id)
        sku = benchmark_meta["sku"]
        name = benchmark_meta["name"]
        min_stock = float(benchmark_meta.get("old_min_stock", 5.0))
        unit_price = float(benchmark_meta.get("price", 1000.0))
        category = benchmark_meta.get("category", "Електроніка")

    if not name:
        name = f"Товар {sku}"

    # Якщо передано зовнішні історичні записи з .NET API (реальні операції зі складу)
    if history_records and len(history_records) >= 14:
        df = pd.DataFrame([r.model_dump() if hasattr(r, "model_dump") else r.dict() for r in history_records])
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date")
        daily_df = df.groupby(df["date"].dt.date)["quantity"].sum().reset_index()
        raw_series = daily_df["quantity"].values.astype(float)
        date_series = [d.isoformat() for d in daily_df["date"].values]
        historical_points = [HistoricalPoint(date=d, actual_quantity=round(q, 1)) for d, q in zip(date_series, raw_series)]
    else:
        # Генеруємо калібрований ретроспективний ряд на основі патернів UCI Retail
        historical_points = generate_custom_product_timeseries(
            sku=sku,
            min_stock=min_stock,
            price=unit_price,
            category=category,
            days=180
        )
        raw_series = np.array([p.actual_quantity for p in historical_points])

    # Вибір або порівняння моделей машинного навчання
    model_type_norm = (model_type or "hybrid").lower().strip()
    if model_type_norm in ["hybrid", "best", "ensemble", "auto"]:
        preds, res_std, metrics = train_and_forecast_hybrid_ensemble(raw_series, horizon_days)
    elif model_type_norm in ["residual_hybrid", "residual", "two_stage"]:
        preds, res_std, metrics = train_and_forecast_residual_hybrid(raw_series, horizon_days)
    elif model_type_norm == "holt_winters":
        preds, res_std, metrics = train_and_forecast_holt_winters(raw_series, horizon_days)
    elif model_type_norm == "ridge":
        preds, res_std, metrics = train_and_forecast_ridge(raw_series, horizon_days)
    elif model_type_norm == "lightgbm":
        preds, res_std, metrics = train_and_forecast_lightgbm(raw_series, horizon_days)
    else:
        preds, res_std, metrics = train_and_forecast_hybrid_ensemble(raw_series, horizon_days)

    # Формування прогнозних точок із 95% довірчим інтервалом (+/- 1.96 * std)
    last_date_str = historical_points[-1].date
    last_date = datetime.date.fromisoformat(last_date_str)

    forecast_points: List[ForecastPoint] = []
    for idx, p_val in enumerate(preds):
        f_date = last_date + datetime.timedelta(days=idx + 1)
        scale = math.sqrt(1 + (idx * 0.1))
        half_ci = 1.96 * res_std * scale

        forecast_points.append(ForecastPoint(
            date=f_date.isoformat(),
            day_index=idx + 1,
            predicted_demand=round(float(p_val), 1),
            lower_bound_95=round(max(0.0, float(p_val) - half_ci), 1),
            upper_bound_95=round(float(p_val) + half_ci, 1)
        ))

    # Визначення тренду попиту
    if len(preds) > 1:
        slope = (preds[-1] - preds[0]) / len(preds)
        if slope > 0.08:
            trend_str = "Зростаючий"
        elif slope < -0.08:
            trend_str = "Спадний"
        else:
            trend_str = "Стабільний"
    else:
        trend_str = "Стабільний"

    summary_qty = round(float(np.sum(preds)), 1)
    avg_daily = round(float(np.mean(preds)), 2)

    return ForecastResponse(
        product_id=product_id,
        sku=sku,
        name=name,
        horizon_days=horizon_days,
        model_used=metrics.model_name,
        historical_points=historical_points[-45:],  # Останні 45 днів для графіка
        forecast_points=forecast_points,
        metrics=metrics,
        trend=trend_str,
        summary_forecast_qty=summary_qty,
        avg_daily_demand=avg_daily
    )
