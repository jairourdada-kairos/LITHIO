/**
 * appVersion.ts — ¿Hace falta instalar un APK nuevo?
 *
 * Los cambios de pantallas y lógica llegan solos (EAS Update). Este control es
 * para los cambios nativos, que exigen otro APK: el servidor indica la
 * compilación mínima y la recomendada (ver app/routers/app_version.py).
 */

import * as Application from 'expo-application';
import { API_BASE, isInstalledApp } from '../config/api';

export interface VersionCheck {
  required: boolean;
  suggested: boolean;
  downloadUrl: string | null;
}

export async function checkAppVersion(): Promise<VersionCheck | null> {
  if (!isInstalledApp) return null;
  const build = Number(Application.nativeBuildVersion);
  if (!Number.isFinite(build)) return null;
  try {
    const response = await fetch(`${API_BASE}/api/app/version`);
    if (!response.ok) return null;
    const info = await response.json();
    const required = info.min_build > 0 && build < info.min_build;
    const suggested = !required && info.latest_build > 0 && build < info.latest_build;
    return required || suggested ? { required, suggested, downloadUrl: info.download_url } : null;
  } catch {
    return null; // Sin red: no se bloquea a nadie por no poder comprobar.
  }
}
