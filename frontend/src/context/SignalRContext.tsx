import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { 
  Snackbar, 
  Alert, 
  AlertTitle, 
  Slide, 
  type SlideProps 
} from '@mui/material';
import signalRService, { 
  type StockMovementEvent, 
  type ProductChangeEvent, 
  type LowStockAlertEvent, 
  type GeneralNotificationEvent 
} from '../services/signalRService';
import { notificationApi } from '../api/notificationApi';
import { playNotificationSound } from '../utils/soundEffects';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  type?: 'movement' | 'lowStock' | 'productChange' | 'general';
  productId?: string;
  productName?: string;
}

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

interface SignalRContextType {
  connectionState: signalR.HubConnectionState;
  isConnected: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  browserPushEnabled: boolean;
  requestBrowserPushPermission: () => Promise<boolean>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  loadActiveAlerts: () => Promise<void>;
  subscribeStockMovement: (handler: (data: StockMovementEvent) => void) => () => void;
  subscribeProductChange: (handler: (data: ProductChangeEvent) => void) => () => void;
  subscribeLowStockAlert: (handler: (data: LowStockAlertEvent) => void) => () => void;
}

const SignalRContext = createContext<SignalRContextType | null>(null);

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

const STORAGE_KEY = 'inventory_notifications_v1';
const SOUND_KEY = 'inventory_sound_enabled';

