/**
 * AccountScreen.tsx — Perfil (boceto v3)
 *
 * Tu nivel como elemento químico, el progreso hacia el siguiente, la
 * apariencia de la app (claro, oscuro o automático) y el menú de cuenta.
 * El rol se muestra pero no se cambia aquí: para eso se cierra sesión.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { Icon, IconName } from '../../components/ui/Icon';
import { VersionTag } from '../../components/ui/VersionTag';
import { theme, themed } from '../../constants/theme';
import { getPushStatus, openNotificationSettings, pushSupported, registerForPush } from '../../services/notifications';
import { Avatar } from '../../components/ui/Avatar';
import { RoleBadge, roleColors } from '../../components/ui/RoleBadge';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import { ThemeMode, useThemeMode } from '../../theme/ThemeMode';
import { electronConfiguration, FALLBACK_LEVEL, levelProgress } from '../../utils/elements';
import type { AuthUser } from '../../services/auth';
import type { AccountSummary } from '../../services/api';
import type { SessionRole } from '../../services/session';

interface MenuItem {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

interface Props {
  user: AuthUser;
  role: SessionRole;
  summary: AccountSummary | null;
  onOpenProfile: () => void;
  onEditPhoto: () => void;
  onOpenLevel: () => void;
  /** Solo para administradores. */
  onOpenAdmin?: () => void;
  onOpenLinks: () => void;
  onOpenRewards?: () => void;
  /** Solo conductores: las reseñas que les dejaron los pasajeros. */
  onOpenReviews?: () => void;
  onOpenTutorial: () => void;
  onOpenAbout: () => void;
  onSignOut: () => void;
}

const APPEARANCE: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'light', label: 'Claro', icon: 'sun-outline' },
  { mode: 'dark', label: 'Oscuro', icon: 'moon-outline' },
  { mode: 'system', label: 'Auto', icon: 'smartphone-outline' },
];

