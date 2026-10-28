/**
 * api.ts — Dirección del servidor de LITHIO
 *
 * Una sola fuente para todas las llamadas. La IP de la PC cambia según la red
 * (casa, universidad), así que en desarrollo no se guarda fija:
 *
 * - APK instalado: lee la dirección pública vigente de Firebase (config/server,
 *   la publica iniciar_publico.bat en cada arranque) y recuerda la última.
 * - EXPO_PUBLIC_API_URL con https (túnel de Cloudflare o servidor en la nube):
 *   se usa tal cual.
 * - Web en desarrollo: el servidor está en la misma máquina que sirve la
 *   página, en el puerto 8000.
 * - Teléfono con Expo Go en la misma Wi-Fi: el servidor está en la PC desde la
 *   que Expo envía la app (su IP viene en hostUri), en el puerto 8000.
 *
 * API_BASE y WS_BASE son `let`: los módulos que los importan ven el valor nuevo
 * cuando initApiBase() lo actualiza.
 */

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_PORT = 8000;
const CACHE_KEY = 'lithio.apiBase';
const configured = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');

/** App instalada (APK), no Expo Go ni navegador. */
export const isInstalledApp = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

function resolveDevBase(): string {
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

export let API_BASE = resolveDevBase();
export let WS_BASE = API_BASE.replace(/^http/, 'ws');

function setBase(url: string) {
  API_BASE = url.replace(/\/+$/, '');
  WS_BASE = API_BASE.replace(/^http/, 'ws');
}

async function fetchPublishedBase(): Promise<string | null> {
  const project = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const key = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!project || !key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/config/server?key=${key}`,
      { signal: controller.signal }
    );
    if (!response.ok) return null;
    const body = await response.json();
    const url: unknown = body?.fields?.api_url?.stringValue;
    return typeof url === 'string' && url.startsWith('https://') ? url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * En el APK, actualiza la dirección con la publicada en Firebase. Se llama al
 * abrir la app y al volver a primer plano. Sin red, usa la última conocida.
 */
export async function initApiBase(): Promise<void> {
  if (!isInstalledApp) return;
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) setBase(cached);
  } catch {
    // Sin almacenamiento: se usa la configurada.
  }
  const published = await fetchPublishedBase();
  if (published) {
    setBase(published);
    try {
      await AsyncStorage.setItem(CACHE_KEY, published);
    } catch {
      // No se pudo recordar; se volverá a leer la próxima vez.
    }
  }
}
