/**
 * socialAuth.ts — Entrar con Google o Facebook
 *
 * La cuenta queda en Firebase igual que con correo; después se pide el perfil
 * de LITHIO. Si es la primera vez, el registro se completa con cédula, carrera,
 * etc. (sin contraseña: la cuenta ya existe en Firebase).
 *
 * - Web: ventana de Google/Facebook de Firebase (signInWithPopup).
 * - APK: SDK nativo de Google / Facebook. Requieren compilar el APK con las
 *   claves (ver DESPLIEGUE.md); en Expo Go no existen.
 */

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import {
  AuthCredential,
  FacebookAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from '@firebase/auth';
import { getFirebaseAuth } from './firebase';
import { isInstalledApp } from '../config/api';
import { AuthUser, loadOwnProfile } from './auth';

export type SocialProvider = 'google' | 'facebook';

export const PROVIDER_LABEL: Record<SocialProvider, string> = { google: 'Google', facebook: 'Facebook' };

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
// Solo el APK con este identificador está registrado en Google y Facebook.
const SOCIAL_ANDROID_APP = 'com.lithio.app';

/** Datos que el proveedor ya conoce, para no volver a pedirlos en el registro. */
export interface SocialPrefill {
  provider: SocialProvider;
  email: string;
  name: string;
  last_name: string;
}

export type SocialResult = { user: AuthUser } | { prefill: SocialPrefill } | { cancelled: true };

/** null si el proveedor está listo; si no, el motivo para mostrarlo al usuario. */
export function socialUnavailableReason(provider: SocialProvider): string | null {
  if (Platform.OS === 'web') return null;
  if (!isInstalledApp) {
    return `En Expo Go no se puede entrar con ${PROVIDER_LABEL[provider]}. Usa tu correo o instala el APK de LITHIO.`;
  }
  if (Platform.OS === 'android' && Application.applicationId !== SOCIAL_ANDROID_APP) {
    return `Para entrar con ${PROVIDER_LABEL[provider]} instala la versión nueva de LITHIO.`;
  }
  const configured = provider === 'google' ? GOOGLE_WEB_CLIENT_ID : FACEBOOK_APP_ID;
  return configured ? null : `Muy pronto podrás entrar con ${PROVIDER_LABEL[provider]}. Por ahora usa tu correo electrónico.`;
}

class SocialCancelled extends Error {}

async function nativeGoogleCredential(): Promise<AuthCredential> {
  // require dentro de la función: en Expo Go el módulo nativo no existe.
  const { GoogleSignin, isSuccessResponse } = require('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Cierra la sesión anterior de Google para que el usuario elija la cuenta.
  await GoogleSignin.signOut().catch(() => undefined);
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response) || !response.data.idToken) throw new SocialCancelled();
  return GoogleAuthProvider.credential(response.data.idToken);
}

async function nativeFacebookCredential(): Promise<AuthCredential> {
  const { AccessToken, LoginManager } = require('react-native-fbsdk-next');
  LoginManager.logOut();
  const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (result.isCancelled) throw new SocialCancelled();
  const token = await AccessToken.getCurrentAccessToken();
  if (!token?.accessToken) throw new SocialCancelled();
  return FacebookAuthProvider.credential(token.accessToken);
}

function friendlyError(provider: SocialProvider, error: unknown): Error {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const label = PROVIDER_LABEL[provider];
  if (code === 'auth/account-exists-with-different-credential') {
    return new Error(`Ese correo ya tiene una cuenta en LITHIO. Entra con tu correo y contraseña (o con el método que usaste al registrarte).`);
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error(`El acceso con ${label} todavía no está activado en LITHIO.`);
  }
  if (code === 'auth/network-request-failed') {
    return new Error('No hay conexión a internet. Inténtalo de nuevo.');
  }
  return new Error(`No se pudo entrar con ${label}. Inténtalo de nuevo o usa tu correo.`);
}

function splitName(displayName: string | null): { name: string; last_name: string } {
  const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { name: parts[0] || '', last_name: '' };
  const half = Math.ceil(parts.length / 2);
  return { name: parts.slice(0, half).join(' '), last_name: parts.slice(half).join(' ') };
}

export async function signInWithSocial(provider: SocialProvider): Promise<SocialResult> {
  const auth = getFirebaseAuth();
  auth.languageCode = 'es';
  try {
    if (Platform.OS === 'web') {
      const webProvider = provider === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      webProvider.addScope('email');
      await signInWithPopup(auth, webProvider);
    } else {
      const credential = provider === 'google' ? await nativeGoogleCredential() : await nativeFacebookCredential();
      await signInWithCredential(auth, credential);
    }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    // Google nativo: SIGN_IN_CANCELLED / '12501'; web: popup cerrado.
    if (
      error instanceof SocialCancelled ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'SIGN_IN_CANCELLED' ||
      code === '12501'
    ) {
      return { cancelled: true };
    }
    throw friendlyError(provider, error);
  }

  const firebaseUser = auth.currentUser;
  if (!firebaseUser?.email) {
    await signOut(auth).catch(() => undefined);
    throw new Error(`Tu cuenta de ${PROVIDER_LABEL[provider]} no tiene un correo. Regístrate con tu correo electrónico.`);
  }

  const user = await loadOwnProfile();
  if (user) return { user };
  return {
    prefill: { provider, email: firebaseUser.email.toLowerCase(), ...splitName(firebaseUser.displayName) },
  };
}
