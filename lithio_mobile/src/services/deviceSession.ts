/**
 * deviceSession.ts — Sesión única por cuenta
 *
 * Al iniciar sesión, el servidor entrega un identificador para este
 * dispositivo. Cada petición y la conexión en tiempo real lo envían; si la
 * cuenta se abre en otro dispositivo, el servidor responde 401 con
 * X-Session-Replaced (o SESSION_REPLACED por WebSocket) y este dispositivo
 * cierra la sesión. El viaje en curso no se pierde: lo recupera el nuevo.
 *
 * Sin dependencias de otros servicios para que firebase.ts y websocket.ts
 * puedan importarlo sin ciclos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lithio.deviceSession';
let current: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

export async function loadDeviceSession(): Promise<string | null> {
  if (!loaded) {
    try {
      current = await AsyncStorage.getItem(KEY);
    } catch {
      current = null;
    }
    loaded = true;
  }
  return current;
}

export function getDeviceSession(): string | null {
  return current;
}

export async function setDeviceSession(sessionId: string | null): Promise<void> {
  current = sessionId;
  loaded = true;
  try {
    if (sessionId) await AsyncStorage.setItem(KEY, sessionId);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento: la sesión vale hasta cerrar la app.
  }
}

/** Avisa a la app (una sola vez por sesión) que otro dispositivo tomó la cuenta. */
export function notifySessionReplaced() {
  if (!current) return;
  current = null;
  void setDeviceSession(null);
  listeners.forEach((listener) => listener());
}

export function onSessionReplaced(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
