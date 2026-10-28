/**
 * NoticeBanner.tsx — Aviso en la app (estado del viaje, solicitudes nuevas)
 *
 * Entra desde arriba con un fundido corto y se cierra solo a los 5 s.
 * Reemplaza a los Alert del sistema, que interrumpen y no tienen la marca.
 */

import React, { useEffect } from 'react';
import { Text, Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { Icon } from './Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import type { RideNotice } from '../../hooks/useRideCenter';

// Función (no constante) para leer la paleta activa en cada aviso.
const tones = () => ({
  info: { color: theme.colors.primary, icon: 'bell' as const },
  success: { color: theme.colors.success, icon: 'checkmark-circle-2' as const },
  warning: { color: theme.colors.warning, icon: 'alert-circle' as const },
});

interface Props {
  notice: RideNotice | null;
  onClose: () => void;
  onPress?: () => void;
}

export const NoticeBanner: React.FC<Props> = ({ notice, onClose, onPress }) => {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [notice, onClose]);

  if (!notice) return null;
  const tone = tones()[notice.tone];

  return (
    <Animated.View
      entering={FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutUp.duration(160).reduceMotion(ReduceMotion.System)}
      style={[styles.wrapper, { top: insets.top + 8 }]}
      accessibilityLiveRegion="polite"
    >
      <Pressable
        onPress={() => {
          onPress?.();
          onClose();
        }}
        style={[styles.banner, { borderColor: tone.color }]}
        accessibilityRole="alert"
      >
        <Icon name={tone.icon} size={22} color={tone.color} />
        <View style={styles.text}>
          <Text style={styles.title}>{notice.title}</Text>
          <Text style={styles.message} numberOfLines={2}>{notice.message}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = themed(() => ({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(27, 41, 43, 0.98)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
  },
  text: {
    flex: 1,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  message: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
}));
