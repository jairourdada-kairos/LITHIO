/**
 * AuthLayout.tsx — Estructura común de inicio de sesión y registro
 *
 * Fondo de retícula, botón "Volver", encabezado con la casilla del litio
 * y contenido desplazable que respeta el teclado. El acento distingue el
 * rol: turquesa para pasajero, coral para conductor.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { LatticeBackground } from './LatticeBackground';
import { PeriodicTile } from './PeriodicTile';

interface Props {
  title: string;
  /** Línea bajo el título, p. ej. "Pasajero · Comunidad UNC". */
  subtitle: string;
  accent?: string;
  onBack: () => void;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<Props> = ({ title, subtitle, accent = theme.colors.primary, onBack, children }) => {
  const insets = useSafeAreaInsets();
  return (
  <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <LatticeBackground />
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={onBack}
        style={styles.backBtn}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Text style={[styles.backText, { color: accent }]}>← Volver</Text>
      </Pressable>

      <Animated.View
        entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)}
        style={styles.header}
      >
        <PeriodicTile size={56} accent={accent} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={[styles.subtitle, { color: accent }]}>{subtitle}</Text>
        </View>
      </Animated.View>

      <View style={styles.content}>{children}</View>
    </ScrollView>
  </KeyboardAvoidingView>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 12,
  },
  backText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 26,
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    marginTop: 2,
  },
}));
