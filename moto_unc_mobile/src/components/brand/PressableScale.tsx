/**
 * PressableScale.tsx — Botón con respuesta física al presionar
 *
 * Se encoge a 0.97 en 120 ms al tocar (no al soltar), con una transición
 * CSS de Reanimated en el hilo de UI. Reemplaza al TouchableOpacity en las
 * pantallas de marca: el usuario siente el toque en el mismo cuadro.
 */

import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Estilo del área táctil exterior, p. ej. flex: 1 dentro de una fila. */
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const PRESS_EASING = cubicBezier(0.23, 1, 0.32, 1);

export const PressableScale: React.FC<Props> = ({ style, containerStyle, children, onPressIn, onPressOut, disabled, ...rest }) => {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={containerStyle}
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      {...rest}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: pressed ? 0.97 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 120,
            transitionTimingFunction: PRESS_EASING,
          },
          disabled ? { opacity: 0.6 } : null,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};
