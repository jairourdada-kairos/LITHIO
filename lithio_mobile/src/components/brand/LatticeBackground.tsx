/**
 * LatticeBackground.tsx — Fondo de las pantallas de bienvenida y acceso
 *
 * Retícula de puntos inspirada en la estructura cristalina del litio
 * (cúbica centrada en el cuerpo: cada fila desplazada media celda) y dos
 * halos de energía turquesa y coral. Es estático: no compite con el contenido.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { theme, themed } from '../../constants/theme';

const CELL = 44;

export const LatticeBackground: React.FC = () => {
  const { width, height } = useWindowDimensions();

  const dots = useMemo(() => {
    const items: { key: string; left: number; top: number }[] = [];
    const rows = Math.ceil(height / CELL) + 1;
    const columns = Math.ceil(width / CELL) + 1;
    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 === 0 ? 0 : CELL / 2;
      for (let column = 0; column < columns; column += 1) {
        items.push({ key: `${row}-${column}`, left: column * CELL + offset, top: row * CELL });
      }
    }
    return items;
  }, [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.halo, styles.haloPrimary, { width: width * 1.1, height: width * 1.1, top: -width * 0.55, left: -width * 0.35 }]} />
      <View style={[styles.halo, styles.haloSecondary, { width: width * 0.9, height: width * 0.9, bottom: -width * 0.45, right: -width * 0.4 }]} />
      {dots.map((dot) => (
        <View key={dot.key} style={[styles.dot, { left: dot.left, top: dot.top }]} />
      ))}
    </View>
  );
};

const styles = themed(() => ({
  halo: {
    position: 'absolute',
    borderRadius: 9999,
  },
  haloPrimary: {
    backgroundColor: 'rgba(69, 214, 197, 0.07)',
    boxShadow: '0 0 120px 40px rgba(69, 214, 197, 0.07)',
  },
  haloSecondary: {
    backgroundColor: 'rgba(255, 118, 94, 0.05)',
    boxShadow: '0 0 120px 40px rgba(255, 118, 94, 0.05)',
  },
  dot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.lattice,
  },
}));
