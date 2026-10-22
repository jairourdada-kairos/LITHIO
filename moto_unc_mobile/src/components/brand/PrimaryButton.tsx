/**
 * PrimaryButton.tsx — Acción principal de una pantalla
 *
 * Botón sólido con brillo del color de acento y respuesta al presionar.
 * Muestra un indicador mientras `loading` está activo.
 */

import React from 'react';
import { Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../constants/theme';
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
    style={[styles.button, { backgroundColor: accent, boxShadow: `0 6px 20px ${accent}40` }, style]}
  >
    {loading ? (
      <ActivityIndicator color={theme.colors.bgDark} />
    ) : (
      <Text style={styles.label}>{label}</Text>
    )}
  </PressableScale>
);

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.bgDark,
    fontSize: 16,
  },
});
