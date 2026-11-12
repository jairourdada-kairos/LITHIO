/**
 * PeriodicTile.tsx — Casilla de tabla periódica del litio (Li, Z = 3)
 *
 * Identificador de marca para encabezados: número atómico, símbolo,
 * nombre y masa atómica.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { theme, themed } from '../../constants/theme';

interface Props {
  size?: number;
  accent?: string;
}

export const PeriodicTile: React.FC<Props> = ({ size = 64, accent = theme.colors.primary }) => {
  const scale = size / 64;
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderColor: accent,
          borderRadius: 10 * scale,
          boxShadow: `0 0 ${18 * scale}px ${accent}55`,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel="Litio, número atómico 3"
    >
      <Text style={[styles.number, { fontSize: 10 * scale, top: 4 * scale, left: 6 * scale, color: accent }]}>3</Text>
      <Text style={[styles.symbol, { fontSize: 26 * scale }]}>Li</Text>
      <Text style={[styles.mass, { fontSize: 7.5 * scale }]}>6.94</Text>
    </View>
  );
};

const styles = themed(() => ({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: theme.colors.glassBgStrong,
  },
  number: {
    position: 'absolute',
    fontFamily: theme.fonts.monoBold,
  },
  symbol: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  mass: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.mono,
    marginTop: -2,
  },
}));
