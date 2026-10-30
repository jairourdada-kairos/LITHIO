/**
 * DriverHome.tsx — Inicio del conductor (boceto v3)
 *
 * Estado de conexión con un botón grande, el viaje en curso, una bandeja
 * compacta de solicitudes (cada una se abre en la hoja inferior) y las
 * ganancias en diamantes con acceso al taller aliado.
 */

import React from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { Icon } from '../../components/ui/Icon';
import { theme, themed } from '../../constants/theme';
import { TopBar, greeting } from '../../components/home/TopBar';
import { PressableScale } from '../../components/brand/PressableScale';
import { ActiveRideCard } from '../../components/ActiveRideCard';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import type { AuthUser } from '../../services/auth';
import type { AccountSummary } from '../../services/api';
import type { Ride, RideStatus } from '../../types';

interface Props {
  user: AuthUser;
  summary: AccountSummary | null;
  isAvailable: boolean;
  togglingAvailability: boolean;
  connected: boolean;
  activeRide: Ride | null;
  requests: Ride[];
  refreshing: boolean;
  onRefresh: () => void;
  onToggleAvailability: () => void;
  onOpenRequest: (ride: Ride) => void;
  onUpdateActiveRide: (status: RideStatus) => void;
  onDismissCompleted: () => void;
  onOpenWallet: () => void;
  onOpenProfile: () => void;
}

export const DriverHome: React.FC<Props> = ({
  user,
  summary,
  isAvailable,
  togglingAvailability,
  connected,
  activeRide,
  requests,
  refreshing,
  onRefresh,
  onToggleAvailability,
  onOpenRequest,
  onUpdateActiveRide,
  onDismissCompleted,
  onOpenWallet,
  onOpenProfile,
}) => {
  const online = isAvailable && !activeRide;
  const statusColor = activeRide ? theme.colors.warning : online ? theme.colors.success : theme.colors.textMuted;

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 56 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.secondary} />}
    >
      <TopBar name={user.name} avatarUrl={user.avatar_url} accent={theme.colors.secondary} onPressAvatar={onOpenProfile} />

      <View>
        <Text style={styles.hello}>{greeting()}</Text>
        <Text style={styles.name}>{user.name.split(' ')[0]}</Text>
      </View>

      {activeRide ? (
        <View>
          <Text style={styles.sectionTitle}>Viaje en curso</Text>
          <ActiveRideCard
            ride={activeRide}
            role="conductor"
            onUpdateStatus={onUpdateActiveRide}
            onOpenReview={() => {}}
            onCancel={() => onUpdateActiveRide('cancelado')}
          />
          {activeRide.status === 'completado' ? (
            <PressableScale variant="solid" accent={theme.colors.secondary} style={styles.doneButton} onPress={onDismissCompleted}>
              <Text style={styles.doneText}>Listo, volver a recibir solicitudes</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : (
        <View style={styles.statusCard}>
          <PressableScale variant="glass" accent={theme.colors.secondary}
            onPress={onToggleAvailability}
            disabled={togglingAvailability}
            accessibilityLabel={online ? 'Desconectarme' : 'Conectarme'}
            style={[
              styles.power,
              online
                ? { backgroundColor: theme.colors.success }
                : { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.cardBorder },
            ]}
          >
            {togglingAvailability ? (
              <ActivityIndicator color={online ? '#FFFFFF' : theme.colors.textSecondary} />
            ) : (
              <Icon name="power-outline" size={36} color={online ? '#FFFFFF' : theme.colors.textSecondary} />
            )}
          </PressableScale>
          <Text style={[styles.statusTitle, { color: statusColor }]}>{online ? 'Conectado' : 'Desconectado'}</Text>
          <Text style={styles.statusBody}>
            {online
              ? 'Los pasajeros pueden elegirte. Las solicitudes aparecerán aquí.'
              : 'Toca el botón para aparecer en el directorio y recibir solicitudes.'}
          </Text>
          {!connected ? <Text style={styles.offline}>Reconectando con el servidor…</Text> : null}
        </View>
      )}

      {requests.length > 0 ? (
        <View>
          <Text style={styles.sectionTitle}>Solicitudes pendientes</Text>
          <View style={styles.list}>
            {requests.map((ride, index) => (
              <Pressable
                key={ride.id}
                onPress={() => onOpenRequest(ride)}
                style={({ pressed }) => [styles.requestRow, index > 0 && styles.rowDivider, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Ver solicitud de ${ride.passenger_name}`}
              >
                <View style={styles.flex}>
                  <Text style={styles.requestName} numberOfLines={1}>{ride.passenger_name || 'Pasajero'}</Text>
                  <Text style={styles.requestRoute} numberOfLines={1}>{ride.origin} → {ride.destination}</Text>
                </View>
                <Text style={styles.requestFare}>
                  {ride.payment_method === 'diamantes' ? '◆' : '$'} {ride.fare_amount.toFixed(2)}
                </Text>
                <Icon name="chevron-right-outline" size={22} color={theme.colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.quickRow}>
        <PressableScale variant="glass" accent={theme.colors.secondary} containerStyle={styles.flex} style={styles.quick} onPress={onOpenWallet} accessibilityLabel="Ver ganancias">
          <Icon name="credit-card-outline" size={24} color={theme.colors.diamond} />
          <Text style={styles.quickValue} numberOfLines={1}>◆ {(summary?.diamonds ?? 0).toFixed(2)}</Text>
          <Text style={styles.quickLabel} numberOfLines={2}>Ganancias</Text>
        </PressableScale>
        <PressableScale variant="glass" accent={theme.colors.secondary} containerStyle={styles.flex} style={styles.quick} onPress={onOpenWallet} accessibilityLabel="Taller aliado">
          <Icon name="settings-2-outline" size={24} color={theme.colors.secondary} />
          <Text style={styles.quickValue} numberOfLines={1}>Taller</Text>
          <Text style={styles.quickLabel} numberOfLines={2}>Canjea servicios</Text>
        </PressableScale>
        <View style={[styles.quick, styles.flex]}>
          <Icon name="star-outline" size={24} color={theme.colors.gold} />
          <Text style={styles.quickValue} numberOfLines={1}>{summary?.rating_avg ? summary.rating_avg.toFixed(2) : 'Nuevo'}</Text>
          <Text style={styles.quickLabel} numberOfLines={2}>{summary?.trips_completed ?? 0} viajes</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = themed(() => ({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 20,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  hello: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  name: {
    fontFamily: theme.fonts.bold,
    fontSize: 30,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    boxShadow: theme.glow.soft,
  },
  power: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statusTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
  },
  statusBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
  offline: {
    fontFamily: theme.fonts.medium,
    fontSize: 12.5,
    color: theme.colors.warning,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  doneButton: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondarySoft,
    borderWidth: 1,
    borderColor: theme.colors.secondaryLine,
  },
  doneText: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: theme.colors.secondary,
  },
  list: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    borderWidth: 1,
    borderColor: theme.colors.secondaryLine,
    overflow: 'hidden',
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
  },
  requestName: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  requestRoute: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  requestFare: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.secondary,
  },
  // Las tres tarjetas miden lo mismo: la fila las estira al alto de la más alta
  // y cada una llena su espacio (también la de calificación, que no se toca).
  quickRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  quick: {
    flexGrow: 1,
    alignItems: 'flex-start',
    gap: 6,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  quickValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  quickLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    // Siempre reserva dos líneas: los textos de las tres tarjetas quedan alineados.
    minHeight: 32,
    color: theme.colors.textMuted,
  },
}));
