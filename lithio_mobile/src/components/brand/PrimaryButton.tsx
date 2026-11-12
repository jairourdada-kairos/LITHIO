/**
 * PrimaryButton.tsx — Acción principal de una pantalla
 *
 * Botón sólido con brillo del color de acento: crece al pasar el puntero,
 * se hunde al presionar y muestra un anillo con el foco del teclado.
 * Muestra un indicador mientras `loading` está activo.
 */

import React from 'react';
import { Text, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { theme, themed } from '../../constants/theme';
import { PressableScale } from './PressableScale';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

export const PrimaryButton: React.FC<Props> = ({
  label,
  onPress,
  loading = false,
  disabled = false,
  accent = theme.colors.primary,
  style,
}) => (
  <PressableScale
    onPress={onPress}
    disabled={disabled || loading}
    accessibilityLabel={label}
    accessibilityState={{ busy: loading, disabled: disabled || loading }}
    variant="solid"
    accent={accent}
    style={[styles.button, { backgroundColor: accent, backgroundImage: theme.fx.gloss, boxShadow: theme.fx.glowOf(accent) }, style]}
  >
    {loading ? (
      <ActivityIndicator color={theme.colors.bgDark} />
    ) : (
      <Text style={styles.label}>{label}</Text>
    )}
  </PressableScale>
);

const styles = themed(() => ({
  button: {
    minHeight: 52,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.colors.glassBorderHover,
  },
  label: {
    fontFamily: theme.fonts.bold,
    letterSpacing: 0.3,
    color: theme.colors.bgDark,
    fontSize: 16,  // AQUÍ poniendo otro número se cambia el tamaño de la letra de TODOS los botones grandes
  },
}));
