/**
 * auth.ts — Servicio de Autenticación
 *
 * Abstrae el registro e inicio de sesión de usuarios.
 * Actualmente usa la API REST propia; los comentarios indican
 * dónde integrar Firebase Auth (Google / Facebook) en el futuro.
 */

// En Expo Go usa la IP LAN real del PC en la misma red Wi‑Fi.
// Cambia este valor solo si la IP de tu red Wi‑Fi cambia.
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.101.213:8000';
const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('El servidor no responde. Comprueba que el backend esté iniciado y que el teléfono esté en la misma Wi-Fi.');
    }
    throw new Error('No se pudo conectar con el servidor. Comprueba la red del teléfono.');
  } finally {
    clearTimeout(timeout);
  }
}

export interface AuthUser {
  id: number;
  name: string;
  last_name?: string;
  email: string;
  phone: string;
  role: 'pasajero' | 'conductor' | 'ambos';
  avatar_url?: string;
  points: number;
  xp_level: string;
  firebase_uid?: string;
}

export interface PassengerSignUpData {
  name: string;
  last_name: string;
  age: number;
  phone: string;
  email: string;
  firebase_uid?: string;
  avatar_url?: string;
}

export interface DriverSignUpData {
  name: string;
  last_name: string;
  age: number;
  phone: string;
  email: string;
  firebase_uid?: string;
  avatar_url?: string;
  // Moto
  moto_brand_model: string;
  moto_color: string;
  plate: string;
  helmet_provided: boolean;
  // Pagos
  binance_address?: string;
  mobile_payment_number?: string;
  bank_account_number?: string;
}

// ---------------------------------------------------------------------------
// Registro de Pasajero
// ---------------------------------------------------------------------------
export async function signUpPassenger(data: PassengerSignUpData): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/passengers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al registrar pasajero');
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Registro de Conductor
// ---------------------------------------------------------------------------
export async function signUpDriver(data: DriverSignUpData): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/drivers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al registrar conductor');
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Login por Email (busca el usuario por email en la API, simulado)
// En producción: verificar con Firebase Auth y luego consultar la API
// ---------------------------------------------------------------------------
export async function signInWithEmail(email: string): Promise<AuthUser | null> {
  // TODO: Integrar Firebase signInWithEmailAndPassword aquí
  // Ejemplo con Firebase:
  //   const credential = await signInWithEmailAndPassword(auth, email, password);
  //   const idToken = await credential.user.getIdToken();
  //   → enviar idToken al backend para verificar y obtener el perfil

  // Por ahora: busca el usuario por email consultando /api/users (no es seguro para producción)
  const res = await fetchWithTimeout(`${API_BASE}/api/users/by-email?email=${encodeURIComponent(email)}`);
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Sign In con Google
// Requiere: expo-auth-session + Firebase Auth o @react-native-google-signin
// ---------------------------------------------------------------------------
export async function signInWithGoogle(): Promise<AuthUser | null> {
  // TODO: Implementar con expo-auth-session:
  // import * as Google from 'expo-auth-session/providers/google';
  // const [request, response, promptAsync] = Google.useIdTokenAuthRequest({...});
  // Cuando response?.type === 'success' → enviar response.params.id_token al backend
  throw new Error('Google Sign-In: configura expo-auth-session y tus Client IDs de Firebase');
}

// ---------------------------------------------------------------------------
// Sign In con Facebook
// Requiere: expo-auth-session + Firebase Auth o expo-facebook
// ---------------------------------------------------------------------------
export async function signInWithFacebook(): Promise<AuthUser | null> {
  // TODO: Implementar con expo-auth-session:
  // import * as Facebook from 'expo-auth-session/providers/facebook';
  throw new Error('Facebook Sign-In: configura expo-auth-session y tu App ID de Meta');
}
