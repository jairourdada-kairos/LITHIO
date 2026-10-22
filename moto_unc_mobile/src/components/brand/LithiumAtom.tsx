/**
 * LithiumAtom.tsx — Emblema animado de LITHIO
 *
 * Átomo de litio (Z = 3): núcleo con 3 protones (coral) y 4 neutrones, y
 * 3 electrones (turquesa) en órbitas elípticas inclinadas.
 *
 * La posición de cada electrón se calcula en un worklet sobre el hilo de UI
 * (Reanimated), así que la órbita no se traba aunque JS esté ocupado.
 * Con "reducir movimiento" activo el átomo queda quieto.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { theme } from '../../constants/theme';

interface Props {
  size?: number;
  /** false = átomo estático (encabezados pequeños). */
  animated?: boolean;
}

// Tres órbitas a 60° entre sí, como el símbolo clásico del átomo.
const ORBITS = [
  { tilt: 0, phase: 0 },
  { tilt: Math.PI / 3, phase: 1 / 3 },
  { tilt: -Math.PI / 3, phase: 2 / 3 },
];
const ORBIT_MINOR_RATIO = 0.36;
const ORBIT_PERIOD_MS = 4200;

// Disposición fija de los 7 nucleones (3 protones, 4 neutrones), en unidades del radio del núcleo.
// Se dibujan en orden: los protones van al final para quedar encima.
const NUCLEONS: { x: number; y: number; proton: boolean }[] = [
  { x: -0.4, y: -0.22, proton: false },
  { x: 0.4, y: -0.22, proton: false },
  { x: 0, y: 0.46, proton: false },
  { x: 0, y: 0, proton: false },
  { x: 0, y: -0.44, proton: true },
  { x: -0.4, y: 0.24, proton: true },
  { x: 0.4, y: 0.24, proton: true },
];

export const LithiumAtom: React.FC<Props> = ({ size = 200, animated = true }) => {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0.08);
  const shouldAnimate = animated && !reducedMotion;

  useEffect(() => {
    if (!shouldAnimate) return;
    // Movimiento constante: lineal, como pide una órbita.
    progress.set(withRepeat(withTiming(1.08, { duration: ORBIT_PERIOD_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, [shouldAnimate, progress]);

  const radius = size / 2;
  const majorAxis = radius * 0.92;
  const minorAxis = majorAxis * ORBIT_MINOR_RATIO;
  const nucleusRadius = size * 0.11;
  const nucleonSize = nucleusRadius * 0.78;
  const electronSize = Math.max(6, size * 0.055);

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Átomo de litio, emblema de LITHIO"
    >
      {ORBITS.map((orbit, index) => (
        <View
          key={`orbit-${index}`}
          style={[
            styles.orbit,
            {
              width: majorAxis * 2,
              height: majorAxis * 2,
              borderRadius: majorAxis,
              transform: [{ rotate: `${orbit.tilt}rad` }, { scaleY: ORBIT_MINOR_RATIO }],
            },
          ]}
        />
      ))}

      <View style={[styles.nucleus, { width: nucleusRadius * 2.4, height: nucleusRadius * 2.4, borderRadius: nucleusRadius * 1.2 }]}>
        {NUCLEONS.map((nucleon, index) => (
          <View
            key={`nucleon-${index}`}
            style={[
              styles.nucleon,
              nucleon.proton ? styles.proton : styles.neutron,
              {
                width: nucleonSize,
                height: nucleonSize,
                borderRadius: nucleonSize / 2,
                transform: [
                  { translateX: nucleon.x * nucleusRadius },
                  { translateY: nucleon.y * nucleusRadius },
                ],
              },
            ]}
          />
        ))}
      </View>

      {ORBITS.map((orbit, index) => (
        <Electron
          key={`electron-${index}`}
          progress={progress}
          tilt={orbit.tilt}
          phase={orbit.phase}
          majorAxis={majorAxis}
          minorAxis={minorAxis}
          size={electronSize}
        />
      ))}
    </View>
  );
};

interface ElectronProps {
  progress: SharedValue<number>;
  tilt: number;
  phase: number;
  majorAxis: number;
  minorAxis: number;
  size: number;
}

const Electron: React.FC<ElectronProps> = ({ progress, tilt, phase, majorAxis, minorAxis, size }) => {
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);

  const style = useAnimatedStyle(() => {
    const angle = (progress.get() + phase) * Math.PI * 2;
    const x = majorAxis * Math.cos(angle);
    const y = minorAxis * Math.sin(angle);
    // Profundidad simulada: delante del núcleo el electrón es más grande y brillante.
    const depth = (Math.sin(angle) + 1) / 2;
    return {
      opacity: 0.55 + depth * 0.45,
      transform: [
        { translateX: x * cosTilt - y * sinTilt },
        { translateY: x * sinTilt + y * cosTilt },
        { scale: 0.75 + depth * 0.35 },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.electron, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLine,
  },
  nucleus: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 118, 94, 0.10)',
    boxShadow: '0 0 28px rgba(255, 118, 94, 0.45)',
  },
  nucleon: {
    position: 'absolute',
  },
  proton: {
    backgroundColor: theme.colors.secondary,
  },
  neutron: {
    backgroundColor: '#5E7178',
  },
  electron: {
    position: 'absolute',
    backgroundColor: theme.colors.primary,
    boxShadow: '0 0 12px rgba(69, 214, 197, 0.9)',
  },
});
