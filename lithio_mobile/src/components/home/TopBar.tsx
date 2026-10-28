/**
 * TopBar.tsx — Marca LITHIO y acceso al perfil
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Icon } from '../ui/Icon';
import { theme, themed } from '../../constants/theme';
import { Avatar } from '../ui/Avatar';

interface Props {
  name: string;
  avatarUrl?: string;
  accent: string;
  onPressAvatar: () => void;
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días,';
  if (hour < 19) return 'Buenas tardes,';
  return 'Buenas noches,';
}

export const TopBar: React.FC<Props> = ({ name, avatarUrl, accent, onPressAvatar }) => (
  <View style={styles.row}>
    <Icon name="atom" size={22} color={accent} />
    <Text style={styles.brand}>LITHIO</Text>
    <View style={styles.spacer} />
    <Pressable onPress={onPressAvatar} hitSlop={8} accessibilityRole="button" accessibilityLabel="Abrir mi perfil">
      <Avatar name={name} uri={avatarUrl} size={36} ringColor={accent} />
    </Pressable>
  </View>
);

const styles = themed(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
  },
  brand: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    letterSpacing: 3,
    color: theme.colors.textPrimary,
  },
  spacer: {
    flex: 1,
  },
}));
