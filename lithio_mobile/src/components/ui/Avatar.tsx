/**
 * Avatar.tsx — Foto de perfil o iniciales, con anillo del color del rol
 */

import React from 'react';
import { View, Text, Image } from 'react-native';
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
      { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, borderColor: ringColor, boxShadow: `0 0 14px ${ringColor}33` },
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
    {size >= 32 ? <ValenceDot ring={size + 6} color={ringColor} /> : null}
  </View>
);

/** Electrón de valencia sobre el anillo, a las 2 en punto: une la foto con el átomo de la marca. */
function ValenceDot({ ring, color }: { ring: number; color: string }) {
  const dot = Math.max(6, Math.round(ring * 0.12));
  const r = ring / 2;
  const at = r + r * Math.SQRT1_2; // 45° sobre el anillo
  const top = r - r * Math.SQRT1_2;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.valence,
        { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color, left: at - dot / 2 - 1.5, top: top - dot / 2 - 1.5 },
      ]}
    />
  );
}

const styles = themed(() => ({
  ring: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    backgroundColor: theme.colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valence: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: theme.colors.bgDark, // separa el punto del anillo
  },
  initials: {
    fontFamily: theme.fonts.bold,
  },
}));
