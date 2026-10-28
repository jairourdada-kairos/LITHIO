import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getDeviceSession, notifySessionReplaced } from './deviceSession';
import { notifyEmailVerificationRequired } from './emailGate';
import { FirebaseError, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from '@firebase/auth';

let auth: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (auth) return auth;

  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  const missingConfig = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingConfig.length > 0) {
    throw new Error(
      `Configura Firebase en lithio_mobile/.env (${missingConfig.join(', ')}).`
    );
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  // getReactNativePersistence solo existe en la versión de Firebase para iOS y
  // Android. En el navegador, getAuth ya recuerda la sesión (IndexedDB).
  if (Platform.OS === 'web') {
    auth = getAuth(app);
    return auth;
  }
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (!(error instanceof FirebaseError) || error.code !== 'auth/already-initialized') {
      throw error;
    }
    auth = getAuth(app);
  }
  return auth;
}

export async function getFirebaseIdToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error('Inicia sesión para continuar.');
  }
  return user.getIdToken();
}

export async function authenticatedFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await getFirebaseIdToken()}`);
  const sessionId = getDeviceSession();
  if (sessionId) headers.set('X-Session-Id', sessionId);
  const response = await fetch(url, { ...init, headers });
  // Otro dispositivo inició sesión con esta cuenta: este la cierra.
  if (response.status === 401 && response.headers.get('X-Session-Replaced')) notifySessionReplaced();
  // La cuenta aún no verificó su correo de Gmail: App muestra "Verifica tu correo".
  if (response.status === 428 && response.headers.get('X-Email-Verification')) notifyEmailVerificationRequired();
  return response;
}
