import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from '@firebase/auth';
import { authenticatedFetch, getFirebaseAuth } from './firebase';
import { EmailVerificationPending } from './emailGate';
import { API_BASE } from '../config/api';

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

const RESEND_COOLDOWN_MS = 60_000;
let lastVerificationSentAt = 0;

/** Envía (en español) el enlace para verificar el correo. Espera 1 min entre envíos. */
export async function sendVerificationEmail(force = false): Promise<boolean> {
  const user = getFirebaseAuth().currentUser;
  if (!user || user.emailVerified) return false;
  if (!force && Date.now() - lastVerificationSentAt < RESEND_COOLDOWN_MS) return true;
  getFirebaseAuth().languageCode = 'es';
  try {
    await sendEmailVerification(user);
    lastVerificationSentAt = Date.now();
    return true;
  } catch {
    // Demasiados envíos seguidos: el enlace anterior sigue sirviendo.
    return false;
  }
}

/** Segundos que faltan para poder reenviar el enlace. */
export function verificationCooldownSeconds(): number {
  return Math.max(0, Math.ceil((lastVerificationSentAt + RESEND_COOLDOWN_MS - Date.now()) / 1000));
}

/** Tras abrir el enlace: recarga la cuenta y renueva el token con el correo ya verificado. */
export async function refreshEmailVerified(): Promise<boolean> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return false;
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}

export function currentAccountEmail(): string | null {
  return getFirebaseAuth().currentUser?.email ?? null;
}

async function requestEmailVerification(): Promise<never> {
  await sendVerificationEmail();
  // La pantalla "Verifica tu correo" ya se abrió (ver emailGate): sin otro aviso.
  throw new EmailVerificationPending();
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
  license_number: string;
  moto_year: number;
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
  // Sin contraseña: la cuenta ya existe en Firebase (entró con Google o Facebook).
  if (password) await createFirebaseAccount(data.email, password);
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
  return loadOwnProfile();
}

/** Perfil de LITHIO de la cuenta de Firebase activa; null si aún no se registró. */
export async function loadOwnProfile(): Promise<AuthUser | null> {
  const response = await fetchWithTimeout(`${API_BASE}/api/users/me`);
  if (response.status === EMAIL_VERIFICATION_REQUIRED) {
    return requestEmailVerification();
  }
  // Cuenta que no es Gmail: se explica el motivo en lugar de "cuenta no encontrada".
  if (response.status === 403 && response.headers.get('X-Email-Domain')) throw new Error(await readError(response));
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

/** Firebase envía (en español) el enlace para crear una contraseña nueva. */
export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  auth.languageCode = 'es';
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    // No se revela si el correo existe: solo se informan errores de formato o de red.
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'auth/user-not-found') return;
    throw error;
  }
}

/** Con la cédula o el teléfono: devuelve el correo de la cuenta parcialmente oculto y le envía el enlace. */
export async function recoverAccount(identity: { cedula: string } | { phone: string }): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  return body.masked_email;
}
