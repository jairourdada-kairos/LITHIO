/**
 * haptics.ts — Vibración sutil al tocar (expo-haptics).
 *
 * expo-haptics es nativo: los APK compilados antes de añadirlo no lo traen y la
 * actualización por EAS Update llega igual a ellos. Por eso se carga solo si el
 * módulo nativo existe; si no, estas funciones no hacen nada (sin error).
 * En la web tampoco vibra.
 *
 * En Android, expo-haptics vibra con intensidad 30/255, que en muchos teléfonos
 * (Huawei, por ejemplo) no se siente. Ahí usamos Vibration de React Native, que
 * vibra con la intensidad por defecto del teléfono. Solo se activa si el módulo
 * de expo-haptics existe: ese APK trae el permiso VIBRATE (sin él, Android falla).
 */

import { Platform, Vibration } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type HapticsModule = typeof import('expo-haptics');

let haptics: HapticsModule | null = null;
try {
  if (Platform.OS !== 'web' && requireOptionalNativeModule('ExpoHaptics')) {
    haptics = require('expo-haptics') as HapticsModule;
  }
} catch {
  haptics = null;
}

const android = Platform.OS === 'android' && haptics !== null;

const quiet = (promise: Promise<void> | undefined) => {
  promise?.catch(() => {});
};

// Duraciones en ms. CAMBIA AQUÍ si la vibración se siente muy fuerte o muy débil.
const buzz = (pattern: number | number[]) => {
  try {
    Vibration.vibrate(pattern);
  } catch {
    // sin vibrador o sin permiso: no hacer nada
  }
};

/** Elegir una opción (pestaña, selector, ruta). */
export const hapticSelect = () => (android ? buzz(18) : quiet(haptics?.selectionAsync()));

/** Tocar un botón principal. */
export const hapticTap = () =>
  android ? buzz(28) : quiet(haptics?.impactAsync(haptics.ImpactFeedbackStyle.Light));

/** Algo salió bien (compra hecha, viaje aceptado o completado). */
export const hapticSuccess = () =>
  android
    ? buzz([0, 35, 70, 35])
    : quiet(haptics?.notificationAsync(haptics.NotificationFeedbackType.Success));
