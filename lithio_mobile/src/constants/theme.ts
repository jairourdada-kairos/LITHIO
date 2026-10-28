import { ImageStyle, TextStyle, ViewStyle } from 'react-native';

// React Native 0.88 ya no exporta StyleSheet.NamedStyles; es la misma forma.
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * theme.ts — Paletas de LITHIO (oscura y clara) y estilos que siguen el tema
 *
 * `theme.colors` siempre devuelve la paleta activa. Los estilos se declaran con
 * `themed(() => ({ ... }))` en lugar de StyleSheet.create: se calculan con la
 * paleta del momento y se guardan en caché por modo. Al cambiar de tema, App
 * vuelve a montar la interfaz y todo se pinta con la paleta nueva.
 *
 * Estilo Liquid Glass teñido: las superficies son cristal con el tono de la
 * marca y opacidad de 0.78 a 0.88 (más que el glassmorphism clásico) para que
 * el texto siempre se lea bien; borde blanco muy tenue que simula el canto del
 * cristal y una sombra suave con un brillo interior arriba (theme.glass).
 */

const dark = {
  bgDark: '#10191C',          // Fondo de la app
  cardBg: 'rgba(27, 41, 43, 0.82)',
  cardBorder: 'rgba(255, 255, 255, 0.12)', // Canto del cristal
  cardElevated: 'rgba(36, 54, 56, 0.85)',
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
  glassBg: 'rgba(27, 41, 43, 0.78)',
  glassBgStrong: 'rgba(36, 54, 56, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassHighlight: 'rgba(255, 255, 255, 0.08)',
  glassHover: 'rgba(46, 68, 71, 0.86)',     // Cristal bajo el puntero
  glassPressed: 'rgba(16, 28, 31, 0.88)',   // Cristal presionado (más hundido)
  glassBorderHover: 'rgba(255, 255, 255, 0.24)',
  surface: 'rgba(22, 38, 41, 0.80)', // Tarjetas: cristal teñido
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
  cardBg: 'rgba(255, 255, 255, 0.85)',
  cardBorder: 'rgba(22, 37, 42, 0.10)',
  cardElevated: 'rgba(233, 239, 237, 0.85)',
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
  glassBg: 'rgba(255, 255, 255, 0.78)',
  glassBgStrong: 'rgba(255, 255, 255, 0.88)',
  glassBorder: 'rgba(22, 37, 42, 0.10)',
  glassHighlight: 'rgba(255, 255, 255, 0.9)',
  glassHover: 'rgba(255, 255, 255, 0.95)',
  glassPressed: 'rgba(228, 236, 234, 0.9)',
  glassBorderHover: 'rgba(22, 37, 42, 0.20)',
  surface: 'rgba(255, 255, 255, 0.80)',
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
export function themed<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: () => T & NamedStyles<any>
): T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  return new Proxy({} as T, {
    get: (_target, key: string) => {
      const sheet = cache[activeScheme] ?? (cache[activeScheme] = factory());
      return sheet[key as keyof T];
    },
  });
}

export const theme: {
  colors: Palette;
  glow: { primary: string; secondary: string; readonly soft: string };
  glass: {
    blur: number;
    readonly shadow: string;
    readonly shadowRaised: string;
    readonly shadowPressed: string;
    focusRing: (accent: string) => string;
  };
  fonts: Record<'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'mono' | 'monoBold', string>;
  radius: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', number>;
} = {
  colors,
  glow: {
    primary: '0 0 24px rgba(69, 214, 197, 0.35)',
    secondary: '0 0 24px rgba(255, 118, 94, 0.35)',
    get soft() {
      return theme.glass.shadow;
    },
  },
  glass: {
    /** Desenfoque del fondo detrás del cristal (px). */
    blur: 16,
    /** Profundidad: sombra suave + brillo interior en el canto superior. */
    get shadow() {
      return activeScheme === 'dark'
        ? '0 10px 30px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
        : '0 10px 28px rgba(16, 25, 28, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
    },
    /** Cristal levantado (hover): la sombra crece un poco. */
    get shadowRaised() {
      return activeScheme === 'dark'
        ? '0 14px 38px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
        : '0 14px 34px rgba(16, 25, 28, 0.14), inset 0 1px 0 rgba(255, 255, 255, 1)';
    },
    /** Cristal presionado: casi pegado al fondo. */
    get shadowPressed() {
      return activeScheme === 'dark'
        ? '0 4px 12px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.04)'
        : '0 4px 12px rgba(16, 25, 28, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.7)';
    },
    /** Anillo de foco de teclado, con el color de acento. */
    focusRing: (accent: string) => `0 0 0 3px ${accent}59`,
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
