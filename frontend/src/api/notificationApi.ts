import api from './axiosConfig';

export interface ActiveAlertItem {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  deficit: number;
  categoryName: string;
  price: number;
  severity: 'warning' | 'error';
  statusText: string;
}

export interface ActiveAlertsSummary {
  totalAlerts: number;
  outStockCount: number;
  lowStockCount: number;
  alerts: ActiveAlertItem[];
}

export interface TelegramStatus {
  isConfigured: boolean;
  isEnabled: boolean;
  chatId: string;
  botToken: string;
  notifyOnLowStock: boolean;
}

export interface TelegramConfigInput {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyOnLowStock: boolean;
}

export const notificationApi = {
  // Отримати активні дефіцити зі складу
  getActiveAlerts: async (): Promise<ActiveAlertsSummary> => {
    const res = await api.get<ActiveAlertsSummary>('/notifications/active-alerts');
    return res.data;
  },

  // Отримати статус Telegram-бота
  getTelegramStatus: async (): Promise<TelegramStatus> => {
    const res = await api.get<TelegramStatus>('/notifications/telegram/status');
    return res.data;
  },

  // Оновити конфігурацію Telegram
  updateTelegramConfig: async (config: TelegramConfigInput): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>('/notifications/telegram/config', config);
    return res.data;
  },

  // Надіслати тестове повідомлення в Telegram
  testTelegram: async (): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>('/notifications/telegram/test');
    return res.data;
  },

  // Розіслати загальне сповіщення (Admin / Manager)
  broadcast: async (data: { title: string; message: string; severity?: string; sendToTelegram?: boolean }): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>('/notifications/broadcast', data);
    return res.data;
  }
};
