/**
 * LegalNotice.tsx — Aviso de Términos y Condiciones y Política de privacidad
 *
 * Va junto a cada botón que crea una cuenta o inicia sesión: los dos enlaces
 * abren el texto completo, que sirve el servidor (/terminos y /privacidad).
 */

import React from 'react';
import { Linking, Text } from 'react-native';
import { API_BASE } from '../config/api';
import { theme, themed } from '../constants/theme';

export const openTerms = () => void Linking.openURL(`${API_BASE}/terminos`).catch(() => undefined);
export const openPrivacy = () => void Linking.openURL(`${API_BASE}/privacidad`).catch(() => undefined);

interface Props {
  /** Texto antes de los enlaces, p. ej. "Al crear tu cuenta aceptas". */
  lead?: string;
  accent?: string;
  align?: 'center' | 'left';
}

export const LegalNotice: React.FC<Props> = ({
  lead = 'Al registrarte o continuar, aceptas',
  accent = theme.colors.primary,
  align = 'center',
}) => (
  <Text style={[styles.text, { textAlign: align }]}>
    {lead} los{' '}
    <Text style={[styles.link, { color: accent }]} onPress={openTerms} accessibilityRole="link">
      Términos y Condiciones
    </Text>{' '}
    y la{' '}
    <Text style={[styles.link, { color: accent }]} onPress={openPrivacy} accessibilityRole="link">
      Política de privacidad
    </Text>{' '}
    de LITHIO.
  </Text>
);

const styles = themed(() => ({
  text: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  link: {
    fontFamily: theme.fonts.semibold,
    textDecorationLine: 'underline',
  },
}));
