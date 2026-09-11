import * as signalR from '@microsoft/signalr';
import { HUB_URL } from '../api/axiosConfig';

export interface StockMovementEvent {
  id: string;
  productId: string;
  productName: string;
  type: string; // "In" | "Out"
  quantity: number;
  newStock: number;
  reason?: string;
  supplierName?: string;
  customerName?: string;
  userName: string;
  timestamp: string;
}

export interface ProductChangeEvent {
  action: 'Created' | 'Updated' | 'Deleted' | 'StockUpdated' | 'Imported' | string;
  productId?: string;
  productName?: string;
  newQuantity?: number;
  message?: string;
  timestamp: string;
}

export interface LowStockAlertEvent {
  productId: string;
  productName: string;
  currentStock: number;
  minStock: number;
  timestamp: string;
}

export interface GeneralNotificationEvent {
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

type StockMovementHandler = (data: StockMovementEvent) => void;
type ProductChangeHandler = (data: ProductChangeEvent) => void;
type LowStockAlertHandler = (data: LowStockAlertEvent) => void;
type GeneralNotificationHandler = (data: GeneralNotificationEvent) => void;
type ConnectionStateChangeHandler = (state: signalR.HubConnectionState) => void;

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private stockMovementHandlers: Set<StockMovementHandler> = new Set();
  private productChangeHandlers: Set<ProductChangeHandler> = new Set();
  private lowStockAlertHandlers: Set<LowStockAlertHandler> = new Set();
  private notificationHandlers: Set<GeneralNotificationHandler> = new Set();
  private connectionStateHandlers: Set<ConnectionStateChangeHandler> = new Set();
  private isStarting: boolean = false;

  public getConnectionState(): signalR.HubConnectionState {
    return this.connection ? this.connection.state : signalR.HubConnectionState.Disconnected;
  }

  public async start(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    if (this.isStarting) {
      return;
    }

    this.isStarting = true;

    try {
      if (!this.connection) {
        this.connection = new signalR.HubConnectionBuilder()
          .withUrl(HUB_URL, {
            accessTokenFactory: () => localStorage.getItem('token') || '',
            skipNegotiation: false,
            transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .configureLogging(signalR.LogLevel.Information)
          .build();

        this.connection.on('ReceiveStockMovement', (data: StockMovementEvent) => {
          this.stockMovementHandlers.forEach(handler => handler(data));
        });

        this.connection.on('ReceiveProductChange', (data: ProductChangeEvent) => {
          this.productChangeHandlers.forEach(handler => handler(data));
        });

        this.connection.on('ReceiveLowStockAlert', (data: LowStockAlertEvent) => {
          this.lowStockAlertHandlers.forEach(handler => handler(data));
        });

        this.connection.on('ReceiveNotification', (data: GeneralNotificationEvent) => {
          this.notificationHandlers.forEach(handler => handler(data));
        });

        this.connection.onreconnecting(() => {
          this.notifyConnectionState();
        });

        this.connection.onreconnected(() => {
          this.notifyConnectionState();
        });

        this.connection.onclose(() => {
          this.notifyConnectionState();
        });
      }

      if (this.connection.state === signalR.HubConnectionState.Disconnected) {
        await this.connection.start();
        this.notifyConnectionState();
      }
    } catch (err) {
      console.warn('SignalR connection error (will retry when active):', err);
    } finally {
      this.isStarting = false;
    }
  }

  public async stop(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (err) {
        console.error('Error stopping SignalR:', err);
      } finally {
        this.connection = null;
        this.notifyConnectionState();
      }
    }
  }

  public onStockMovement(handler: StockMovementHandler): () => void {
    this.stockMovementHandlers.add(handler);
    return () => this.stockMovementHandlers.delete(handler);
  }

  public onProductChange(handler: ProductChangeHandler): () => void {
    this.productChangeHandlers.add(handler);
    return () => this.productChangeHandlers.delete(handler);
  }

  public onLowStockAlert(handler: LowStockAlertHandler): () => void {
    this.lowStockAlertHandlers.add(handler);
    return () => this.lowStockAlertHandlers.delete(handler);
  }

  public onNotification(handler: GeneralNotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  public onConnectionState(handler: ConnectionStateChangeHandler): () => void {
    this.connectionStateHandlers.add(handler);
    handler(this.getConnectionState());
    return () => this.connectionStateHandlers.delete(handler);
  }

  private notifyConnectionState() {
    const state = this.getConnectionState();
    this.connectionStateHandlers.forEach(handler => handler(state));
  }
}

export const signalRService = new SignalRService();
export default signalRService;
