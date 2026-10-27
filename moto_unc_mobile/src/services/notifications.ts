/**
 * notifications.ts — Notificaciones push (fuera de la app)
 *
 * Solo en el APK: Expo Go ya no recibe notificaciones push en Android y el
 * navegador no las usa. Al iniciar sesión se pide permiso, se obtiene el token
 * de Expo de este teléfono y se registra en el servidor; al cerrar sesión se
 * borra para que el teléfono deje de recibir avisos de esa cuenta.
 *
 * Con la app abierta no se muestra la notificación del sistema: ya aparece el
 * aviso propio de LITHIO por WebSocket.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_BASE, isInstalledApp } from '../config/api';
import { authenticatedFetch } from './firebase';

export const pushSupported = isInstalledApp && Device.isDevice;

if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function saveToken(token: string | null): Promise<void> {
  await authenticatedFetch(`${API_BASE}/api/users/me/push-token`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

/** Pide permiso y registra este teléfono para recibir notificaciones. No lanza errores. */
export async function registerForPush(): Promise<void> {
  if (!pushSupported) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Viajes y avisos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return; // La app sigue funcionando; solo no llegan avisos fuera de ella.

    // Android: token nativo de Firebase; el servidor envía directo por FCM con su
    // propia cuenta de servicio (no hay que subir claves a Expo).
    // iOS: token de Expo (Firebase no entrega a iPhone sin la configuración de Apple).
    if (Platform.OS === 'android') {
      const { data: token } = await Notifications.getDevicePushTokenAsync();
      await saveToken(String(token));
      return;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await saveToken(token);
  } catch (error) {
    console.warn('No se pudieron activar las notificaciones push', error);
  }
}

/** Deja de recibir notificaciones de esta cuenta en este teléfono. */
export async function unregisterPush(): Promise<void> {
  if (!pushSupported) return;
  try {
    await saveToken(null);
  } catch {
    // Sin conexión: el servidor lo borrará cuando otra sesión tome la cuenta.
  }
}
