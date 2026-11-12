/**
 * TermsCheckbox.tsx — Casilla para aceptar los Términos y la Política de privacidad
 *
 * Va encima del botón que crea la cuenta: sin marcarla no se envía el registro.
 * Los dos enlaces abren el texto completo que sirve el servidor.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { theme, themed } from '../constants/theme';
import { Icon } from './ui/Icon';
import { openPrivacy, openTerms } from './LegalNotice';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  accent?: string;
}

export const TermsCheckbox: React.FC<Props> = ({ checked, onChange, error, accent = theme.colors.primary }) => (
  <View style={styles.wrap}>
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(!checked)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="Declaro ser mayor de 18 años y acepto los Términos y Condiciones y la Política de privacidad"
      >
        <Icon
          name={checked ? 'checkmark-square-2' : 'square-outline'}
          size={26}
          color={checked ? accent : error ? theme.colors.error : theme.colors.textMuted}
        />
      </Pressable>
      <Text style={styles.text} onPress={() => onChange(!checked)}>
        Declaro ser mayor de 18 años y acepto los{' '}
        <Text
          style={[styles.link, { color: accent }]}
          onPress={(event) => {
            event.stopPropagation?.();
            openTerms();
          }}
          accessibilityRole="link"
        >
          Términos y Condiciones
        </Text>{' '}
        y la{' '}
        <Text
          style={[styles.link, { color: accent }]}
          onPress={(event) => {
            event.stopPropagation?.();
            openPrivacy();
          }}
          accessibilityRole="link"
        >
          Política de privacidad
        </Text>{' '}
        de LITHIO.
      </Text>
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>
);

const styles = themed(() => ({
  wrap: {
    marginTop: 4,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  text: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  link: {
    fontFamily: theme.fonts.semibold,
    textDecorationLine: 'underline',
  },
  error: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 2,
    marginLeft: 36,
  },
}));
