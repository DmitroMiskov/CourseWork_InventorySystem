import api from './axiosConfig';

export const InventoryAuditStatus = {
  Draft: 0,
  InProgress: 1,
  Completed: 2,
  Cancelled: 3
} as const;
export type InventoryAuditStatus = typeof InventoryAuditStatus[keyof typeof InventoryAuditStatus];

export const DiscrepancyStatus = {
  Pending: 0,
  Match: 1,
  Surplus: 2,
  Deficit: 3
} as const;
export type DiscrepancyStatus = typeof DiscrepancyStatus[keyof typeof DiscrepancyStatus];

export interface InventoryAuditSummary {
  id: string;
  auditNumber: string;
  title: string;
  createdAt: string;
  completedAt?: string | null;
  createdByUserName: string;
  status: InventoryAuditStatus;
  categoryId?: string | null;
  categoryName?: string | null;
  notes?: string | null;
  totalItemsCount: number;
  checkedItemsCount: number;
  discrepancyCount: number;
  totalSurplusCost: number;
  totalDeficitCost: number;
  netDifferenceCost: number;
}

export interface InventoryAuditItem {
  id: string;
  productId: string;
  productName: string;
  productSKU: string;
  categoryName: string;
  unit: string;
  expectedQuantity: number;
  actualQuantity?: number | null;
  discrepancy?: number | null;
  unitPrice: number;
  discrepancyCost: number;
  status: DiscrepancyStatus;
  notes?: string | null;
}

export interface InventoryAuditDetail extends InventoryAuditSummary {
  items: InventoryAuditItem[];
}

export interface CreateInventoryAuditInput {
  title: string;
  categoryId?: string;
  notes?: string;
}

export interface UpdateItemQuantityInput {
  itemId: string;
  actualQuantity?: number | null;
  notes?: string;
}

export interface CompleteAuditResult {
  auditId: string;
  adjustedProductsCount: number;
  surplusMovementsCount: number;
  deficitMovementsCount: number;
  message: string;
}

export const inventoryAuditApi = {
  // Список усіх документів інвентаризації
  getAudits: async (params?: { status?: number; search?: string }): Promise<InventoryAuditSummary[]> => {
    const res = await api.get<InventoryAuditSummary[]>('/inventoryaudits', { params });
    return res.data;
  },

  // Деталі конкретного переобліку разом з позиціями
  getAuditById: async (id: string): Promise<InventoryAuditDetail> => {
    const res = await api.get<InventoryAuditDetail>(`/inventoryaudits/${id}`);
    return res.data;
  },

  // Створення нового документа інвентаризації
  createAudit: async (input: CreateInventoryAuditInput): Promise<InventoryAuditSummary> => {
    const res = await api.post<InventoryAuditSummary>('/inventoryaudits', input);
    return res.data;
  },

  // Збереження фактичних залишків
  updateItems: async (id: string, items: UpdateItemQuantityInput[]): Promise<InventoryAuditDetail> => {
    const res = await api.put<InventoryAuditDetail>(`/inventoryaudits/${id}/items`, { items });
    return res.data;
  },

  // Автоматичне підтвердження збігу для всіх непорахованих товарів
  matchAllRemaining: async (id: string): Promise<InventoryAuditDetail> => {
    const res = await api.post<InventoryAuditDetail>(`/inventoryaudits/${id}/match-all-remaining`);
    return res.data;
  },

  // Проведення інвентаризації (коригування складу)
  completeAudit: async (id: string): Promise<CompleteAuditResult> => {
    const res = await api.post<CompleteAuditResult>(`/inventoryaudits/${id}/complete`);
    return res.data;
  },

  // Скасування інвентаризації
  cancelAudit: async (id: string): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>(`/inventoryaudits/${id}/cancel`);
    return res.data;
  },

  // Завантаження акта розбіжностей у форматі CSV
  downloadActCsv: async (id: string, auditNumber: string): Promise<void> => {
    const res = await api.get(`/inventoryaudits/${id}/export-csv`, {
      responseType: 'blob'
    });

    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_act_${auditNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};