export const AccountScreen: React.FC<Props> = ({
  user,
  role,
  summary,
  onOpenProfile,
  onEditPhoto,
  onOpenLevel,
  onOpenAdmin,
  onOpenLinks,
  onOpenRewards,
  onOpenReviews,
  onOpenTutorial,
  onOpenAbout,
  onSignOut,
}) => {
  const { mode, setMode } = useThemeMode();
  const accent = roleColors(role).accent;
  const level = summary?.level ?? FALLBACK_LEVEL;
  const progress = levelProgress(level);
  const fullName = [user.name, user.last_name].filter(Boolean).join(' ');
  const missing = level.next_threshold ? level.next_threshold - level.fe_lifetime : 0;

  const confirmSignOut = () =>
    Alert.alert('Cerrar sesión', '¿Quieres cerrar tu sesión en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: onSignOut },
    ]);

  const manageNotifications = async () => {
    const status = await getPushStatus();
    if (status === 'granted') {
      await registerForPush();
      Alert.alert('Notificaciones activadas', 'Te avisaremos de tus viajes y de tu billetera aunque tengas la app cerrada.');
    } else if (status === 'denied') {
      Alert.alert('Notificaciones desactivadas', 'Las desactivaste antes. Actívalas en los ajustes del teléfono: Notificaciones → LITHIO.', [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Abrir ajustes', onPress: openNotificationSettings },
      ]);
    } else if (await registerForPush()) {
      Alert.alert('Notificaciones activadas', 'Listo: te avisaremos de lo importante.');
    }
  };

  const items: MenuItem[] = [
    ...(onOpenAdmin ? [{ icon: 'shield-outline' as IconName, label: 'Administración', onPress: onOpenAdmin }] : []),
    { icon: 'credit-card-outline', label: 'Mis datos', onPress: onOpenProfile },
    ...(onOpenReviews ? [{ icon: 'star-outline' as IconName, label: 'Mis reseñas', onPress: onOpenReviews }] : []),
    { icon: 'people-outline', label: 'Enlaces', onPress: onOpenLinks },
    ...(onOpenRewards ? [{ icon: 'storefront-outline' as IconName, label: 'Tienda de Fe', onPress: onOpenRewards }] : []),
    ...(pushSupported ? [{ icon: 'bell-outline' as IconName, label: 'Notificaciones', onPress: () => void manageNotifications() }] : []),
    { icon: 'book-open-outline', label: 'Cómo funciona LITHIO', onPress: onOpenTutorial },
    { icon: 'atom', label: '¿Qué es LITHIO?', onPress: onOpenAbout },
    { icon: 'log-out-outline', label: 'Cerrar sesión', onPress: confirmSignOut, danger: true },
  ];

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 56 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Perfil</Text>

      <View style={styles.identity}>
        <Pressable onPress={onEditPhoto} accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" hitSlop={6}>
          <Avatar name={fullName} uri={user.avatar_url} size={72} ringColor={accent} />
          <View style={[styles.camera, { backgroundColor: accent }]}>
            <Icon name="camera-outline" size={14} color={theme.colors.bgDark} />
          </View>
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={2}>{fullName}</Text>
          <View style={styles.badgeRow}>
            <RoleBadge role={role} />
            {levelBadge(level.z) ? (
              <View style={[styles.levelBadge, level.z >= 36 && { borderColor: theme.colors.gold }]}>
                <Text style={[styles.levelBadgeText, level.z >= 36 && { color: theme.colors.gold }]}>{levelBadge(level.z)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <Pressable
        onPress={onOpenLevel}
        style={({ pressed }) => [styles.card, pressed && styles.itemPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Nivel ${level.name}. Ver qué significan los niveles`}
      >
        <View style={styles.levelRow}>
          <Text style={styles.levelTitle}>Nivel {level.name}</Text>
          <Text style={[styles.config, { color: accent }]}>{electronConfiguration(level.z)}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: accent }]} />
        </View>
        <View style={styles.levelHintRow}>
          <Text style={styles.levelHint}>
            {level.next_name ? `${missing} Fe para ${level.next_name} (${level.next_symbol})` : 'Nivel máximo de la tabla'}
          </Text>
          <Text style={[styles.levelLink, { color: accent }]}>Ver niveles ›</Text>
        </View>
        <View style={styles.stats}>
          <Stat value={String(summary?.trips_completed ?? '—')} label="Viajes" />
          <Stat value={`◆ ${(summary?.diamonds ?? 0).toFixed(2)}`} label="Diamantes" color={theme.colors.diamond} />
          <Stat value={`Fe ${summary?.points ?? user.points}`} label="Hierro" color={theme.colors.gold} />
        </View>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Apariencia</Text>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {APPEARANCE.map((option) => {
            const selected = option.mode === mode;
            return (
              <Pressable
                key={option.mode}
                onPress={() => setMode(option.mode)}
                style={[styles.segmentItem, selected && styles.segmentItemActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Apariencia ${option.label}`}
              >
                <Icon name={option.icon} size={16} color={selected ? theme.colors.textPrimary : theme.colors.textMuted} />
                <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.menu}>
        {items.map((item, index) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [styles.item, index > 0 && styles.itemDivider, pressed && styles.itemPressed]}
            accessibilityRole="button"
          >
            <Icon name={item.icon} size={22} color={item.danger ? theme.colors.error : theme.colors.textSecondary} />
            <Text style={[styles.itemLabel, item.danger && { color: theme.colors.error }]}>{item.label}</Text>
            {!item.danger ? <Icon name="chevron-right-outline" size={22} color={theme.colors.textMuted} /> : null}
          </Pressable>
        ))}
      </View>

      <Text style={styles.footnote}>
        {role === 'pasajero'
          ? '¿Quieres conducir? Cierra sesión y entra por "Soy Conductor".'
          : '¿Quieres viajar como pasajero? Cierra sesión y entra por "Soy Pasajero".'}
      </Text>
      <VersionTag />
    </ScrollView>
  );
};

const Stat: React.FC<{ value: string; label: string; color?: string }> = ({ value, label, color }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/** Insignias de nivel: Litio (Z=3), gas noble (Z=10, Neón) y Leyenda (Z=36, Kriptón). */
function levelBadge(z: number): string | null {
  if (z >= 36) return '★ Leyenda LITHIO';
  if (z >= 10) return 'Gas noble';
  if (z >= 3) return 'Insignia Li';
  return null;
}

const styles = themed(() => ({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 18,
  },
  flex: {
    flex: 1,
  },
  screenTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 26,
    color: theme.colors.textPrimary,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  name: {
    fontFamily: theme.fonts.bold,
    fontSize: 21,
    color: theme.colors.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  levelBadgeText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  camera: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.bgDark,
  },
  levelHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  levelLink: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
  },
  card: {
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  levelTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  config: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: 12,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  levelHint: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  cardTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: 10,
  },
  segmentItemActive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  segmentText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13.5,
    color: theme.colors.textMuted,
  },
  segmentTextActive: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  menu: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingHorizontal: 18,
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
    fontSize: 15.5,
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
}));
