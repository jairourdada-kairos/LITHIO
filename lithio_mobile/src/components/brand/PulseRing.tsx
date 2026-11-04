/**
 * PulseRing.tsx — Aro que se expande y se apaga: "esto está en vivo"
 *
 * Se usa con la disponibilidad de conductores y con el botón de conectado.
 * Corre en el hilo de UI. Con "reducir movimiento" activo no se dibuja.
 */

import React, { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

const PERIOD_MS = 2200;

interface Props {
  size: number;
  color: string;
  /** Cuánto crece el aro respecto a su tamaño inicial. */
  scale?: number;
  style?: StyleProp<ViewStyle>;
}

export const PulseRing: React.FC<Props> = ({ size, color, scale = 2.4, style }) => {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.set(withRepeat(withTiming(1, { duration: PERIOD_MS, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(progress);
  }, [reducedMotion, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - progress.get()),
    transform: [{ scale: 1 + (scale - 1) * progress.get() }],
  }));

  if (reducedMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style, animated]}
    />
  );
};
