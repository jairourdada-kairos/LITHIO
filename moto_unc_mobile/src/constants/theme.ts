import { StyleSheet } from 'react-native';

/**
 * theme.ts — Paletas de LITHIO (oscura y clara) y estilos que siguen el tema
 *
 * `theme.colors` siempre devuelve la paleta activa. Los estilos se declaran con
 * `themed(() => ({ ... }))` en lugar de StyleSheet.create: se calculan con la
 * paleta del momento y se guardan en caché por modo. Al cambiar de tema, App
 * vuelve a montar la interfaz y todo se pinta con la paleta nueva.
 */

const dark = {
  bgDark: '#10191C',          // Fondo de la app
  cardBg: '#1B292B',
  cardBorder: '#344548',
  cardElevated: '#243638',
  primary: '#45D6C5',         // Turquesa eléctrico: pasajero, acción principal
  onPrimary: '#0E2A27',       // Texto sobre turquesa
  secondary: '#FF765E',       // Coral: conductor, protones
  onSecondary: '#3A140B',
  gold: '#FFC857',            // Fe (hierro de recompensa)
  diamond: '#7FD4FF',         // ◆ Diamantes (saldo)
  success: '#10B981',
  error: '#EF4444',
  warning: '#F97316',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  accentGrad1: '#45D6C5',
  accentGrad2: '#FF765E',
  glassBg: 'rgba(27, 41, 43, 0.62)',
  glassBgStrong: 'rgba(36, 54, 56, 0.78)',
  glassBorder: 'rgba(148, 163, 184, 0.16)',
  glassHighlight: 'rgba(255, 255, 255, 0.06)',
  surface: '#18262A',         // Tarjetas sólidas del boceto v3
  surfaceAlt: '#10191C',
  primarySoft: 'rgba(69, 214, 197, 0.12)',
  primaryLine: 'rgba(69, 214, 197, 0.45)',
  secondarySoft: 'rgba(255, 118, 94, 0.12)',
  secondaryLine: 'rgba(255, 118, 94, 0.45)',
  goldSoft: 'rgba(255, 200, 87, 0.12)',
  diamondSoft: 'rgba(127, 212, 255, 0.12)',
  lattice: 'rgba(148, 163, 184, 0.16)',
  scrim: 'rgba(5, 10, 12, 0.6)',
};

export type Palette = typeof dark;

const light: Palette = {
  bgDark: '#F3F6F5',
  cardBg: '#FFFFFF',
  cardBorder: '#D7E0DE',
  cardElevated: '#E9EFED',
  primary: '#0F8F82',
  onPrimary: '#FFFFFF',
  secondary: '#E0533A',
  onSecondary: '#FFFFFF',
  gold: '#A87A0C',
  diamond: '#2477B3',
  success: '#0E9F6E',
  error: '#DC2626',
  warning: '#EA580C',
  textPrimary: '#16252A',
  textSecondary: '#4E6168',
  textMuted: '#7A8B90',
  accentGrad1: '#0F8F82',
  accentGrad2: '#E0533A',
  glassBg: 'rgba(255, 255, 255, 0.9)',
  glassBgStrong: '#FFFFFF',
  glassBorder: 'rgba(22, 37, 42, 0.10)',
  glassHighlight: 'rgba(22, 37, 42, 0.04)',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF3F2',
  primarySoft: 'rgba(15, 143, 130, 0.10)',
  primaryLine: 'rgba(15, 143, 130, 0.35)',
  secondarySoft: 'rgba(224, 83, 58, 0.10)',
  secondaryLine: 'rgba(224, 83, 58, 0.35)',
  goldSoft: 'rgba(168, 122, 12, 0.12)',
  diamondSoft: 'rgba(36, 119, 179, 0.10)',
  lattice: 'rgba(22, 37, 42, 0.08)',
  scrim: 'rgba(16, 25, 28, 0.4)',
};

export type ColorScheme = 'dark' | 'light';

const palettes: Record<ColorScheme, Palette> = { dark, light };
let activeScheme: ColorScheme = 'dark';

export function setActiveScheme(scheme: ColorScheme) {
  activeScheme = scheme;
}

export function getActiveScheme(): ColorScheme {
  return activeScheme;
}

/** Siempre lee la paleta activa: theme.colors.primary cambia con el tema. */
const colors = new Proxy({} as Palette, {
  get: (_target, key: string) => palettes[activeScheme][key as keyof Palette],
}) as Palette;

/**
 * Hoja de estilos que depende del tema. Úsala como un StyleSheet normal:
 * `const styles = themed(() => ({ box: { backgroundColor: theme.colors.cardBg } }))`.
 */
export function themed<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: () => T & StyleSheet.NamedStyles<any>
): T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  return new Proxy({} as T, {
    get: (_target, key: string) => {
      const sheet = cache[activeScheme] ?? (cache[activeScheme] = factory());
      return sheet[key as keyof T];
    },
  });
}

export const theme = {
  colors,
  glow: {
    primary: '0 0 24px rgba(69, 214, 197, 0.35)',
    secondary: '0 0 24px rgba(255, 118, 94, 0.35)',
    get soft() {
      return activeScheme === 'dark' ? '0 12px 32px rgba(0, 0, 0, 0.35)' : '0 8px 24px rgba(16, 25, 28, 0.08)';
    },
  },
  // Fuentes de marca, cargadas en App.tsx. En Android cada grosor es una
  // familia distinta, así que se usa fontFamily en lugar de fontWeight.
  fonts: {
    light: 'SpaceGrotesk_300Light',
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
    // Monoespaciada para datos "de laboratorio": número atómico, acrónimo, etiquetas
    mono: 'SpaceMono_400Regular',
    monoBold: 'SpaceMono_700Bold',
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 20,
    xl: 26,
    full: 9999,
  },
};
