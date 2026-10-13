/**
 * websocket.ts — Cliente WebSocket para Notificaciones en Tiempo Real
 *
 * Se conecta al endpoint ws://<host>/ws/<user_id> del backend FastAPI.
 * Permite recibir notificaciones push sobre solicitudes de viaje y
 * cambios de estado, así como enviar mensajes si fuera necesario.
 */

const WS_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://172.17.101.213:8000').replace(/^http/, 'ws');

export type WSMessageType =
  | 'NEW_RIDE_REQUEST'
  | 'RIDE_STATUS_UPDATED'
  | 'DRIVER_AVAILABILITY_CHANGED';

export interface WSMessage {
  type: WSMessageType;
  [key: string]: any;
}

type MessageHandler = (msg: WSMessage) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private userId: number | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  /**
   * Conecta el WebSocket para el usuario dado.
   * Se reconecta automáticamente si se pierde la conexión.
   */
  connect(userId: number) {
    this.userId = userId;
    this.shouldReconnect = true;
    this._open();
  }

  private _open() {
    if (!this.userId) return;

    const url = `${WS_BASE}/ws/${this.userId}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log(`[WS] Conectado como usuario ${this.userId}`);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        this.handlers.forEach((h) => h(msg));
      } catch {
        console.warn('[WS] Mensaje no válido:', event.data);
      }
    };

    this.socket.onerror = (error) => {
      console.warn('[WS] Error de conexión:', error);
    };

    this.socket.onclose = () => {
      console.log('[WS] Conexión cerrada');
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this._open(), 3000);
      }
    };
  }

  /**
   * Envía un mensaje JSON al servidor.
   */
  send(msg: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  /**
   * Suscribe un handler que se llama con cada mensaje recibido.
   * Devuelve una función para desuscribirse.
   */
  subscribe(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /**
   * Cierra la conexión y evita la reconexión automática.
   */
  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }
}

// Exportar instancia singleton
export const wsService = new WebSocketService();
