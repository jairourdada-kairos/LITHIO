/**
 * ScreenHeader.tsx — Encabezado de pantalla secundaria con flecha de volver
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
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
    <View style={styles.titleWrap}>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.energyLine} />
    </View>
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
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  energyLine: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundImage: theme.fx.energy,
  },
  title: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: theme.fonts.bold,
    fontSize: 18,  // AQUÍ poniendo otro número se cambia el tamaño del título arriba de cada pantalla
    color: theme.colors.textPrimary,
  },
  right: {
    width: 44,
    alignItems: 'center',
  },
}));
