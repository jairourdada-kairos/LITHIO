/**
 * websocket.ts — Cliente WebSocket para Notificaciones en Tiempo Real
 *
 * Se conecta al endpoint ws://<host>/ws del backend y autentica el handshake.
 * Permite recibir notificaciones push sobre solicitudes de viaje y
 * cambios de estado, así como enviar mensajes si fuera necesario.
 */

import { getFirebaseIdToken } from './firebase';

const WS_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://172.17.101.213:8000').replace(/^http/, 'ws');

export type WSMessageType =
  | 'AUTHENTICATED'
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
  private handlers: MessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  /**
   * Conecta el WebSocket para el usuario dado.
   * Se reconecta automáticamente si se pierde la conexión.
   */
  connect() {
    this.shouldReconnect = true;
    void this._open();
  }

  private async _open() {
    if (!this.shouldReconnect) return;

    let token: string;
    try {
      token = await getFirebaseIdToken();
    } catch (error) {
      console.error(
        '[WS] No se pudo autenticar la conexión.',
        error instanceof Error ? error.message : 'Error de autenticación'
      );
      this.scheduleReconnect();
      return;
    }

    if (!this.shouldReconnect) return;
    const socket = new WebSocket(`${WS_BASE}/ws`);
    this.socket = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'AUTH', token }));
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        if (msg.type === 'AUTHENTICATED') return;
        this.handlers.forEach((h) => h(msg));
      } catch {
        console.warn('[WS] Mensaje no válido.');
      }
    };

    socket.onerror = (error) => {
      console.warn('[WS] Error de conexión:', error);
    };

    socket.onclose = () => this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.shouldReconnect && !this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        void this._open();
      }, 3000);
    }
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
