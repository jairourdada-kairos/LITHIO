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
 * marca y opacidad de 0.86 a 0.94 (más que el glassmorphism clásico) para que
 * el texto siempre se lea bien; canto casi invisible y profundidad con sombras
 * suaves y amplias (theme.glass), no con líneas: así las pantallas no se ven
 * cuadriculadas. Lo que flota sobre otras pantallas (solicitudes de viaje,
 * avisos, hojas) usa `surfaceSolid`, 100 % opaco, y `glass.floating`.
 */

// ===== COLORES DEL MODO OSCURO: cada línea de abajo es un color. Cambia el código #RRGGBB y publica la actualización. =====
const dark = {
  bgDark: '#0B1416',          // Fondo de la app — CAMBIA AQUÍ el color de fondo de las pantallas
  cardBg: 'rgba(24, 38, 41, 0.92)',  // CAMBIA AQUÍ el color de fondo de las tarjetas
  cardBorder: 'rgba(190, 240, 232, 0.07)', // Canto del cristal
  cardElevated: 'rgba(33, 50, 53, 0.94)',
  primary: '#45D6C5',         // Turquesa eléctrico: pasajero, acción principal — CAMBIA AQUÍ el color principal (turquesa): botones, íconos y textos resaltados del pasajero
  onPrimary: '#0E2A27',       // Texto sobre turquesa
  secondary: '#FF765E',       // Coral: conductor, protones — CAMBIA AQUÍ el color secundario (coral): lo del conductor
  onSecondary: '#3A140B',
  onAccent: '#0B1416', // Texto sobre cualquier color de relleno (éxito, error, oro, acentos)
  gold: '#FFC857',            // Fe (hierro de recompensa) — CAMBIA AQUÍ el dorado de la Fe
  diamond: '#7FD4FF',         // ◆ Diamantes (saldo) — CAMBIA AQUÍ el azul de los diamantes
  success: '#34D399',  // CAMBIA AQUÍ el verde de éxito
  error: '#FF6B6B',  // CAMBIA AQUÍ el rojo de errores
  warning: '#FF9F4A',  // CAMBIA AQUÍ el naranja de avisos
  textPrimary: '#F2F8F7',  // CAMBIA AQUÍ el color del texto principal
  textSecondary: '#A6BABB',  // CAMBIA AQUÍ el color del texto secundario
  textMuted: '#8AA0A2', // ≥ 4.5:1 sobre las tarjetas: se lee aunque sea texto secundario — CAMBIA AQUÍ el color del texto atenuado
  accentGrad1: '#45D6C5',  // CAMBIA AQUÍ el primer color del degradado de acento
  accentGrad2: '#FF765E',  // CAMBIA AQUÍ el segundo color del degradado de acento
  glassBg: 'rgba(24, 38, 41, 0.88)',
  glassBgStrong: 'rgba(33, 50, 53, 0.95)',
  glassBorder: 'rgba(190, 240, 232, 0.08)',
  glassHighlight: 'rgba(255, 255, 255, 0.08)',
  glassHover: 'rgba(43, 64, 67, 0.88)',     // Cristal bajo el puntero
  glassPressed: 'rgba(14, 25, 28, 0.90)',   // Cristal presionado (más hundido)
  glassBorderHover: 'rgba(190, 240, 232, 0.26)',
  surface: 'rgba(22, 36, 39, 0.94)', // Tarjetas: cristal teñido
  surfaceSolid: '#162528', // Lo que flota encima (solicitudes, avisos): 100 % opaco
  surfaceAlt: '#0B1416',
  primarySoft: 'rgba(69, 214, 197, 0.14)',
  primaryLine: 'rgba(69, 214, 197, 0.50)',
  secondarySoft: 'rgba(255, 118, 94, 0.14)',
  secondaryLine: 'rgba(255, 118, 94, 0.50)',
  goldSoft: 'rgba(255, 200, 87, 0.14)',
  diamondSoft: 'rgba(127, 212, 255, 0.14)',
  lattice: 'rgba(166, 186, 187, 0.16)',
  scrim: 'rgba(5, 10, 12, 0.68)',
};

export type Palette = typeof dark;

