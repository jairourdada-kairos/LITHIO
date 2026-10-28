/**
 * FormField.tsx — Campo de texto con etiqueta, ayuda y mensaje de error
 *
 * Vive fuera de las pantallas a propósito: un componente definido dentro de
 * otro se vuelve a crear en cada render y el teclado se cierra al escribir.
 *
 * Campo de cristal teñido: al pasar el puntero el canto se ilumina; con el
 * foco se marca con el color de acento y un halo suave.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { theme, themed } from '../constants/theme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Elemento a la izquierda del campo, p. ej. el selector V / E de la cédula. */
  prefix?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /** Color del foco: turquesa (pasajero) o coral (conductor). */
  accent?: string;
}

export const FormField: React.FC<Props> = ({
  label,
  error,
  hint,
  required,
  prefix,
  containerStyle,
  accent = theme.colors.primary,
  onFocus,
  onBlur,
  editable,
  ...inputProps
}) => {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const locked = editable === false;
  return (
  <View style={[styles.group, containerStyle]}>
    <Text style={styles.label}>
      {label}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
    <View style={styles.inputRow}>
      {prefix}
      <Pressable
        style={styles.inputCell}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        focusable={false}
        accessible={false}
      >
        <TextInput
          style={[
            styles.input,
            hovered && !focused && !locked ? styles.inputHover : null,
            focused ? { borderColor: accent, boxShadow: `${theme.glass.focusRing(accent)}, ${theme.glass.shadow}` } : null,
            error ? styles.inputError : null,
            locked ? styles.inputLocked : null,
          ]}
          placeholderTextColor={theme.colors.textMuted}
          autoCorrect={false}
          accessibilityLabel={label}
          editable={editable}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
      </Pressable>
    </View>
    {error ? (
      <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
    ) : hint ? (
      <Text style={styles.hint}>{hint}</Text>
    ) : null}
  </View>
  );
};

export const fieldStyles = themed(() => ({
  label: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
}));

const styles = themed(() => ({
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
  inputCell: {
    flex: 1,
    minWidth: 0, // Sin esto, en web el input no se encoge y desborda las filas de dos columnas
  },
  input: {
    fontFamily: theme.fonts.regular,
    minWidth: 0,
    backgroundColor: theme.colors.glassBgStrong,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    boxShadow: theme.glass.shadow,
    // Web: sin el contorno del navegador, el foco lo dibuja el propio cristal.
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', transition: 'border-color 160ms, box-shadow 160ms, background-color 160ms' } as object)
      : null),
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: theme.colors.textPrimary,
    fontSize: 15,
  },
  inputHover: {
    borderColor: theme.colors.glassBorderHover,
    backgroundColor: theme.colors.glassHover,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  inputLocked: {
    opacity: 0.7,
  },
  error: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 6,
  },
  hint: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 6,
  },
}));
