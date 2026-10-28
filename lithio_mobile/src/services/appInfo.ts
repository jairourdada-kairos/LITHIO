/**
 * appInfo.ts — Qué versión de LITHIO está corriendo
 *
 * Tres datos identifican lo que ve el usuario:
 * - versión (1.0.0) y compilación del APK (build 3): cambian con un APK nuevo;
 * - actualización: el código de EAS Update que se cargó encima del APK
 *   (los primeros 8 caracteres coinciden con el "Android update ID" del panel
 *   de Expo y con lo que imprime publicar_actualizacion.bat).
 */

import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface AppInfo {
  version: string;
  build: string | null;
  /** 'apk' (instalado), 'expo-go' o 'web'. */
  environment: 'apk' | 'expo-go' | 'web';
  /** Código corto de la actualización cargada; null si es el código del propio APK. */
  updateId: string | null;
  updateDate: string | null;
  channel: string | null;
}

function shortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function getAppInfo(): AppInfo {
  const environment =
    Platform.OS === 'web' ? 'web' : Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? 'expo-go' : 'apk';
  const fromUpdate = environment === 'apk' && !Updates.isEmbeddedLaunch && Updates.updateId;
  return {
    version: (environment === 'apk' && Application.nativeApplicationVersion) || Constants.expoConfig?.version || '—',
    build: environment === 'apk' ? Application.nativeBuildVersion : null,
    environment,
    updateId: fromUpdate ? Updates.updateId!.slice(0, 8) : null,
    updateDate: fromUpdate && Updates.createdAt ? shortDate(Updates.createdAt) : null,
    channel: environment === 'apk' ? Updates.channel : null,
  };
}

/** Una línea para pies de pantalla: "LITHIO v1.0.0 · build 3 · act. 01a1803e · 28 oct 2026". */
export function versionLine(info: AppInfo = getAppInfo()): string {
  const parts = [`LITHIO v${info.version}`];
  if (info.environment === 'web') parts.push('web');
  if (info.environment === 'expo-go') parts.push('Expo Go');
  if (info.build) parts.push(`build ${info.build}`);
  if (info.environment === 'apk') {
    parts.push(info.updateId ? `act. ${info.updateId}` : 'sin actualizaciones');
    if (info.updateDate) parts.push(info.updateDate);
  }
  return parts.join(' · ');
}
