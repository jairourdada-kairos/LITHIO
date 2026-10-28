/**
 * PressableScale.tsx — Botón con respuesta física al presionar
 *
 * Se encoge a 0.97 en 120 ms al tocar (no al soltar), con una transición
 * CSS de Reanimated en el hilo de UI. Reemplaza al TouchableOpacity en las
 * pantallas de marca: el usuario siente el toque en el mismo cuadro.
 *
 * Estados del cristal (variant="glass"), sin perder la transparencia teñida:
 * - hover (puntero encima): el cristal se aclara, el canto brilla y se levanta.
 * - active (presionado): se hunde, más oscuro y con menos sombra.
 * - focus (teclado): anillo con el color de acento. Un toque no lo muestra,
 *   igual que :focus-visible en la web.
 * variant="solid" (botones de color) reacciona con brillo y el mismo anillo.
 */

import React, { useRef, useState } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { theme } from '../../constants/theme';

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Estilo del área táctil exterior, p. ej. flex: 1 dentro de una fila. */
  containerStyle?: StyleProp<ViewStyle>;
  /** 'glass': superficie de cristal; 'solid': botón de color; 'plain': solo escala. */
  variant?: 'plain' | 'glass' | 'solid';
  /** Color del anillo de foco y del brillo de los botones sólidos. */
  accent?: string;
  children: React.ReactNode;
}

const PRESS_EASING = cubicBezier(0.23, 1, 0.32, 1);

export const PressableScale: React.FC<Props> = ({
  style,
  containerStyle,
  variant = 'plain',
  accent = theme.colors.primary,
  children,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  onFocus,
  onBlur,
  disabled,
  ...rest
}) => {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  // El foco que llega por un toque o clic no dibuja el anillo.
  const pointerDown = useRef(false);

  const stateStyle: ViewStyle | null = (() => {
    if (disabled) return null;
    const ring = focusVisible ? theme.glass.focusRing(accent) : null;
    if (variant === 'glass') {
      const shadow = pressed ? theme.glass.shadowPressed : hovered ? theme.glass.shadowRaised : null;
      return {
        ...(pressed
          ? { backgroundColor: theme.colors.glassPressed }
          : hovered
            ? { backgroundColor: theme.colors.glassHover, borderColor: theme.colors.glassBorderHover }
            : null),
        ...(focusVisible ? { borderColor: accent } : null),
        ...(shadow || ring ? { boxShadow: [ring, shadow ?? theme.glass.shadow].filter(Boolean).join(', ') } : null),
      };
    }
    if (variant === 'solid') {
      const glow = hovered && !pressed ? `0 10px 28px ${accent}66` : `0 6px 20px ${accent}40`;
      return {
        opacity: pressed ? 0.88 : 1,
        boxShadow: [ring, glow].filter(Boolean).join(', '),
      };
    }
    return ring ? { boxShadow: ring } : null;
  })();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={containerStyle}
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      onPressIn={(event) => {
        pointerDown.current = true;
        setFocusVisible(false);
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        pointerDown.current = false;
        onHoverOut?.(event);
      }}
      onFocus={(event) => {
        if (!pointerDown.current) setFocusVisible(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        pointerDown.current = false;
        setFocusVisible(false);
        onBlur?.(event);
      }}
      {...rest}
    >
      <Animated.View
        style={[
          style,
          stateStyle,
          {
            transform: [{ scale: pressed ? 0.97 : hovered && variant !== 'plain' ? 1.01 : 1 }],
            transitionProperty: ['transform', 'backgroundColor', 'borderColor', 'opacity'],
            transitionDuration: 160,
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
