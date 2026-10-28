/**
 * websocket.ts — Cliente WebSocket para Notificaciones en Tiempo Real
 *
 * Se conecta al endpoint ws://<host>/ws del backend y autentica el handshake.
 * - Reconexión con espera creciente (1 s → 30 s) para no saturar redes móviles.
 * - Latido PING/PONG cada 25 s: si el servidor no responde, se reconecta.
 * - Tras cada conexión el servidor envía ACTIVE_RIDE_SYNC con el viaje activo,
 *   así se recupera cualquier cambio de estado ocurrido sin conexión.
 */

import { getFirebaseIdToken } from './firebase';
import { getDeviceSession, notifySessionReplaced } from './deviceSession';
import { WS_BASE } from '../config/api';


const HEARTBEAT_MS = 25_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 30_000;

export type WSMessageType =
  | 'AUTHENTICATED'
  | 'SESSION_REPLACED'
  | 'ACTIVE_RIDE_SYNC'
  | 'NEW_RIDE_REQUEST'
  | 'RIDE_STATUS_UPDATED'
  | 'DRIVER_AVAILABILITY_CHANGED'
  | 'DRIVER_APPLICATION_UPDATED'
  | 'WALLET_UPDATED'
  | 'LINK_REQUEST'
  | 'LINK_ACCEPTED'
  | 'PONG';

export interface WSMessage {
  type: WSMessageType;
  [key: string]: any;
}

type MessageHandler = (msg: WSMessage) => void;
type StatusHandler = (connected: boolean) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private attempts = 0;
  private connected = false;

  /**
   * Conecta el WebSocket del usuario autenticado.
   * Se reconecta automáticamente si se pierde la conexión.
   */
  connect() {
    if (this.shouldReconnect) return;
    this.shouldReconnect = true;
    void this._open();
  }

  private async _open() {
    if (!this.shouldReconnect) return;

    let token: string;
    try {
      token = await getFirebaseIdToken();
    } catch {
      this.scheduleReconnect();
      return;
    }

    if (!this.shouldReconnect) return;
    const socket = new WebSocket(`${WS_BASE}/ws`);
    this.socket = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'AUTH', token, session_id: getDeviceSession() }));
    };

    socket.onmessage = (event) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'AUTHENTICATED') {
        this.attempts = 0;
        this.setConnected(true);
        this.startHeartbeat();
        return;
      }
      if (msg.type === 'SESSION_REPLACED') {
        // La cuenta se abrió en otro dispositivo: no se reconecta.
        this.disconnect();
        notifySessionReplaced();
        return;
      }
      if (msg.type === 'PONG') {
        if (this.pongTimer) clearTimeout(this.pongTimer);
        this.pongTimer = null;
        return;
      }
      this.handlers.forEach((h) => h(msg));
    };

    // El detalle del error llega en onclose; aquí no se registra nada para no
    // llenar la pantalla de avisos mientras el teléfono cambia de red.
    socket.onerror = () => {};

    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.stopHeartbeat();
      this.setConnected(false);
      this.scheduleReconnect();
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: 'PING' }));
      if (this.pongTimer) clearTimeout(this.pongTimer);
      // Sin PONG a tiempo la conexión está muerta aunque el sistema no lo sepa.
      this.pongTimer = setTimeout(() => this.socket?.close(), HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.heartbeatTimer = null;
    this.pongTimer = null;
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.attempts, MAX_BACKOFF_MS);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this._open();
    }, delay);
  }

  private setConnected(value: boolean) {
    if (this.connected === value) return;
    this.connected = value;
    this.statusHandlers.forEach((h) => h(value));
  }

  isConnected() {
    return this.connected;
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

  /** Avisa cuando la conexión en tiempo real se abre o se pierde. */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * Cierra la conexión y evita la reconexión automática.
   */
  disconnect() {
    this.shouldReconnect = false;
    this.attempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.setConnected(false);
  }
}

// Exportar instancia singleton
export const wsService = new WebSocketService();
