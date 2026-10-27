/**
 * api.ts — Dirección del servidor de LITHIO
 *
 * Una sola fuente para todas las llamadas. La IP de la PC cambia según la red
 * (casa, universidad), así que en desarrollo no se guarda fija:
 *
 * - EXPO_PUBLIC_API_URL con https (túnel de Cloudflare o servidor en la nube):
 *   se usa tal cual.
 * - Web en desarrollo: el servidor está en la misma máquina que sirve la
 *   página, en el puerto 8000.
 * - Teléfono con Expo Go en la misma Wi-Fi: el servidor está en la PC desde la
 *   que Expo envía la app (su IP viene en hostUri), en el puerto 8000.
 * - Si nada de lo anterior aplica, EXPO_PUBLIC_API_URL tal cual.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = 8000;
const configured = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');

function resolveApiBase(): string {
  if (configured.startsWith('https://')) return configured;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    if (protocol === 'http:') return `http://${hostname}:${API_PORT}`;
  }

  const hostUri = Constants.expoConfig?.hostUri; // p. ej. "172.17.101.213:8082"
  const host = hostUri?.split(':')[0];
  if (host && /^(\d{1,3}\.){3}\d{1,3}$|^localhost$/.test(host)) return `http://${host}:${API_PORT}`;

  return configured || `http://localhost:${API_PORT}`;
}

export const API_BASE = resolveApiBase();
export const WS_BASE = API_BASE.replace(/^http/, 'ws');
