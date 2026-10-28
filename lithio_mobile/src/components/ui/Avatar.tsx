/**
 * Avatar.tsx — Foto de perfil o iniciales, con anillo del color del rol
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { theme, themed } from '../../constants/theme';
import { resolveMediaUrl } from '../../services/avatar';

interface Props {
  name: string;
  uri?: string | null;
  size?: number;
  ringColor?: string;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'L';
}

export const Avatar: React.FC<Props> = ({ name, uri, size = 48, ringColor = theme.colors.primary }) => (
  <View
    style={[
      styles.ring,
      { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, borderColor: ringColor },
    ]}
    accessibilityRole="image"
    accessibilityLabel={`Foto de ${name}`}
  >
    {uri ? (
      <Image source={{ uri: resolveMediaUrl(uri) }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    ) : (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.initials, { fontSize: size * 0.38, color: ringColor }]}>{initials(name)}</Text>
      </View>
    )}
  </View>
);

const styles = themed(() => ({
  ring: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    backgroundColor: theme.colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: theme.fonts.bold,
  },
}));