export const SignalRProvider: React.FC<{ children: React.ReactNode; isAuthenticated: boolean }> = ({ 
  children, 
  isAuthenticated 
}) => {
  const [connectionState, setConnectionState] = useState<signalR.HubConnectionState>(
    signalR.HubConnectionState.Disconnected
  );
  const [currentToast, setCurrentToast] = useState<ToastNotification | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastNotification[]>([]);

  // Сповіщення та налаштування
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    return localStorage.getItem(SOUND_KEY) !== 'false';
  });

  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  // Збереження сповіщень у LocalStorage
  const saveNotifications = useCallback((updated: AppNotification[]) => {
    setNotifications(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 60))); // Зберігаємо останні 60
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, []);

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
  };

  const requestBrowserPushPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setBrowserPushEnabled(granted);
      return granted;
    } catch {
      return false;
    }
  };

  // Відправка браузерного нативного сповіщення
  const showNativeNotification = useCallback((title: string, message: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
          badge: '/favicon.ico'
        });
      } catch (err) {
        console.debug('Native notification error:', err);
      }
    }
  }, []);

  // Додавання нового сповіщення в систему
  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'read'>) => {
    const item: AppNotification = {
      ...notif,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      read: false
    };

    setNotifications(prev => {
      const next = [item, ...prev].slice(0, 60);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.debug('Failed to save to localStorage:', err);
      }
      return next;
    });

    // Звуковий сигнал
    if (soundEnabled) {
      playNotificationSound(notif.severity);
    }

    // Браузерне Push-сповіщення
    showNativeNotification(notif.title, notif.message);

    // Спливаючий тост
    setToastQueue(prev => [...prev, {
      id: item.id,
      title: item.title,
      message: item.message,
      severity: item.severity
    }]);
  }, [soundEnabled, showNativeNotification]);

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Підключення/відключення SignalR
  useEffect(() => {
    const unsubState = signalRService.onConnectionState((state) => {
      setConnectionState(state);
    });

    if (isAuthenticated) {
      signalRService.start();
    } else {
      signalRService.stop();
    }

    return () => {
      unsubState();
    };
  }, [isAuthenticated]);

  // Підписка на події SignalR
  useEffect(() => {
    const unsubNotify = signalRService.onNotification((event: GeneralNotificationEvent) => {
      addNotification({
        title: event.title,
        message: event.message,
        severity: event.severity,
        timestamp: event.timestamp || new Date().toISOString(),
        type: 'general'
      });
    });

    const unsubLowStock = signalRService.onLowStockAlert((event: LowStockAlertEvent) => {
      addNotification({
        title: 'УВАГА: Критичний залишок!',
        message: `Запас товару '${event.productName}' впав до ${event.currentStock} шт. (MinStock: ${event.minStock} шт.)`,
        severity: event.currentStock === 0 ? 'error' : 'warning',
        timestamp: event.timestamp || new Date().toISOString(),
        type: 'lowStock',
        productId: event.productId,
        productName: event.productName
      });
    });

    return () => {
      unsubNotify();
      unsubLowStock();
    };
  }, [addNotification]);

  // Завантаження активних дефіцитів при запуску
  const loadActiveAlerts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const summary = await notificationApi.getActiveAlerts();
      if (summary && summary.alerts.length > 0) {
        setNotifications(prev => {
          // Додаємо алерти, яких ще немає в списку
          const newAlerts: AppNotification[] = summary.alerts
            .filter(a => !prev.some(p => p.productId === a.id && !p.read))
            .map(a => ({
              id: `active-${a.id}-${Date.now()}`,
              title: a.currentStock === 0 ? 'ТЕРМІНОВО: Товар закінчився!' : 'КРИТИЧНО: Залишок нижче норми',
              message: `${a.name} (${a.sku}): залишок ${a.currentStock} шт. при мінімумі ${a.minStock} шт. (дефіцит: ${a.deficit} шт.)`,
              severity: a.severity,
              timestamp: new Date().toISOString(),
              read: false,
              type: 'lowStock',
              productId: a.id,
              productName: a.name
            }));

          if (newAlerts.length === 0) return prev;
          const merged = [...newAlerts, ...prev].slice(0, 60);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch (err) {
            console.debug('Failed to sync alerts to localStorage:', err);
          }
          return merged;
        });
      }
    } catch (err) {
      console.warn('Could not load active alerts:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadActiveAlerts();
    }
  }, [isAuthenticated, loadActiveAlerts]);

  // Черга тостів
  useEffect(() => {
    if (!currentToast && toastQueue.length > 0) {
      setCurrentToast(toastQueue[0]);
      setToastQueue(prev => prev.slice(1));
    }
  }, [currentToast, toastQueue]);

  const handleToastClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setCurrentToast(null);
  };

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  const clearNotifications = useCallback(() => {
    saveNotifications([]);
  }, [saveNotifications]);

  const subscribeStockMovement = useCallback((handler: (data: StockMovementEvent) => void) => {
    return signalRService.onStockMovement(handler);
  }, []);

  const subscribeProductChange = useCallback((handler: (data: ProductChangeEvent) => void) => {
    return signalRService.onProductChange(handler);
  }, []);

  const subscribeLowStockAlert = useCallback((handler: (data: LowStockAlertEvent) => void) => {
    return signalRService.onLowStockAlert(handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const isConnected = connectionState === signalR.HubConnectionState.Connected;

  return (
    <SignalRContext.Provider value={{
      connectionState,
      isConnected,
      notifications,
      unreadCount,
      soundEnabled,
      setSoundEnabled,
      browserPushEnabled,
      requestBrowserPushPermission,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      loadActiveAlerts,
      subscribeStockMovement,
      subscribeProductChange,
      subscribeLowStockAlert
    }}>
      {children}

      {/* Спливаюче сповіщення реального часу */}
      <Snackbar
        open={Boolean(currentToast)}
        autoHideDuration={5000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        TransitionComponent={SlideTransition}
      >
        {currentToast ? (
          <Alert 
            onClose={handleToastClose} 
            severity={currentToast.severity} 
            variant="filled"
            elevation={6}
            sx={{ width: '100%', maxWidth: 450, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
          >
            <AlertTitle sx={{ fontWeight: 'bold' }}>{currentToast.title}</AlertTitle>
            {currentToast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </SignalRContext.Provider>
  );
};

export const useSignalR = (): SignalRContextType => {
  const context = useContext(SignalRContext);
  if (!context) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  return context;
};

export default SignalRContext;
