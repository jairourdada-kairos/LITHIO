/**
 * session.ts — Sesión con rol fijo
 *
 * El rol (pasajero o conductor) se elige al entrar y no cambia dentro de la
 * app: para usar el otro rol hay que cerrar sesión y entrar por la otra puerta.
 * El rol elegido se recuerda para restaurar la sesión al reabrir la app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from '@firebase/auth';
import { getFirebaseAuth, authenticatedFetch } from './firebase';
import { wsService } from './websocket';
import { loadDeviceSession, setDeviceSession } from './deviceSession';
import type { AuthUser } from './auth';

export type SessionRole = 'pasajero' | 'conductor';

const ROLE_KEY = 'lithio.sessionRole';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.101.213:8000';

/** Devuelve un mensaje si la cuenta no puede usar ese rol, o null si puede. */
export function roleAccessError(user: AuthUser, role: SessionRole): string | null {
  if (role === 'conductor' && user.role !== 'conductor' && user.role !== 'ambos') {
    return 'Esta cuenta no tiene perfil de conductor. Entra por "Soy Pasajero" o registra tu moto como conductor.';
  }
  if (role === 'pasajero' && user.role === 'conductor') {
    return 'Esta cuenta es de conductor. Entra por "Soy Conductor".';
  }
  return null;
}

export async function saveSessionRole(role: SessionRole): Promise<void> {
  try {
    await AsyncStorage.setItem(ROLE_KEY, role);
  } catch {
    // Sin almacenamiento la sesión funciona igual; solo no se restaura al reabrir.
  }
}

/** Toma la cuenta para este dispositivo: cualquier otro queda desconectado. */
export async function claimDeviceSession(): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE}/api/sessions`, { method: 'POST' });
  if (!response.ok) throw new Error('No se pudo iniciar la sesión en este dispositivo. Intenta de nuevo.');
  const body = await response.json();
  await setDeviceSession(body.session_id);
}

export async function signOut(): Promise<void> {
  wsService.disconnect();
  await setDeviceSession(null);
  try {
    await AsyncStorage.removeItem(ROLE_KEY);
  } catch {
    // Nada que limpiar.
  }
  try {
    await firebaseSignOut(getFirebaseAuth());
  } catch {
    // Firebase sin configurar: no había sesión que cerrar.
  }
}

function firstAuthState(): Promise<FirebaseUser | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/** Recupera la sesión anterior (usuario de Firebase + rol guardado), si la hay. */
export async function restoreSession(): Promise<{ user: AuthUser; role: SessionRole } | null> {
  try {
    const role = (await AsyncStorage.getItem(ROLE_KEY)) as SessionRole | null;
    if (role !== 'pasajero' && role !== 'conductor') return null;
    const firebaseUser = await firstAuthState();
    if (!firebaseUser) return null;
    // Sin sesión de dispositivo guardada (o reemplazada): hay que entrar de nuevo.
    if (!(await loadDeviceSession())) return null;

    const response = await authenticatedFetch(`${API_BASE}/api/users/me`);
    if (!response.ok) return null;
    const user: AuthUser = await response.json();
    if (roleAccessError(user, role)) return null;
    return { user, role };
  } catch {
    // Sin red o sin backend: se muestra la bienvenida y el usuario entra de nuevo.
    return null;
  }
}
