/**
 * ScreenHeader.tsx — Encabezado de pantalla secundaria con flecha de volver
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Icon } from './Icon';
import { theme, themed } from '../../constants/theme';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export const ScreenHeader: React.FC<Props> = ({ title, onBack, right }) => (
  <View style={styles.header}>
    {onBack ? (
      <Pressable
        onPress={onBack}
        style={styles.back}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Icon name="arrow-back-outline" size={24} color={theme.colors.textPrimary} />
      </Pressable>
    ) : (
      <View style={styles.back} />
    )}
    <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
      {title}
    </Text>
    <View style={styles.right}>{right}</View>
  </View>
);

const styles = themed(() => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 56,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  right: {
    width: 44,
    alignItems: 'center',
  },
}));