// ===== COLORES DEL MODO CLARO: cada línea de abajo es un color. Cambia el código #RRGGBB y publica la actualización. =====
const light: Palette = {
  bgDark: '#F0F5F3',  // CAMBIA AQUÍ el color de fondo de las pantallas
  cardBg: 'rgba(255, 255, 255, 0.92)',  // CAMBIA AQUÍ el color de fondo de las tarjetas
  cardBorder: 'rgba(22, 37, 42, 0.07)',
  cardElevated: 'rgba(231, 239, 236, 0.92)',
  primary: '#0B7E72',  // CAMBIA AQUÍ el color principal (turquesa): botones, íconos y textos resaltados del pasajero
  onPrimary: '#FFFFFF',
  secondary: '#C8432B',  // CAMBIA AQUÍ el color secundario (coral): lo del conductor
  onSecondary: '#FFFFFF',
  onAccent: '#FFFFFF',
  gold: '#8A6308',  // CAMBIA AQUÍ el dorado de la Fe
  diamond: '#1F6CA3',  // CAMBIA AQUÍ el azul de los diamantes
  success: '#0A7F58',  // CAMBIA AQUÍ el verde de éxito
  error: '#C9302C',  // CAMBIA AQUÍ el rojo de errores
  warning: '#C2470A',  // CAMBIA AQUÍ el naranja de avisos
  textPrimary: '#0F2024',  // CAMBIA AQUÍ el color del texto principal
  textSecondary: '#445960',  // CAMBIA AQUÍ el color del texto secundario
  textMuted: '#566A70',  // CAMBIA AQUÍ el color del texto atenuado
  accentGrad1: '#0B7E72',  // CAMBIA AQUÍ el primer color del degradado de acento
  accentGrad2: '#C8432B',  // CAMBIA AQUÍ el segundo color del degradado de acento
  glassBg: 'rgba(255, 255, 255, 0.86)',
  glassBgStrong: 'rgba(255, 255, 255, 0.95)',
  glassBorder: 'rgba(22, 37, 42, 0.07)',
  glassHighlight: 'rgba(255, 255, 255, 0.9)',
  glassHover: 'rgba(255, 255, 255, 0.95)',
  glassPressed: 'rgba(228, 236, 234, 0.9)',
  glassBorderHover: 'rgba(22, 37, 42, 0.20)',
  surface: 'rgba(255, 255, 255, 0.92)',
  surfaceSolid: '#FFFFFF',
  surfaceAlt: '#E9F0EE',
  primarySoft: 'rgba(11, 126, 114, 0.10)',
  primaryLine: 'rgba(11, 126, 114, 0.35)',
  secondarySoft: 'rgba(200, 67, 43, 0.10)',
  secondaryLine: 'rgba(200, 67, 43, 0.35)',
  goldSoft: 'rgba(138, 99, 8, 0.12)',
  diamondSoft: 'rgba(31, 108, 163, 0.10)',
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
  fx: {
    readonly sheen: string;
    readonly aurora: string;
    readonly auroraDriver: string;
    gloss: string;
    readonly energy: string;
    glowOf: (accent: string) => string;
    cardGlow: (accent: string) => string;
    tint: (accent: string) => string;
  };
  glass: {
    blur: number;
    readonly shadow: string;
    readonly shadowRaised: string;
    readonly shadowPressed: string;
    readonly floating: string;
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
  // Efectos de marca. Los degradados son estilos de React Native: no necesitan un APK nuevo.
  // glowOf, cardGlow y tint reciben colores en hexadecimal (#RRGGBB).
  fx: {
    /** Reflejo diagonal sobre las tarjetas de cristal. */
    get sheen() {
      return activeScheme === 'dark'
        ? 'linear-gradient(155deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 48%)'
        : 'linear-gradient(155deg, rgba(255, 255, 255, 1) 0%, rgba(226, 240, 236, 0.6) 100%)';
    },
    /** Fondo de las pantallas del pasajero: luz turquesa arriba y un toque coral al otro lado. */
    get aurora() {
      return activeScheme === 'dark'
        ? 'radial-gradient(circle at 8% 0%, rgba(69, 214, 197, 0.20) 0%, rgba(69, 214, 197, 0) 50%), radial-gradient(circle at 100% 24%, rgba(255, 118, 94, 0.13) 0%, rgba(255, 118, 94, 0) 42%)'
        : 'radial-gradient(circle at 8% 0%, rgba(11, 126, 114, 0.16) 0%, rgba(11, 126, 114, 0) 50%), radial-gradient(circle at 100% 24%, rgba(200, 67, 43, 0.08) 0%, rgba(200, 67, 43, 0) 42%)';
    },
    /** Lo mismo para el conductor, con el coral como luz principal. */
    get auroraDriver() {
      return activeScheme === 'dark'
        ? 'radial-gradient(circle at 8% 0%, rgba(255, 118, 94, 0.18) 0%, rgba(255, 118, 94, 0) 50%), radial-gradient(circle at 100% 24%, rgba(69, 214, 197, 0.12) 0%, rgba(69, 214, 197, 0) 42%)'
        : 'radial-gradient(circle at 8% 0%, rgba(200, 67, 43, 0.13) 0%, rgba(200, 67, 43, 0) 50%), radial-gradient(circle at 100% 24%, rgba(11, 126, 114, 0.08) 0%, rgba(11, 126, 114, 0) 42%)';
    },
    /** Brillo superior de los botones de color. */
    gloss: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 58%)',
    /** Línea de energía: electrones (turquesa) y protones (coral) en el canto de la tarjeta principal. */
    get energy() {
      return `linear-gradient(90deg, ${colors.primary}00 0%, ${colors.primary} 30%, ${colors.secondary} 72%, ${colors.secondary}00 100%)`;
    },
    glowOf: (accent: string) => `0 8px 22px ${accent}40, 0 1px 3px ${accent}33, inset 0 1px 0 rgba(255, 255, 255, 0.28)`,
    cardGlow: (accent: string) => `0 18px 44px ${accent}1A, 0 2px 6px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.07)`,
    tint: (accent: string) => `linear-gradient(155deg, ${accent}24 0%, ${accent}05 70%)`,
  },
  glass: {
    /** Desenfoque del fondo detrás del cristal (px). */
    blur: 16,
    /** Profundidad: sombra suave + brillo interior en el canto superior. */
    get shadow() {
      return activeScheme === 'dark'
        ? '0 12px 32px rgba(0, 0, 0, 0.34), 0 1px 3px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
        : '0 12px 30px rgba(16, 25, 28, 0.08), 0 1px 3px rgba(16, 25, 28, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
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
    /** Lo que flota sobre la pantalla (solicitud de viaje, avisos): se separa de cualquier fondo. */
    get floating() {
      return activeScheme === 'dark'
        ? '0 -8px 40px rgba(0, 0, 0, 0.55), 0 18px 48px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.10)'
        : '0 -8px 32px rgba(16, 25, 28, 0.12), 0 18px 44px rgba(16, 25, 28, 0.18), inset 0 1px 0 rgba(255, 255, 255, 1)';
    },
    /** Anillo de foco de teclado, con el color de acento. */
    focusRing: (accent: string) => `0 0 0 3px ${accent}59`,
  },
  // Fuentes de marca, cargadas en App.tsx. En Android cada grosor es una
  // familia distinta, así que se usa fontFamily en lugar de fontWeight.
  // AQUÍ se cambia el TIPO de letra de la app: texto normal (regular/medium/semibold) y títulos y botones (bold).
  // El TAMAÑO de letra no está aquí: cada texto tiene su "fontSize" en el archivo de su pantalla (busca "fontSize" con Ctrl+Shift+F).
  fonts: {
    // Manrope para leer (se mantiene clara en tamaños pequeños); Space Grotesk para títulos y botones.
    light: 'Manrope_300Light',
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
    // Monoespaciada para datos "de laboratorio": número atómico, acrónimo, etiquetas
    mono: 'SpaceMono_400Regular',
    monoBold: 'SpaceMono_700Bold',
  },
  // Esquinas generosas: tarjetas y botones se ven suaves, no como celdas.
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 26,
    full: 9999,
  },
};
