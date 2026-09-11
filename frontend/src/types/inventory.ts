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
