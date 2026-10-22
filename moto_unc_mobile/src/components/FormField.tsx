/**
 * FormField.tsx — Campo de texto con etiqueta, ayuda y mensaje de error
 *
 * Vive fuera de las pantallas a propósito: un componente definido dentro de
 * otro se vuelve a crear en cada render y el teclado se cierra al escribir.
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../constants/theme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Elemento a la izquierda del campo, p. ej. el selector V / E de la cédula. */
  prefix?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const FormField: React.FC<Props> = ({ label, error, hint, required, prefix, containerStyle, ...inputProps }) => (
  <View style={[styles.group, containerStyle]}>
    <Text style={styles.label}>
      {label}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
    <View style={styles.inputRow}>
      {prefix}
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={theme.colors.textMuted}
        autoCorrect={false}
        accessibilityLabel={label}
        {...inputProps}
      />
    </View>
    {error ? (
      <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
    ) : hint ? (
      <Text style={styles.hint}>{hint}</Text>
    ) : null}
  </View>
);

export const fieldStyles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
});

const styles = StyleSheet.create({
  group: {
    marginBottom: 16,
  },
  label: fieldStyles.label,
  required: {
    color: theme.colors.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0, // Sin esto, en web el input no se encoge y desborda las filas de dos columnas
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: theme.colors.textPrimary,
    fontSize: 15,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  error: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 6,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 6,
  },
});
