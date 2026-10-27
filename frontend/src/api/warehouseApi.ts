import api from './axiosConfig';

export const TransferStatus = {
  Draft: 0,
  InTransit: 1,
  Completed: 2,
  Cancelled: 3
} as const;
export type TransferStatus = typeof TransferStatus[keyof typeof TransferStatus];

export interface WarehouseSummary {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  description?: string | null;
  totalItemsCount: number;
  totalQuantity: number;
  totalValuation: number;
}

export interface CreateWarehouseInput {
  name: string;
  code: string;
  address?: string;
  isDefault?: boolean;
  description?: string;
}

export interface UpdateWarehouseInput {
  name: string;
  code: string;
  address?: string;
  isDefault?: boolean;
  isActive?: boolean;
  description?: string;
}

export interface WarehouseStockItem {
  id: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  productSKU: string;
  categoryName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  minStock?: number | null;
  locationZone?: string | null;
  totalValuation: number;
  lastUpdated: string;
}

export interface WarehouseStockDistributionItem {
  stockId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  quantity: number;
  minStock?: number | null;
  locationZone?: string | null;
}

export interface ProductStockDistribution {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  unit: string;
  price: number;
  totalQuantity: number;
  warehouses: WarehouseStockDistributionItem[];
}

export interface WarehouseTransferItem {
  id: string;
  warehouseTransferId: string;
  productId: string;
  productName: string;
  productSKU: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  notes?: string | null;
}

export interface WarehouseTransfer {
  id: string;
  transferNumber: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  createdAt: string;
  completedAt?: string | null;
  createdByUserName: string;
  status: TransferStatus;
  notes?: string | null;
  totalItemsCount: number;
  totalQuantity: number;
  items: WarehouseTransferItem[];
}

export interface CreateTransferItemInput {
  productId: string;
  quantity: number;
  notes?: string;
}

export interface CreateTransferInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  notes?: string;
  completeImmediately?: boolean;
  items: CreateTransferItemInput[];
}

export const warehouseApi = {
  async getAll(): Promise<WarehouseSummary[]> {
    const res = await api.get('/warehouses');
    return res.data;
  },

  async getById(id: string): Promise<WarehouseSummary> {
    const res = await api.get(`/warehouses/${id}`);
    return res.data;
  },

  async create(data: CreateWarehouseInput): Promise<WarehouseSummary> {
    const res = await api.post('/warehouses', data);
    return res.data;
  },

  async update(id: string, data: UpdateWarehouseInput): Promise<WarehouseSummary> {
    const res = await api.put(`/warehouses/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/warehouses/${id}`);
  },

  async getStocks(warehouseId: string, search?: string): Promise<WarehouseStockItem[]> {
    const res = await api.get(`/warehouses/${warehouseId}/stocks`, { params: { search } });
    return res.data;
  },

  async updateLocation(stockId: string, data: { locationZone?: string; minStock?: number }): Promise<void> {
    await api.put(`/warehouses/stocks/${stockId}/location`, data);
  },

  async getDistribution(params?: { categoryId?: string; search?: string }): Promise<ProductStockDistribution[]> {
    const res = await api.get('/warehouses/distribution', { params });
    return res.data;
  },

  async getTransfers(params?: { status?: TransferStatus; warehouseId?: string; search?: string }): Promise<WarehouseTransfer[]> {
    const res = await api.get('/warehouses/transfers', { params });
    return res.data;
  },

  async getTransferById(id: string): Promise<WarehouseTransfer> {
    const res = await api.get(`/warehouses/transfers/${id}`);
    return res.data;
  },

  async createTransfer(data: CreateTransferInput): Promise<WarehouseTransfer> {
    const res = await api.post('/warehouses/transfers', data);
    return res.data;
  },

  async receiveTransfer(id: string): Promise<WarehouseTransfer> {
    const res = await api.post(`/warehouses/transfers/${id}/receive`);
    return res.data;
  },

  async cancelTransfer(id: string, reason?: string): Promise<WarehouseTransfer> {
    const res = await api.post(`/warehouses/transfers/${id}/cancel`, null, { params: { reason } });
    return res.data;
  }
};
