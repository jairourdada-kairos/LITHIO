export const theme = {
  colors: {
    bgDark: '#10191C',
    cardBg: '#1B292B',
    cardBorder: '#344548',
    cardElevated: '#243638',
    primary: '#45D6C5',       // Turquesa eléctrico: energía, acción principal
    secondary: '#FF765E',     // Coral: conductor, protones
    gold: '#FFC857',          // Saldo de Fe
    success: '#10B981',       // Verde disponible
    error: '#EF4444',         // Cancelaciones y rechazos
    warning: '#F97316',       // En camino / alerta
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accentGrad1: '#45D6C5',
    accentGrad2: '#FF765E',
    // Vidrio: superficies translúcidas sobre el fondo con retícula
    glassBg: 'rgba(27, 41, 43, 0.62)',
    glassBgStrong: 'rgba(36, 54, 56, 0.78)',
    glassBorder: 'rgba(148, 163, 184, 0.16)',
    glassHighlight: 'rgba(255, 255, 255, 0.06)',
    primarySoft: 'rgba(69, 214, 197, 0.12)',
    primaryLine: 'rgba(69, 214, 197, 0.45)',
    secondarySoft: 'rgba(255, 118, 94, 0.12)',
    secondaryLine: 'rgba(255, 118, 94, 0.45)',
    goldSoft: 'rgba(255, 200, 87, 0.12)',
  },
  glow: {
    primary: '0 0 24px rgba(69, 214, 197, 0.35)',
    secondary: '0 0 24px rgba(255, 118, 94, 0.35)',
    soft: '0 12px 32px rgba(0, 0, 0, 0.35)',
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
    full: 9999,
  }
};
