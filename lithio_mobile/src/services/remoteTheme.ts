/**
 * remoteTheme.ts — Colores y tamaño de letra que manda el backend (lithio_backend/app/tema_app.py)
 *
 * La app guarda el último tema recibido y lo aplica antes de pintar, así no hay
 * parpadeo. Al abrir (y al volver a primer plano) pregunta al servidor; si algo
 * cambió, lo aplica y avisa para que la interfaz se vuelva a montar con él.
 * Sin red o con una respuesta inválida, la app sigue con el tema que ya tenía.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/api';
import { applyRemoteTheme, RemoteTheme } from '../constants/theme';

const CACHE_KEY = 'lithio.remoteTheme';
const TIMEOUT_MS = 4000;

type Colors = Record<string, string>;

function normalize(raw: unknown): { font_scale: number; colors: { dark: Colors; light: Colors } } {
  const data = (raw && typeof raw === 'object' ? raw : {}) as RemoteTheme;
  const sorted = (c: unknown): Colors => {
    if (!c || typeof c !== 'object') return {};
    return Object.fromEntries(
      Object.entries(c as Colors)
        .filter(([, v]) => typeof v === 'string')
        .sort(([a], [b]) => (a < b ? -1 : 1))
    );
  };
  return {
    font_scale: typeof data.font_scale === 'number' ? data.font_scale : 1,
    colors: { dark: sorted(data.colors?.dark), light: sorted(data.colors?.light) },
  };
}

// Firma del tema que está aplicado ahora; sirve para saber si el del servidor trae algo distinto.
let appliedSignature = JSON.stringify(normalize(null));

function apply(raw: unknown): boolean {
  const theme = normalize(raw);
  const signature = JSON.stringify(theme);
  if (signature === appliedSignature) return false;
  applyRemoteTheme(theme);
  appliedSignature = signature;
  return true;
}

/** Aplica el último tema guardado, antes de pintar la primera pantalla. */
export async function loadCachedTheme(): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) apply(JSON.parse(cached));
  } catch {
    // Sin almacenamiento o dato dañado: se usa el tema original.
  }
}

/** Pide el tema al servidor. Devuelve true si cambió y la interfaz debe volver a montarse. */
export async function refreshRemoteTheme(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/api/theme`, { signal: controller.signal });
    if (!response.ok) return false;
    const raw = await response.json();
    const changed = apply(raw);
    if (changed) await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(normalize(raw))).catch(() => {});
    return changed;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
