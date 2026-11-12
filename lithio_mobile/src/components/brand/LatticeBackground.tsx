/**
 * LatticeBackground.tsx — Fondo de las pantallas de bienvenida y acceso
 *
 * Tres halos de energía (turquesa, coral y un toque de diamante) muy difusos
 * sobre el fondo de la app: da profundidad al cristal sin la retícula de
 * puntos de antes, que hacía la pantalla cuadriculada y dibujaba cientos de
 * vistas. Es estático: no compite con el contenido.
 */

import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { theme, themed } from '../../constants/theme';

export const LatticeBackground: React.FC = () => {
  const { width } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.halo, styles.haloPrimary, { width: width * 1.2, height: width * 1.2, top: -width * 0.6, left: -width * 0.4 }]} />
      <View style={[styles.halo, styles.haloSecondary, { width: width, height: width, bottom: -width * 0.5, right: -width * 0.45 }]} />
      <View style={[styles.halo, styles.haloDiamond, { width: width * 0.6, height: width * 0.6, top: width * 0.55, right: -width * 0.3 }]} />
    </View>
  );
};

const styles = themed(() => ({
  halo: {
    position: 'absolute',
    borderRadius: 9999,
  },
  haloPrimary: {
    backgroundColor: `${theme.colors.primary}14`,
    boxShadow: `0 0 160px 60px ${theme.colors.primary}14`,
  },
  haloSecondary: {
    backgroundColor: `${theme.colors.secondary}0F`,
    boxShadow: `0 0 160px 60px ${theme.colors.secondary}0F`,
  },
  haloDiamond: {
    backgroundColor: `${theme.colors.diamond}0A`,
    boxShadow: `0 0 140px 50px ${theme.colors.diamond}0A`,
  },
}));
