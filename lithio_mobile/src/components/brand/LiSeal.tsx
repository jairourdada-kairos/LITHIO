/**
 * LiSeal.tsx — Sello de LITHIO: monograma "Li" cuyo punto de la i es el
 * electrón de valencia (coral) con su órbita (turquesa).
 *
 * Es la marca secundaria: encabezados de acceso, recibos y piezas pequeñas.
 * El logo principal es el átomo 2+1 (LithiumAtom). Todo está dibujado con
 * vistas sobre una cuadrícula de 64 unidades, sin imágenes ni animación.
 */

import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { theme, themed } from '../../constants/theme';

interface Props {
  size?: number;
  /** Color del canto y de la órbita. */
  accent?: string;
  /** false = solo el monograma, sin el cuadro de cristal (para sellos de agua). */
  framed?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const LiSeal: React.FC<Props> = ({ size = 64, accent = theme.colors.primary, framed = true, style }) => {
  const u = size / 64;
  const box = (x: number, y: number, w: number, h: number) => ({
    left: x * u,
    top: y * u,
    width: w * u,
    height: h * u,
    borderRadius: 1.2 * u,
  });
  const dot = { cx: 39.5, cy: 21, r: 3.4 };
  const orbit = 21;
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: 14 * u },
        framed && [styles.framed, { borderColor: accent, boxShadow: `0 0 ${16 * u}px ${accent}40` }],
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="Sello de LITHIO"
    >
      <View style={[styles.stroke, box(15, 17, 5.5, 32)]} />
      <View style={[styles.stroke, box(15, 43.5, 17, 5.5)]} />
      <View style={[styles.stroke, box(36.75, 29, 5.5, 20)]} />
      <View
        style={[
          styles.orbit,
          {
            borderColor: accent,
            borderWidth: Math.max(1, 1.2 * u),
            left: (dot.cx - orbit / 2) * u,
            top: (dot.cy - orbit / 2) * u,
            width: orbit * u,
            height: orbit * u,
            borderRadius: (orbit / 2) * u,
          },
        ]}
      />
      <View
        style={[
          styles.electron,
          {
            left: (dot.cx - dot.r) * u,
            top: (dot.cy - dot.r) * u,
            width: dot.r * 2 * u,
            height: dot.r * 2 * u,
            borderRadius: dot.r * u,
          },
        ]}
      />
    </View>
  );
};

const styles = themed(() => ({
  tile: {
    position: 'relative',
  },
  framed: {
    borderWidth: 1.5,
    backgroundColor: theme.colors.glassBgStrong,
  },
  stroke: {
    position: 'absolute',
    backgroundColor: theme.colors.textPrimary, // CAMBIA AQUÍ el color de las letras "Li" del sello
  },
  orbit: {
    position: 'absolute',
    transform: [{ rotate: '-25deg' }, { scaleY: 0.36 }],
  },
  electron: {
    position: 'absolute',
    backgroundColor: theme.colors.secondary, // CAMBIA AQUÍ el color del electrón del sello
  },
}));
