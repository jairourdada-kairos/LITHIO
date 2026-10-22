/**
 * HomeHeader.tsx — Saludo, rol de la sesión y saldo de Fe
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { theme } from '../../constants/theme';
import { Avatar } from '../ui/Avatar';
import { RoleBadge, roleColors } from '../ui/RoleBadge';
import type { SessionRole } from '../../services/session';

interface Props {
  name: string;
  avatarUrl?: string;
  role: SessionRole;
  rank: string;
  points: number;
  onPressAvatar: () => void;
  onPressPoints: () => void;
}

export const HomeHeader: React.FC<Props> = ({ name, avatarUrl, role, rank, points, onPressAvatar, onPressPoints }) => (
  <View style={styles.row}>
    <Pressable onPress={onPressAvatar} accessibilityRole="button" accessibilityLabel="Abrir mi cuenta" hitSlop={6}>
      <Avatar name={name} uri={avatarUrl} size={46} ringColor={roleColors(role).accent} />
    </Pressable>
    <View style={styles.greeting}>
      <Text style={styles.hello} numberOfLines={1}>
        Hola, {name.split(' ')[0]}
      </Text>
      <View style={styles.meta}>
        <RoleBadge role={role} />
        <Text style={styles.rank} numberOfLines={1}>{rank}</Text>
      </View>
    </View>
    <Pressable
      onPress={onPressPoints}
      style={styles.points}
      accessibilityRole="button"
      accessibilityLabel={`${points} Fe. Abrir recompensas`}
    >
      <Text style={styles.feSymbol}>Fe</Text>
      <Text style={styles.feValue}>{points}</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greeting: {
    flex: 1,
    gap: 4,
  },
  hello: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rank: {
    flexShrink: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  points: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.goldSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.4)',
  },
  feSymbol: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 12,
    color: theme.colors.gold,
  },
  feValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.gold,
  },
});
