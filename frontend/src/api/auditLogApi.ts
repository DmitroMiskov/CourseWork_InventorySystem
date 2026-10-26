import api from './axiosConfig';

export interface AuditLogItem {
  id: string;
  userId?: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  details?: string | null;
  oldValues?: string | null;
  newValues?: string | null;
  ipAddress?: string | null;
  timestamp: string;
}

export interface AuditLogListResponse {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: AuditLogItem[];
}

export interface UserActivity {
  userName: string;
  actionsCount: number;
  lastAction: string;
}

export interface AuditStats {
  totalLogs: number;
  todayLogs: number;
  weekLogs: number;
  actionsBreakdown: Record<string, number>;
  entitiesBreakdown: Record<string, number>;
  topUsers: UserActivity[];
}

export interface AuditLogFilterParams {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
  userName?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export const auditLogApi = {
  // Отримати список записів аудиту з фільтрами та пагінацією
  getLogs: async (params: AuditLogFilterParams = {}): Promise<AuditLogListResponse> => {
    const res = await api.get<AuditLogListResponse>('/auditlogs', { params });
    return res.data;
  },

  // Отримати аналітику та зведену статистику журналу дій
  getStats: async (): Promise<AuditStats> => {
    const res = await api.get<AuditStats>('/auditlogs/stats');
    return res.data;
  },

  // Завантажити експорт у CSV форматі
  downloadCsv: async (filters: Pick<AuditLogFilterParams, 'action' | 'entityType' | 'fromDate' | 'toDate'> = {}): Promise<void> => {
    const res = await api.get('/auditlogs/export', {
      params: filters,
      responseType: 'blob'
    });

    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.setAttribute('download', `audit_log_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};
