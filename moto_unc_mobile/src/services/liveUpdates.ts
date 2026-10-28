/**
 * liveUpdates.ts — Aplicar las actualizaciones (EAS Update) sin esperar
 *
 * Por defecto expo-updates descarga la actualización en segundo plano y la usa
 * en el siguiente arranque "en frío". Android casi nunca cierra la app del
 * todo, así que el usuario seguía viendo la versión vieja. Ahora:
 * - Al abrir: si hay una actualización, se descarga mientras se ve el átomo
 *   de inicio y la app se reinicia sola con ella (máximo unos segundos).
 * - Al volver a la app: se descarga en segundo plano y se ofrece reiniciar.
 */

import * as Updates from 'expo-updates';
import { isInstalledApp } from '../config/api';

const STARTUP_TIMEOUT_MS = 6000;

const enabled = () => isInstalledApp && !__DEV__ && Updates.isEnabled;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function downloadIfAvailable(): Promise<boolean> {
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return false;
  const fetched = await Updates.fetchUpdateAsync();
  return fetched.isNew;
}

/**
 * Al arrancar: descarga y aplica la actualización pendiente. Si la red está
 * lenta, se rinde a los 6 s y la app abre normal (la usará el próximo arranque).
 */
export async function applyUpdateOnStartup(): Promise<void> {
  if (!enabled()) return;
  try {
    const ready = await withTimeout(downloadIfAvailable(), STARTUP_TIMEOUT_MS);
    if (ready) await Updates.reloadAsync();
  } catch {
    // Sin red o servidor de Expo caído: se sigue con la versión actual.
  }
}

/** Al volver a la app: true si quedó lista una actualización para reiniciar. */
export async function downloadUpdateInBackground(): Promise<boolean> {
  if (!enabled()) return false;
  try {
    return await downloadIfAvailable();
  } catch {
    return false;
  }
}

export function restartWithUpdate(): void {
  void Updates.reloadAsync().catch(() => undefined);
}
