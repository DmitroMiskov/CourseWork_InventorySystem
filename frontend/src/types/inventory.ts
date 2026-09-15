export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  sku?: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  unit: string;
  categoryId: string;
  category?: Category;
  minStock: number;
  imageUrl?: string;
  createdAt?: string;
}

export interface Partner {
  id: string;
  name: string;
  contactInfo?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  type: number;
  quantity: number;
  change: number;
  note?: string;
  userName?: string;
  supplierName?: string;
  customerName?: string;
  createdAt: string;
}

export interface ProductHistoryItem {
  id: string;
  productId: string;
  change: number;
  stockAfter: number;
  note: string;
  userName: string;
  createdAt: string;
}

export interface CustomJwtPayload {
  unique_name: string;
  role: string;
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"?: string;
}

export interface ServerError {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
  message?: string;
}

export interface HistoricalPoint {
  date: string;
  actual_quantity: number;
}

export interface ForecastPoint {
  date: string;
  day_index: number;
  predicted_demand: number;
  lower_bound_95: number;
  upper_bound_95: number;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  mape: number;
  r2?: number;
  model_name: string;
}

export interface ForecastResponse {
  product_id: string | number;
  sku?: string;
  name?: string;
  horizon_days: number;
  model_used: string;
  historical_points: HistoricalPoint[];
  forecast_points: ForecastPoint[];
  metrics: ModelMetrics;
  trend: string;
  summary_forecast_qty: number;
  avg_daily_demand: number;
}

export interface ProcurementRadarItem {
  product_id: string | number;
  sku: string;
  name: string;
  category: string;
  unit_price: number;
  current_stock: number;
  daily_demand: number;
  daily_demand_std: number;
  lead_time_days: number;
  lead_time_std: number;
  safety_stock: number;
  reorder_point: number;
  eoq: number;
  days_to_depletion: number;
  status: string;
  status_code: 'norm' | 'warning' | 'critical' | 'urgent';
  recommended_order_qty: number;
  estimated_order_cost: number;
  supplier_name: string;
}

export interface ProcurementRadarResponse {
  generated_at: string;
  service_level_z: number;
  total_items_count: number;
  urgent_count: number;
  critical_count: number;
  warning_count: number;
  norm_count: number;
  total_recommended_procurement_cost: number;
  items: ProcurementRadarItem[];
}

export interface AbcXyzItem {
  product_id: string | number;
  sku: string;
  name: string;
  category: string;
  revenue: number;
  share_percent: number;
  cumulative_share_percent: number;
  abc_class: 'A' | 'B' | 'C';
  cv_percent: number;
  xyz_class: 'X' | 'Y' | 'Z';
  matrix_cell: string;
  strategy_recommendation: string;
}

export interface AbcXyzResponse {
  generated_at: string;
  total_products: number;
  total_revenue: number;
  matrix_counts: Record<string, number>;
  items: AbcXyzItem[];
}

export interface CopilotMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions?: CopilotAction[];
  model_used?: string;
  timestamp?: string;
}

export interface CopilotAction {
  label: string;
  action_type: 'open_forecast' | 'open_radar' | 'open_abc' | 'quick_reply' | 'copy_text' | string;
  payload?: string | null;
}

export interface CopilotChatRequest {
  message: string;
  history?: { role: string; content: string }[];
  provider?: string;
  api_key?: string;
}

export interface CopilotChatResponse {
  reply: string;
  intent: string;
  actions: CopilotAction[];
  model_used: string;
  generated_at: string;
}

