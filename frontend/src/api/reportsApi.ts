import api from './axiosConfig';

export interface TurnoverItem {
  productId: string;
  productSKU: string;
  productName: string;
  categoryName: string;
  unit: string;
  unitPrice: number;
  openingQuantity: number;
  openingAmount: number;
  inflowQuantity: number;
  inflowAmount: number;
  outflowQuantity: number;
  outflowAmount: number;
  closingQuantity: number;
  closingAmount: number;
}

export interface TurnoverStatement {
  fromDate: string;
  toDate: string;
  generatedAt: string;
  totalProductsCount: number;
  totalOpeningAmount: number;
  totalInflowAmount: number;
  totalOutflowAmount: number;
  totalClosingAmount: number;
  totalInflowQuantity: number;
  totalOutflowQuantity: number;
  items: TurnoverItem[];
}

export interface CategoryValuation {
  categoryId: string;
  categoryName: string;
  productsCount: number;
  totalQuantity: number;
  totalValuation: number;
  sharePercentage: number;
}

export interface StockValuationReport {
  asOfDate: string;
  totalItemsCount: number;
  totalStockQuantity: number;
  totalWarehouseValuation: number;
  categories: CategoryValuation[];
}

export interface PartnerActivity {
  partnerId: string;
  partnerName: string;
  partnerType: string;
  operationsCount: number;
  totalQuantity: number;
  totalEstimatedCost: number;
  lastActivityDate?: string | null;
}

export interface PartnersReport {
  fromDate: string;
  toDate: string;
  topSuppliers: PartnerActivity[];
  topCustomers: PartnerActivity[];
}

export interface TurnoverFilterParams {
  fromDate?: string;
  toDate?: string;
  categoryId?: string;
  search?: string;
}

export const reportsApi = {
  // Оборотно-сальдова відомість (ОСВ)
  getTurnoverStatement: async (params: TurnoverFilterParams = {}): Promise<TurnoverStatement> => {
    const res = await api.get<TurnoverStatement>('/reports/turnover-statement', { params });
    return res.data;
  },

  // Завантаження ОСВ у форматі CSV (Excel)
  downloadTurnoverCsv: async (params: Omit<TurnoverFilterParams, 'search'> = {}): Promise<void> => {
    const res = await api.get('/reports/turnover-statement/export-csv', {
      params,
      responseType: 'blob'
    });

    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `turnover_statement_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Оцінка вартості товарних залишків
  getStockValuation: async (): Promise<StockValuationReport> => {
    const res = await api.get<StockValuationReport>('/reports/stock-valuation');
    return res.data;
  },

  // Аналітика активності контрагентів
  getPartnersActivity: async (params: { fromDate?: string; toDate?: string } = {}): Promise<PartnersReport> => {
    const res = await api.get<PartnersReport>('/reports/partners-activity', { params });
    return res.data;
  }
};
