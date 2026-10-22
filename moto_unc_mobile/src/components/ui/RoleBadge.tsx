/**
 * RoleBadge.tsx — Insignia fija del rol de la sesión
 *
 * No es un botón: el rol se elige al entrar y no se cambia dentro de la app.
 * Pasajero = electrón (e⁻, turquesa). Conductor = protón (p⁺, coral).
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme, themed } from '../../constants/theme';
import type { SessionRole } from '../../services/session';

export const roleColors = (role: SessionRole) =>
  role === 'conductor'
    ? { accent: theme.colors.secondary, soft: theme.colors.secondarySoft, line: theme.colors.secondaryLine }
    : { accent: theme.colors.primary, soft: theme.colors.primarySoft, line: theme.colors.primaryLine };

export const RoleBadge: React.FC<{ role: SessionRole; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }> = ({
  role,
  size = 'sm',
  style,
}) => {
  const colors = roleColors(role);
  const big = size === 'md';
  return (
    <View
      style={[styles.badge, { backgroundColor: colors.soft, borderColor: colors.line }, big && styles.badgeMd, style]}
      accessibilityLabel={role === 'conductor' ? 'Sesión de conductor' : 'Sesión de pasajero'}
    >
      <Text style={[styles.particle, { color: colors.accent }, big && styles.particleMd]}>
        {role === 'conductor' ? 'p⁺' : 'e⁻'}
      </Text>
      <Text style={[styles.label, { color: colors.accent }, big && styles.labelMd]}>
        {role === 'conductor' ? 'Conductor' : 'Pasajero'}
      </Text>
    </View>
  );
};

const styles = themed(() => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  badgeMd: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  particle: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 11,
  },
  particleMd: {
    fontSize: 14,
  },
  label: {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
  },
  labelMd: {
    fontSize: 15,
  },
}));
