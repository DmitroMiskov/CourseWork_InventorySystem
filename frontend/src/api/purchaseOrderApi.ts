import api from './axiosConfig';

export const PurchaseOrderStatus = {
  Draft: 0,
  PendingApproval: 1,
  Approved: 2,
  Sent: 3,
  PartiallyReceived: 4,
  Completed: 5,
  Cancelled: 6
} as const;
export type PurchaseOrderStatus = typeof PurchaseOrderStatus[keyof typeof PurchaseOrderStatus];

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productName: string;
  productSKU: string;
  categoryName: string;
  unit: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  totalCost: number;
  notes?: string | null;
}

export interface PurchaseOrderSummary {
  id: string;
  orderNumber: string;
  title: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  expectedDeliveryDate?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  createdByUserName: string;
  approvedByUserName?: string | null;
  status: PurchaseOrderStatus;
  totalAmount: number;
  totalItemsCount: number;
  totalOrderedQuantity: number;
  totalReceivedQuantity: number;
  notes?: string | null;
}

export interface PurchaseOrderDetail extends PurchaseOrderSummary {
  items: PurchaseOrderItem[];
}

export interface CreatePurchaseOrderItemInput {
  productId: string;
  orderedQuantity: number;
  unitPrice: number;
  notes?: string;
}

export interface CreatePurchaseOrderInput {
  title: string;
  supplierId: string;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  items: CreatePurchaseOrderItemInput[];
}

export interface UpdatePurchaseOrderInput {
  title: string;
  supplierId: string;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  items: CreatePurchaseOrderItemInput[];
}

export interface ReceiveItemInput {
  itemId: string;
  quantityToReceive: number;
}

export interface ReceivePurchaseOrderInput {
  items: ReceiveItemInput[];
  notes?: string;
}

export const purchaseOrderApi = {
  async getAll(params?: { status?: PurchaseOrderStatus; supplierId?: string; search?: string }): Promise<PurchaseOrderSummary[]> {
    const res = await api.get('/purchaseorders', { params });
    return res.data;
  },

  async getById(id: string): Promise<PurchaseOrderDetail> {
    const res = await api.get(`/purchaseorders/${id}`);
    return res.data;
  },

  async create(data: CreatePurchaseOrderInput): Promise<PurchaseOrderDetail> {
    const res = await api.post('/purchaseorders', data);
    return res.data;
  },

  async update(id: string, data: UpdatePurchaseOrderInput): Promise<PurchaseOrderDetail> {
    const res = await api.put(`/purchaseorders/${id}`, data);
    return res.data;
  },

  async submitForApproval(id: string): Promise<PurchaseOrderDetail> {
    const res = await api.post(`/purchaseorders/${id}/submit`);
    return res.data;
  },

  async approve(id: string): Promise<PurchaseOrderDetail> {
    const res = await api.post(`/purchaseorders/${id}/approve`);
    return res.data;
  },

  async sendToSupplier(id: string): Promise<PurchaseOrderDetail> {
    const res = await api.post(`/purchaseorders/${id}/send`);
    return res.data;
  },

  async receiveItems(id: string, data: ReceivePurchaseOrderInput): Promise<PurchaseOrderDetail> {
    const res = await api.post(`/purchaseorders/${id}/receive`, data);
    return res.data;
  },

  async cancel(id: string, reason?: string): Promise<PurchaseOrderDetail> {
    const res = await api.post(`/purchaseorders/${id}/cancel`, null, { params: { reason } });
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/purchaseorders/${id}`);
  }
};
