/**
 * Decor.tsx — Adornos reutilizables para dar riqueza a las pantallas sin cambiar su distribución.
 *
 *  - ScreenTitle: título grande con línea de energía (turquesa → coral) debajo.
 *  - SectionLabel: rombo de acento + texto en negrita para encabezar secciones.
 *  - OrbitDecor: tres órbitas tenues en la esquina de una tarjeta (el átomo de la marca).
 *  - IconChip: ícono dentro de un cuadro redondeado teñido.
 */

import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';
import { theme, themed } from '../../constants/theme';
import { LithiumAtom } from '../brand/LithiumAtom';

/** Título de pantalla (26) con línea de 44×4 en degradado turquesa → coral. */
export function ScreenTitle({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.titleWrap, style]}>
      <Text style={styles.title} accessibilityRole="header">{children}</Text>
      <View style={styles.titleLine} />
    </View>
  );
}

/** Encabezado de sección: rombo de 8 px del color de acento + texto de 17 en negrita. */
export function SectionLabel({ children, color = theme.colors.primary, style }: { children: string; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <View style={[styles.diamond, { backgroundColor: color }]} />
      <Text style={styles.sectionText} accessibilityRole="header">{children}</Text>
    </View>
  );
}

/** Órbitas tenues en la esquina superior derecha de una tarjeta (poner `overflow: 'hidden'` en la tarjeta). */
export function OrbitDecor({ color = theme.colors.primary }: { color?: string }) {
  return (
    <View style={styles.watermark} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[0, 60, -60].map((tilt) => (
        <View key={tilt} style={[styles.watermarkOrbit, { borderColor: `${color}38`, transform: [{ rotate: `${tilt}deg` }, { scaleY: 0.36 }] }]} />
      ))}
    </View>
  );
}

/** Ícono en un cuadro redondeado teñido con el color dado. */
export function IconChip({ name, color = theme.colors.primary, size = 40 }: { name: IconName; color?: string; size?: number }) {
  return (
    <View style={[styles.chip, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: `${color}1C`, borderColor: `${color}38` }]}>
      <Icon name={name} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

/** Pantalla vacía: el átomo de la marca tenue y quieto, una frase y, si hace falta, una acción. */
export function EmptyState({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyAtom} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <LithiumAtom size={84} animated={false} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
      {children}
    </View>
  );
}

const styles = themed(() => ({
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 14,
  },
  emptyAtom: {
    opacity: 0.35, // CAMBIA AQUÍ qué tan visible es el átomo en pantallas vacías
  },
  emptyText: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  titleWrap: {
    gap: 8,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 26,
    color: theme.colors.textPrimary,
  },
  titleLine: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundImage: `linear-gradient(90deg, ${theme.colors.accentGrad1} 0%, ${theme.colors.accentGrad2} 100%)`,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  diamond: {
    width: 8,
    height: 8,
    borderRadius: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  sectionText: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  watermark: {
    position: 'absolute',
    right: -70,
    top: -96,
    width: 250,
    height: 250,
    opacity: 0.55,
  },
  watermarkOrbit: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
}));
