import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

interface SignalRContextType {
  connectionState: signalR.HubConnectionState;
  isConnected: boolean;
  subscribeStockMovement: (handler: (data: StockMovementEvent) => void) => () => void;
  subscribeProductChange: (handler: (data: ProductChangeEvent) => void) => () => void;
  subscribeLowStockAlert: (handler: (data: LowStockAlertEvent) => void) => () => void;
}

const SignalRContext = createContext<SignalRContextType | null>(null);

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

export const SignalRProvider: React.FC<{ children: React.ReactNode; isAuthenticated: boolean }> = ({ 
  children, 
  isAuthenticated 
}) => {
  const [connectionState, setConnectionState] = useState<signalR.HubConnectionState>(
    signalR.HubConnectionState.Disconnected
  );
  const [currentToast, setCurrentToast] = useState<ToastNotification | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastNotification[]>([]);

  // Підключення/відключення залежно від статусу авторизації
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

  // Слухаємо глобальні сповіщення для відображення спливаючих повідомлень
  useEffect(() => {
    const unsubNotify = signalRService.onNotification((event: GeneralNotificationEvent) => {
      const toast: ToastNotification = {
        id: `${Date.now()}-${Math.random()}`,
        title: event.title,
        message: event.message,
        severity: event.severity
      };

      setToastQueue(prev => [...prev, toast]);
    });

    return () => {
      unsubNotify();
    };
  }, []);

  // Обробка черги тостів
  useEffect(() => {
    if (!currentToast && toastQueue.length > 0) {
      setCurrentToast(toastQueue[0]);
      setToastQueue(prev => prev.slice(1));
    }
  }, [currentToast, toastQueue]);

  const handleToastClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setCurrentToast(null);
  };

  const subscribeStockMovement = useCallback((handler: (data: StockMovementEvent) => void) => {
    return signalRService.onStockMovement(handler);
  }, []);

  const subscribeProductChange = useCallback((handler: (data: ProductChangeEvent) => void) => {
    return signalRService.onProductChange(handler);
  }, []);

  const subscribeLowStockAlert = useCallback((handler: (data: LowStockAlertEvent) => void) => {
    return signalRService.onLowStockAlert(handler);
  }, []);

  const isConnected = connectionState === signalR.HubConnectionState.Connected;

  return (
    <SignalRContext.Provider value={{
      connectionState,
      isConnected,
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
