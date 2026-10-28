/**
 * Feedback.tsx — Avisos y diálogos propios de LITHIO
 *
 * Ningún mensaje usa las alertas del sistema operativo: `installAlertBridge()`
 * redirige `Alert.alert` (en iOS, Android y web) a este diálogo con el diseño
 * de la app, y `friendlyMessage()` traduce errores técnicos (red, Firebase,
 * fallos de JavaScript) a mensajes claros en español.
 *
 * - Errores e información sin acción: se cierran solos a los pocos segundos.
 * - Confirmaciones (dos o más botones) o avisos con acción: esperan al usuario.
 *
 * Uso directo: `showFeedback({ title, message, tone, buttons })`.
 */

import React, { useEffect, useState } from 'react';
import { Alert, AlertButton, Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Icon } from './Icon';
import { theme, themed } from '../../constants/theme';

export type FeedbackTone = 'error' | 'success' | 'info' | 'confirm';

export interface FeedbackButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface FeedbackConfig {
  title: string;
  message?: string;
  tone?: FeedbackTone;
  buttons?: FeedbackButton[];
}

type Entry = FeedbackConfig & { id: number; tone: FeedbackTone };

// ---------------------------------------------------------------- mensajes

const NETWORK = /network request failed|failed to fetch|networkerror|network error|timed? ?out|abort|econn|load failed/i;
const TECHNICAL = /is not a function|undefined|null is not|cannot read|unexpected token|typeerror|referenceerror|\(0,\s*_/i;

const FIREBASE: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No hay una cuenta con ese correo.',
  'auth/invalid-email': 'Ese correo no es válido.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  'auth/network-request-failed': 'No hay conexión a internet. Revisa tu red e intenta de nuevo.',
  'auth/requires-recent-login': 'Por seguridad, cierra sesión y vuelve a entrar para hacer este cambio.',
  'auth/user-disabled': 'Esta cuenta está desactivada. Escribe al administrador de LITHIO.',
};

/** Convierte cualquier error (o texto de error) en un mensaje para el usuario. */
export function friendlyMessage(input: unknown, fallback = 'Intenta de nuevo.'): string {
  const raw =
    typeof input === 'string'
      ? input
      : input instanceof Error
        ? input.message
        : input && typeof input === 'object' && 'message' in input
          ? String((input as { message: unknown }).message)
          : '';
  if (!raw) return fallback;
  const code = raw.match(/auth\/[a-z-]+/)?.[0];
  if (code) return FIREBASE[code] ?? 'No se pudo verificar tu cuenta. Intenta de nuevo.';
  if (NETWORK.test(raw)) return 'No hay conexión con el servidor de LITHIO. Revisa tu internet e intenta de nuevo.';
  if (TECHNICAL.test(raw)) return 'Algo salió mal en la app. Intenta de nuevo; si sigue pasando, avísanos.';
  return raw;
}

function guessTone(title: string, buttons?: FeedbackButton[]): FeedbackTone {
  if (buttons && buttons.length > 1) return 'confirm';
  if (/^(no se pudo|no puedes|no hay|error|falt|permiso|sin conexi|algo sali)/i.test(title)) return 'error';
  if (/(enviad|guardad|listo|gracias|luz verde|aprobad|canjead|donar|sumaste)/i.test(title)) return 'success';
  return 'info';
}

// ---------------------------------------------------------------- estado global

let nextId = 1;
let queue: Entry[] = [];
const listeners = new Set<(entries: Entry[]) => void>();
const emit = () => listeners.forEach((listener) => listener(queue));

export function showFeedback(config: FeedbackConfig) {
  const tone = config.tone ?? guessTone(config.title, config.buttons);
  const message = config.message ? friendlyMessage(config.message, config.message) : undefined;
  queue = [...queue, { ...config, message, tone, id: nextId++ }];
  emit();
}

function dismiss(id: number) {
  queue = queue.filter((entry) => entry.id !== id);
  emit();
}

let installed = false;
/** Reemplaza Alert.alert en todas las plataformas por el diálogo de LITHIO. */
export function installAlertBridge() {
  if (installed) return;
  installed = true;
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    showFeedback({
      title,
      message,
      buttons: buttons?.map((b) => ({ text: b.text ?? 'OK', style: b.style, onPress: b.onPress ? () => b.onPress?.() : undefined })),
    });
  };
}

// ---------------------------------------------------------------- vista

const TONES = () => ({
  error: { color: theme.colors.error, icon: 'alert-circle-outline' as const },
  success: { color: theme.colors.success, icon: 'checkmark-circle-2-outline' as const },
  info: { color: theme.colors.primary, icon: 'info-outline' as const },
  confirm: { color: theme.colors.warning, icon: 'question-mark-circle-outline' as const },
});

const AUTO_CLOSE_MS = 3800;

export const FeedbackHost: React.FC = () => {
  const [entries, setEntries] = useState<Entry[]>(queue);

  useEffect(() => {
    listeners.add(setEntries);
    return () => {
      listeners.delete(setEntries);
    };
  }, []);

  const current = entries[0];
  const needsAnswer = Boolean(current && (current.buttons?.length ?? 0) > 0 && current.buttons!.some((b) => b.onPress || b.style === 'cancel'));

  useEffect(() => {
    if (!current || needsAnswer) return;
    const timer = setTimeout(() => dismiss(current.id), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [current, needsAnswer]);

  if (!current) return null;
  const tone = TONES()[current.tone];
  const buttons: FeedbackButton[] = current.buttons?.length ? current.buttons : [{ text: 'Entendido' }];

  const press = (button: FeedbackButton) => {
    dismiss(current.id);
    button.onPress?.();
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => {
      const cancel = buttons.find((b) => b.style === 'cancel');
      if (cancel || !needsAnswer) press(cancel ?? buttons[0]);
    }}>
      <Animated.View entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)} style={styles.scrim}>
        <Pressable style={styles.backdrop} onPress={() => !needsAnswer && dismiss(current.id)} accessibilityLabel="Cerrar aviso" />
        <Animated.View
          key={current.id}
          entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
          style={[styles.card, { borderColor: tone.color }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.surface }]}>
            <Icon name={tone.icon} size={28} color={tone.color} />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <View style={[styles.actions, buttons.length > 2 && styles.actionsColumn]}>
            {buttons.map((button, index) => {
              const primary = button.style !== 'cancel' && index === buttons.length - 1;
              const destructive = button.style === 'destructive';
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => press(button)}
                  style={({ pressed }) => [
                    styles.button,
                    buttons.length <= 2 && styles.buttonFlex,
                    primary && { backgroundColor: destructive ? theme.colors.error : tone.color, borderColor: 'transparent' },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.buttonText,
                      primary && { color: theme.colors.bgDark },
                      !primary && destructive && { color: theme.colors.error },
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = themed(() => ({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.scrim,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 10,
    padding: 22,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    backgroundColor: theme.colors.bgDark,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  message: {
    fontFamily: theme.fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 8,
  },
  actionsColumn: {
    flexDirection: 'column',
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFlex: {
    flex: 1,
  },
  buttonText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  pressed: {
    opacity: 0.8,
  },
}));
