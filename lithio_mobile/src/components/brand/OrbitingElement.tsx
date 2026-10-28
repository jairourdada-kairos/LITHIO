/**
 * OrbitingElement.tsx — Tu elemento con sus electrones girando en capas
 *
 * Cada capa es un anillo que rota sobre el hilo de UI (Reanimated) a su
 * propia velocidad y en sentido alterno. Con "reducir movimiento" queda quieto.
 */

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { theme, themed } from '../../constants/theme';
import { shells } from '../../utils/elements';
import { ElementTile } from './ElementTile';

interface Props {
  z: number;
  symbol: string;
  name: string;
  size?: number;
  accent: string;
}

export const OrbitingElement: React.FC<Props> = ({ z, symbol, name, size = 220, accent }) => {
  const layers = shells(z);
  const tile = size * 0.3;
  const innerRadius = tile * 0.85;
  const outerRadius = size / 2 - 6;
  const step = layers.length > 1 ? (outerRadius - innerRadius) / (layers.length - 1) : 0;

  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityRole="image" accessibilityLabel={`${name}: ${z} electrones`}>
      {layers.map((count, index) => (
        <Shell
          key={index}
          radius={layers.length === 1 ? (innerRadius + outerRadius) / 2 : innerRadius + step * index}
          electrons={count}
          duration={7000 + index * 3500}
          reverse={index % 2 === 1}
          accent={accent}
        />
      ))}
      <ElementTile z={z} symbol={symbol} name={name} size={tile} accent={accent} />
    </View>
  );
};

interface ShellProps {
  radius: number;
  electrons: number;
  duration: number;
  reverse: boolean;
  accent: string;
}

const Shell: React.FC<ShellProps> = ({ radius, electrons, duration, reverse, accent }) => {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    // Giro continuo: curva lineal, como una órbita.
    turn.set(withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduced, duration, turn]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(reverse ? -1 : 1) * turn.get() * 360}deg` }],
  }));

  const diameter = radius * 2;
  const dot = 8;
  return (
    <Animated.View
      style={[styles.shell, { width: diameter, height: diameter, borderRadius: radius, borderColor: `${accent}40` }, spin]}
    >
      {Array.from({ length: electrons }, (_, i) => {
        const angle = (i / electrons) * Math.PI * 2;
        return (
          <View
            key={i}
            style={[
              styles.electron,
              {
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                backgroundColor: accent,
                left: radius + Math.cos(angle) * radius - dot / 2,
                top: radius + Math.sin(angle) * radius - dot / 2,
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
};

const styles = themed(() => ({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    position: 'absolute',
    borderWidth: 1,
  },
  electron: {
    position: 'absolute',
    boxShadow: `0 0 8px ${theme.colors.primaryLine}`,
  },
}));
