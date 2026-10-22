/**
 * webAlert.ts — Alert.alert también en el navegador
 *
 * En React Native Web, Alert.alert no muestra nada: los errores (p. ej. al
 * iniciar sesión) pasaban en silencio. Aquí se reemplaza en web por los
 * diálogos del navegador. En iOS y Android no cambia nada.
 */

import { Alert, AlertButton, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const actions = buttons ?? [];
    const cancel = actions.find((b) => b.style === 'cancel');
    const confirm = [...actions].reverse().find((b) => b.style !== 'cancel');

    if (cancel && confirm) {
      // Dos opciones: Aceptar ejecuta la acción principal, Cancelar la de cancelar.
      (window.confirm(text) ? confirm : cancel).onPress?.();
      return;
    }
    window.alert(text);
    (confirm ?? cancel)?.onPress?.();
  };
}
