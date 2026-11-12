/**
 * Motion.tsx — Animaciones pequeñas y reutilizables de LITHIO.
 *
 *  - MotoTrack: pista con una moto que va y viene (o se queda en `progress`).
 *  - CountUp: número que sube contando hasta su valor.
 *  - GrowBar: barra que crece de 0 a su porcentaje.
 *  - Float: sube y baja suavemente (iones, íconos).
 *  - Orbiter: puntito que gira en círculo (electrón).
 *
 * Todas respetan "reducir movimiento" del teléfono: sin animar, muestran el valor final.
 */

import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleProp, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from './Icon';
import { theme, themed } from '../../constants/theme';
import { hapticSuccess } from '../../services/haptics';

/** Línea fina con un punto de luz: va y viene, o se queda fija en `progress` (0 a 1). */
export function MotoTrack({ color = theme.colors.primary, progress, style }: { color?: string; progress?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(progress ?? 0);

  useEffect(() => {
    if (progress !== undefined) {
      x.set(reduced ? progress : withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) }));
      return;
    }
    if (reduced) return;
    x.set(withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(x);
  }, [progress, reduced, x]);

  const moto = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * Math.max(width - 12, 0) }] }));
  const done = useAnimatedStyle(() => ({ width: x.get() * Math.max(width - 12, 0) + 6 }));

  return (
    <View style={[styles.track, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.rail} />
      <Animated.View style={[styles.done, { backgroundColor: color }, done]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, boxShadow: `0 0 10px ${color}` }, moto]} />
    </View>
  );
}

/** Píldora que se desliza detrás de la opción elegida en un selector de `count` opciones (primer hijo del selector). */
export function SlidingPill({ index, count, color = theme.colors.primary, inset = 4 }: { index: number; count: number; color?: string; inset?: number }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(index);

  useEffect(() => {
    x.set(reduced ? index : withTiming(index, { duration: 260, easing: Easing.out(Easing.cubic) }));
  }, [index, reduced, x]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * (width / count) }] }));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: inset, bottom: inset, left: inset, right: inset }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[{ width: width / count, height: '100%', borderRadius: 999, backgroundColor: color, backgroundImage: theme.fx.gloss }, slide]} />
    </View>
  );
}

/** Número que sube contando hasta `value`. */
export function CountUp({ value, decimals = 0, style, duration = 900 }: { value: number; decimals?: number; style?: StyleProp<TextStyle>; duration?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const start = Date.now();
    const from = 0;
    const id = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [value, duration, reduced]);

  return <Text style={style}>{shown.toFixed(decimals)}</Text>;
}

/** Barra que crece de 0 a `pct` (0 a 100). */
export function GrowBar({ pct, color = theme.colors.primary, height = 6, style }: { pct: number; color?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const w = useSharedValue(0);
  const target = (Math.max(0, Math.min(pct, 100)) / 100) * width;

  useEffect(() => {
    w.set(reduced ? target : withDelay(150, withTiming(target, { duration: 1100, easing: Easing.out(Easing.cubic) })));
  }, [target, reduced, w]);

  const fill = useAnimatedStyle(() => ({ width: w.get() }));
  return (
    <View
      style={[styles.bar, { height, borderRadius: height / 2 }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color, backgroundImage: theme.fx.gloss }, fill]} />
    </View>
  );
}

/** Aparece subiendo un poco y con fundido; `index` escalona las tarjetas de una pantalla (50 ms cada una). */
export function Reveal({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(320).delay(index * 50).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Logro: un check que aparece con rebote suave y un aro que se expande una sola vez. Vibra al aparecer. */
export function Celebrate({ color = theme.colors.success, ring = theme.colors.gold, size = 56 }: { color?: string; ring?: string; size?: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    hapticSuccess();
    if (reduced) return;
    p.set(withDelay(120, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) })));
  }, [reduced, p]);

  const halo = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - p.get()), transform: [{ scale: 1 + 1.2 * p.get() }] }));
  return (
    <View style={{ width: size, height: size, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
      {reduced ? null : (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: ring }, halo]} />
      )}
      <Animated.View
        entering={ZoomIn.springify().damping(14).reduceMotion(ReduceMotion.System)}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 20px ${color}55` }}
      >
        <Icon name="checkmark-outline" size={size * 0.55} color={theme.colors.onAccent} />
      </Animated.View>
    </View>
  );
}

/** Un borde de luz que cruza la tarjeta una sola vez al aparecer (la tarjeta necesita `overflow: 'hidden'`). */
export function Sheen({ delay = 350 }: { delay?: number }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduced || width === 0) return;
    p.set(withDelay(delay, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) })));
  }, [delay, reduced, width, p]);

  const band = useAnimatedStyle(() => ({ transform: [{ translateX: -width * 0.7 + p.get() * width * 1.9 }] }));
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={styles.sheenWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.sheenBand, { width: width * 0.6 }, band]} />
    </View>
  );
}

/** Cambio de pestaña o pantalla: fundido corto con un leve ascenso (dale un `key` distinto por pantalla). */
export function ScreenFade({ children }: { children: React.ReactNode }) {
  // En la web, Reanimated deja la pantalla con ancho y alto fijos al terminar la entrada
  // (no se reacomoda al cambiar el tamaño de la ventana). Ahí se muestra sin animación.
  if (Platform.OS === 'web') return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <Animated.View
      style={{ flex: 1 }}
      entering={FadeInDown.duration(220).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] }).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}

/** Esqueleto de carga: bloque gris que respira mientras llegan los datos. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Breathe style={[{ width, height, borderRadius: radius, backgroundColor: theme.colors.glassBorder }, style]}>
      <View />
    </Breathe>
  );
}

/** Tarjeta esqueleto: título, dos líneas y un bloque, para listas que cargan. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <View style={styles.skeletonCard}>
      <Skeleton width="45%" height={14} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={12} />
      ))}
    </View>
  );
}

/** Respira: la opacidad sube y baja despacio (marca el paso actual). */
export function Breathe({ active = true, children, style }: { active?: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);

  useEffect(() => {
    if (reduced || !active) {
      o.set(1);
      return;
    }
    o.set(withRepeat(withSequence(withTiming(0.45, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })), -1, false));
    return () => cancelAnimation(o);
  }, [active, reduced, o]);

  const a = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Sube y baja suavemente (para iones e íconos). */
export function Float({ children, distance = 4, style }: { children: React.ReactNode; distance?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    y.set(withRepeat(withSequence(withTiming(-distance, { duration: 1200, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.quad) })), -1, false));
    return () => cancelAnimation(y);
  }, [distance, reduced, y]);

  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Puntito (electrón) que gira alrededor del centro de un cuadro de `size`. */
export function Orbiter({ size, color = theme.colors.gold, period = 6000 }: { size: number; color?: string; period?: number }) {
  const reduced = useReducedMotion();
  const r = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    r.set(withRepeat(withTiming(360, { duration: period, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(r);
  }, [period, reduced, r]);

  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.get()}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, a]}>
      <View style={{ position: 'absolute', top: -3, left: size / 2 - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </Animated.View>
  );
}

const styles = themed(() => ({
  track: {
    height: 14,
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.glassBorder,
  },
  done: {
    position: 'absolute',
    left: 0,
    top: 6,
    height: 2,
    borderRadius: 1,
    opacity: 0.7,
  },
  dot: {
    position: 'absolute',
    left: 0,
    top: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  bar: {
    overflow: 'hidden',
    backgroundColor: theme.colors.glassBorder,
  },
  sheenWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheenBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundImage: 'linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0) 100%)',
  },
  skeletonCard: {
    gap: 10,
    padding: 16,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
}));
