/**
 * ElementTile.tsx — Casilla de la tabla periódica del nivel del usuario
 */

import React from 'react';
import { View, Text } from 'react-native';
import { theme, themed } from '../../constants/theme';

interface Props {
  z: number;
  symbol: string;
  name?: string;
  size?: number;
  accent: string;
}

export const ElementTile: React.FC<Props> = ({ z, symbol, name, size = 64, accent }) => {
  const scale = size / 64;
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: 14 * scale, borderColor: accent }]}
      accessibilityRole="image"
      accessibilityLabel={`Nivel ${name || symbol}, número atómico ${z}`}
    >
      <Text style={[styles.z, { fontSize: 11 * scale, top: 5 * scale, left: 7 * scale, color: accent }]}>{z}</Text>
      <Text style={[styles.symbol, { fontSize: 26 * scale }]}>{symbol}</Text>
      {name ? <Text style={[styles.name, { fontSize: 8 * scale }]} numberOfLines={1}>{name}</Text> : null}
    </View>
  );
};

const styles = themed(() => ({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
  },
  z: {
    position: 'absolute',
    fontFamily: theme.fonts.monoBold,
  },
  symbol: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  name: {
    fontFamily: theme.fonts.mono,
    color: theme.colors.textSecondary,
    marginTop: -2,
  },
}));
