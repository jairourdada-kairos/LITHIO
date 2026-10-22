import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from '@firebase/auth';
import { authenticatedFetch, getFirebaseAuth } from './firebase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.101.213:8000';
const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await authenticatedFetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('El servidor no responde. Comprueba que el backend esté iniciado y que el teléfono esté en la misma Wi-Fi.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  // Los errores de validación (422) llegan como lista: [{ msg: 'Value error, ...' }]
  if (Array.isArray(body.detail)) {
    const messages = body.detail
      .map((item: { msg?: string }) => (item.msg || '').replace(/^Value error, /, ''))
      .filter(Boolean);
    if (messages.length) return messages.join('\n');
  }
  return typeof body.detail === 'string' ? body.detail : `La solicitud falló (${response.status}).`;
}

// El backend responde 428 cuando el correo ya tiene un perfil creado antes de
// Firebase (p. ej. la cuenta del administrador): solo se vincula con el correo verificado.
const EMAIL_VERIFICATION_REQUIRED = 428;

async function requestEmailVerification(): Promise<never> {
  const user = getFirebaseAuth().currentUser;
  let sent = false;
  if (user) {
    try {
      await sendEmailVerification(user);
      sent = true;
    } catch {
      // Demasiados envíos seguidos: el enlace anterior sigue sirviendo.
    }
  }
  throw new Error(
    sent
      ? `Este correo ya tiene un perfil en LITHIO. Te enviamos un enlace de verificación a ${user?.email}. Ábrelo (revisa también spam) y luego inicia sesión con este mismo correo y contraseña.`
      : 'Este correo ya tiene un perfil en LITHIO. Abre el enlace de verificación que te enviamos por correo y luego inicia sesión.'
  );
}

export interface AuthUser {
  id: number;
  name: string;
  last_name?: string;
  email: string;
  phone: string;
  /** Llega enmascarada desde el backend: V-****5678 */
  cedula?: string;
  career?: string;
  semester?: string;
  role: 'pasajero' | 'conductor' | 'ambos' | 'admin';
  avatar_url?: string;
  points: number;
  xp_level: string;
}

/** Campos obligatorios para pasajeros y conductores (ver backend schemas.RegistrationFields). */
export interface IdentitySignUpData {
  name: string;
  last_name: string;
  cedula: string;
  email: string;
  career: string;
  semester: string;
  phone: string;
  avatar_url?: string;
}

export interface PassengerSignUpData extends IdentitySignUpData {
  age?: number;
}

export interface DriverSignUpData extends IdentitySignUpData {
  age: number;
  moto_brand_model: string;
  moto_color: string;
  plate: string;
  helmet_provided: boolean;
  binance_address?: string;
  mobile_payment_number?: string;
  mobile_payment_bank?: string;
  mobile_payment_id?: string;
  bank_account_number?: string;
}

async function createFirebaseAccount(email: string, password: string) {
  const auth = getFirebaseAuth();
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'auth/email-already-in-use'
    ) {
      return signInWithEmailAndPassword(auth, email, password);
    }
    throw error;
  }
}

async function register(
  path: string,
  data: PassengerSignUpData | DriverSignUpData,
  password: string
): Promise<AuthUser> {
  await createFirebaseAccount(data.email, password);
  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (response.status === EMAIL_VERIFICATION_REQUIRED) {
    return requestEmailVerification();
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export function signUpPassenger(
  data: PassengerSignUpData,
  password: string
): Promise<AuthUser> {
  return register('/api/passengers/register', data, password);
}

export function signUpDriver(
  data: DriverSignUpData,
  password: string
): Promise<AuthUser> {
  return register('/api/drivers/register', data, password);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser | null> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  const response = await fetchWithTimeout(`${API_BASE}/api/users/me`);
  if (response.status === EMAIL_VERIFICATION_REQUIRED) {
    return requestEmailVerification();
  }
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}
