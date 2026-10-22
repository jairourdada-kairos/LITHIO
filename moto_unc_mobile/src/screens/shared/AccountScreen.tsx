/**
 * AccountScreen.tsx — Cuenta: perfil, números y menú
 *
 * El rol se muestra como insignia fija (no se cambia aquí). Para usar el
 * otro rol se cierra sesión y se entra por la otra puerta.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { Avatar } from '../../components/ui/Avatar';
import { RoleBadge, roleColors } from '../../components/ui/RoleBadge';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import type { AuthUser } from '../../services/auth';
import type { AccountSummary } from '../../services/api';
import type { SessionRole } from '../../services/session';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface MenuItem {
  icon: IconName;
  label: string;
  onPress: () => void;
  tint?: string;
}

interface Props {
  user: AuthUser;
  role: SessionRole;
  points: number;
  summary: AccountSummary | null;
  onOpenProfile: () => void;
  onOpenHistory: () => void;
  onOpenScheduled: () => void;
  onOpenRewards?: () => void;
  onOpenAbout: () => void;
  onSignOut: () => void;
}

export const AccountScreen: React.FC<Props> = ({
  user,
  role,
  points,
  summary,
  onOpenProfile,
  onOpenHistory,
  onOpenScheduled,
  onOpenRewards,
  onOpenAbout,
  onSignOut,
}) => {
  const colors = roleColors(role);
  const fullName = [user.name, user.last_name].filter(Boolean).join(' ');

  const confirmSignOut = () =>
    Alert.alert('Cerrar sesión', '¿Quieres cerrar tu sesión en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: onSignOut },
    ]);

  const items: MenuItem[] = [
    { icon: 'account-circle-outline', label: 'Mis datos', onPress: onOpenProfile },
    { icon: 'history', label: 'Historial', onPress: onOpenHistory },
    { icon: 'calendar-month-outline', label: 'Agendados', onPress: onOpenScheduled },
    ...(onOpenRewards ? [{ icon: 'star-four-points-outline' as IconName, label: 'Tienda de Fe', onPress: onOpenRewards }] : []),
    { icon: 'atom', label: '¿Qué es LITHIO?', onPress: onOpenAbout },
    { icon: 'logout', label: 'Cerrar sesión', onPress: confirmSignOut, tint: theme.colors.error },
  ];

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 64 }]} showsVerticalScrollIndicator={false}>
      <RoleBadge role={role} size="md" style={styles.roleBadge} />

      <View style={styles.profile}>
        <Avatar name={fullName} uri={user.avatar_url} size={72} ringColor={colors.accent} />
        <View style={styles.profileText}>
          <Text style={styles.name} numberOfLines={2}>{fullName}</Text>
          <Text style={[styles.rank, { color: colors.accent }]} numberOfLines={1}>{user.xp_level}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat icon="star-outline" value={summary?.rating_avg ? summary.rating_avg.toFixed(2) : '—'} label="Calificación" />
        <Stat icon="motorbike" value={String(summary?.trips_completed ?? '—')} label="Viajes" />
        <Stat icon="star-four-points-outline" value={String(points)} label="Fe" gold />
      </View>

      <View style={styles.menu}>
        {items.map((item, index) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [styles.item, index > 0 && styles.itemDivider, pressed && styles.itemPressed]}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name={item.icon} size={24} color={item.tint || theme.colors.textSecondary} />
            <Text style={[styles.itemLabel, item.tint ? { color: item.tint } : null]}>{item.label}</Text>
            {!item.tint ? <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.textMuted} /> : null}
          </Pressable>
        ))}
      </View>

      <Text style={styles.footnote}>
        {role === 'pasajero'
          ? '¿Quieres conducir? Cierra sesión y entra por "Soy Conductor".'
          : '¿Quieres viajar como pasajero? Cierra sesión y entra por "Soy Pasajero".'}
      </Text>
    </ScrollView>
  );
};

const Stat: React.FC<{ icon: IconName; value: string; label: string; gold?: boolean }> = ({ icon, value, label, gold }) => (
  <View style={styles.stat}>
    <View style={[styles.statIcon, gold && { backgroundColor: theme.colors.goldSoft }]}>
      <MaterialCommunityIcons name={icon} size={20} color={gold ? theme.colors.gold : theme.colors.textSecondary} />
    </View>
    <View>
      <Text style={[styles.statValue, gold && { color: theme.colors.gold }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 20,
  },
  roleBadge: {
    alignSelf: 'center',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileText: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
  rank: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardElevated,
  },
  statValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  menu: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 58,
    paddingHorizontal: 16,
  },
  itemDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
  },
  itemPressed: {
    backgroundColor: theme.colors.glassHighlight,
  },
  itemLabel: {
    flex: 1,
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  footnote: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
