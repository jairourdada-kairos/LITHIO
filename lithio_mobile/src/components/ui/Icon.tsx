/**
 * Icon.tsx — Íconos de LITHIO (Eva Icons)
 *
 * Eva Icons (https://akveo.github.io/eva-icons) se usa como fuente: no necesita
 * código nativo, así que llega también por EAS Update a los APK instalados.
 * Los nombres son los de Eva: 'home-outline', 'star', 'chevron-right-outline'…
 * Se prefiere la variante "-outline"; la rellena marca un estado activo.
 *
 * Eva no tiene motos, cascos ni átomos: esos pocos íconos del dominio salen de
 * Material Community Icons con el mismo tamaño y color.
 */

import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import createIconSet from '@expo/vector-icons/createIconSet';
import evaGlyphs from './evaGlyphs.json';

export type EvaIconName = keyof typeof evaGlyphs;

const DOMAIN_ICONS = ['motorbike', 'motorbike-off', 'racing-helmet', 'atom'] as const;
type DomainIconName = (typeof DOMAIN_ICONS)[number];

export type IconName = EvaIconName | DomainIconName;

export const EVA_FONT = { 'Eva-Icons': require('../../../assets/fonts/Eva-Icons.ttf') };

const EvaIcons = createIconSet(evaGlyphs as Record<EvaIconName, number>, 'Eva-Icons', EVA_FONT['Eva-Icons']);

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

const isDomainIcon = (name: IconName): name is DomainIconName => (DOMAIN_ICONS as readonly string[]).includes(name);

/** Versión rellena de un ícono outline (pestaña activa); si no existe, el mismo. */
export function filledIcon(name: IconName): IconName {
  const filled = name.replace(/-outline$/, '');
  return filled in evaGlyphs ? (filled as EvaIconName) : name;
}

export const Icon: React.FC<Props> = ({ name, size = 20, color, style, accessibilityLabel }) => {
  const a11y = accessibilityLabel
    ? { accessibilityLabel, accessible: true }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
  if (isDomainIcon(name)) {
    return <MaterialCommunityIcons name={name} size={size} color={color} style={style} {...a11y} />;
  }
  return <EvaIcons name={name} size={size} color={color} style={style} {...a11y} />;
};
