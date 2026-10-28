/**
 * GlassSurface.tsx — Superficie Liquid Glass teñida
 *
 * Cristal con el tono de la marca (opacidad 0.78–0.88 para leer bien), canto
 * blanco tenue, sombra suave con brillo interior y desenfoque del fondo:
 *
 * - Web: backdrop-filter: blur(16px) saturate(160%).
 * - iOS: BlurView nativo.
 * - Android: BlurView sobre el contenido de <GlassBlurTarget> (Android no puede
 *   desenfocar "lo que haya detrás" sin saber qué vista es el fondo).
 *
 * El desenfoque nativo necesita expo-blur dentro del APK. En un APK más viejo
 * (o en Android < 12) la superficie queda como cristal teñido sin desenfoque:
 * la opacidad alta mantiene el mismo contraste.
 */

import React, { createContext, useContext, useRef } from 'react';
import { Platform, StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { theme, themed, getActiveScheme } from '../../constants/theme';

// require condicional: importar expo-blur sin su código nativo rompe la app.
const blurAvailable = Platform.OS !== 'web' && requireOptionalNativeModule('ExpoBlur') != null;
const ExpoBlur: typeof import('expo-blur') | null = blurAvailable ? require('expo-blur') : null;

type TargetRef = React.RefObject<React.ComponentRef<typeof View> | null>;
const BlurTargetContext = createContext<TargetRef | null>(null);

/**
 * Zona donde viven el fondo y los cristales que flotan encima (barra inferior).
 * En Android, BlurView desenfoca el <GlassBlurTarget> de la misma zona, que
 * debe ser hermano (no padre) de esos cristales.
 */
export const GlassBlurScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<React.ComponentRef<typeof View> | null>(null);
  return <BlurTargetContext.Provider value={ref}>{children}</BlurTargetContext.Provider>;
};

/** El contenido que queda DETRÁS de los cristales flotantes. */
export const GlassBlurTarget: React.FC<{ style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({ style, children }) => {
  const ref = useContext(BlurTargetContext);
  if (Platform.OS !== 'android' || !ExpoBlur || !ref) return <View style={style}>{children}</View>;
  const Target = ExpoBlur.BlurTargetView;
  return (
    <Target ref={ref} style={style}>
      {children}
    </Target>
  );
};

const useGlassBlurTarget = () => useContext(BlurTargetContext);

interface Props extends ViewProps {
  /** Desenfoca el fondo. Para cristales que flotan sobre contenido (barras, hojas). */
  blur?: boolean;
  /** Fuerza del desenfoque nativo (0–100). */
  intensity?: number;
  /** Tinte del cristal; por defecto el de las superficies. */
  tint?: string;
  /** Radio de las esquinas (también recorta el desenfoque). */
  radius?: number;
  /** Destino del desenfoque en Android, si el cristal está fuera del proveedor. */
  blurTarget?: TargetRef | null;
}

export const GlassSurface: React.FC<Props> = ({
  blur = false,
  intensity = 40,
  tint,
  radius = theme.radius.lg,
  blurTarget,
  style,
  children,
  ...rest
}) => {
  const contextTarget = useGlassBlurTarget();
  const target = blurTarget ?? contextTarget;
  const nativeBlur = blur && ExpoBlur && (Platform.OS === 'ios' || (Platform.OS === 'android' && target));
  const BlurView = ExpoBlur?.BlurView;

  return (
    <View
      style={[
        styles.surface,
        // Con desenfoque nativo el tinte va en la capa interior, sobre el blur.
        { borderRadius: radius, backgroundColor: nativeBlur ? 'transparent' : tint ?? theme.colors.surface },
        blur && Platform.OS === 'web' ? (styles.webBlur as ViewStyle) : null,
        style,
      ]}
      {...rest}
    >
      {nativeBlur && BlurView ? (
        <View style={[styles.blurClip, { borderRadius: radius }]} pointerEvents="none">
          <BlurView
            intensity={intensity}
            tint={getActiveScheme() === 'dark' ? 'dark' : 'light'}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={Platform.OS === 'android' ? (target ?? undefined) : undefined}
            style={styles.fill}
          />
          {/* El tinte va encima del desenfoque para mantener el contraste. */}
          <View style={[styles.fill, { backgroundColor: tint ?? theme.colors.surface }]} />
        </View>
      ) : null}
      {children}
    </View>
  );
};

const styles = themed(() => ({
  surface: {
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    boxShadow: theme.glass.shadow,
  },
  webBlur: {
    // react-native-web pasa estas propiedades tal cual al CSS.
    backdropFilter: `blur(${theme.glass.blur}px) saturate(160%)`,
    WebkitBackdropFilter: `blur(${theme.glass.blur}px) saturate(160%)`,
  } as ViewStyle,
  blurClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}));
