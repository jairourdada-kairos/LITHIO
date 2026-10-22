/**
 * DriverHome.tsx — Inicio del conductor
 *
 * Estado de conexión, resumen, viaje en curso y bandeja de solicitudes que
 * llegan en tiempo real (NEW_RIDE_REQUEST) con Aceptar / Rechazar.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { HomeHeader } from '../../components/home/HomeHeader';
import { PressableScale } from '../../components/brand/PressableScale';
import { ActiveRideCard } from '../../components/ActiveRideCard';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import type { AuthUser } from '../../services/auth';
import type { AccountSummary } from '../../services/api';
import type { Ride, RideStatus } from '../../types';

interface Props {
  user: AuthUser;
  points: number;
  summary: AccountSummary | null;
  isAvailable: boolean;
  togglingAvailability: boolean;
  connected: boolean;
  activeRide: Ride | null;
  requests: Ride[];
  busyRideId: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  onToggleAvailability: () => void;
  onRespond: (ride: Ride, status: RideStatus) => void;
  onDismissCompleted: () => void;
  onOpenAccount: () => void;
}

const PAYMENT_LABEL: Record<string, string> = { efectivo: 'Efectivo', pago_movil: 'Pago Móvil' };

export const DriverHome: React.FC<Props> = ({
  user,
  points,
  summary,
  isAvailable,
  togglingAvailability,
  connected,
  activeRide,
  requests,
  busyRideId,
  refreshing,
  onRefresh,
  onToggleAvailability,
  onRespond,
  onDismissCompleted,
  onOpenAccount,
}) => {
  const online = isAvailable && !activeRide;
  const statusColor = activeRide ? theme.colors.warning : online ? theme.colors.success : theme.colors.textMuted;

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 64 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.secondary} />}
    >
      <HomeHeader
        name={user.name}
        avatarUrl={user.avatar_url}
        role="conductor"
        rank={user.xp_level}
        points={points}
        onPressAvatar={onOpenAccount}
        onPressPoints={onOpenAccount}
      />

      <View style={[styles.statusCard, { borderColor: `${statusColor}66` }]}>
        <View style={styles.statusText}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusTitle, { color: statusColor }]}>
              {activeRide ? 'En un viaje' : online ? 'Conectado' : 'Desconectado'}
            </Text>
          </View>
          <Text style={styles.statusBody}>
            {activeRide
              ? 'No apareces en el directorio hasta terminar este viaje.'
              : online
                ? 'Los pasajeros pueden elegirte. Las solicitudes llegan aquí.'
                : 'Conéctate para aparecer en el directorio y recibir solicitudes.'}
          </Text>
          {!connected ? (
            <Text style={styles.offline}>Reconectando con el servidor…</Text>
          ) : null}
        </View>
        {!activeRide ? (
          <PressableScale
            onPress={onToggleAvailability}
            disabled={togglingAvailability}
            accessibilityLabel={online ? 'Desconectarme' : 'Conectarme'}
            style={[
              styles.power,
              online
                ? { backgroundColor: theme.colors.success, boxShadow: '0 0 24px rgba(16, 185, 129, 0.5)' }
                : { backgroundColor: theme.colors.cardElevated, borderColor: theme.colors.cardBorder },
            ]}
          >
            {togglingAvailability ? (
              <ActivityIndicator color={theme.colors.textPrimary} />
            ) : (
              <MaterialCommunityIcons name="power" size={32} color={online ? theme.colors.bgDark : theme.colors.textSecondary} />
            )}
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.stats}>
        <Stat value={String(summary?.trips_completed ?? '—')} label="Viajes" />
        <Stat
          value={summary?.rating_avg ? summary.rating_avg.toFixed(2) : 'Nuevo'}
          label="Calificación"
          icon="star"
        />
        <Stat value={String(points)} label="Fe" gold />
      </View>

      {activeRide ? (
        <View>
          <Text style={styles.sectionTitle}>Viaje en curso</Text>
          <ActiveRideCard
            ride={activeRide}
            role="conductor"
            onUpdateStatus={(status) => onRespond(activeRide, status)}
            onOpenReview={() => {}}
            onCancel={() => onRespond(activeRide, 'cancelado')}
          />
          {activeRide.status === 'completado' ? (
            <PressableScale style={styles.doneButton} onPress={onDismissCompleted}>
              <Text style={styles.doneText}>Listo, volver a recibir solicitudes</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      <View>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Solicitudes</Text>
          {requests.length ? <Text style={styles.count}>{requests.length}</Text> : null}
        </View>
        {requests.length === 0 ? (
          <View style={styles.radar}>
            <MaterialCommunityIcons name="radar" size={36} color={online ? theme.colors.secondary : theme.colors.textMuted} />
            <Text style={styles.radarTitle}>{online ? 'Esperando solicitudes' : 'Sin solicitudes'}</Text>
            <Text style={styles.radarBody}>
              Cuando un pasajero te elija, su solicitud aparecerá aquí al instante.
            </Text>
          </View>
        ) : (
          requests.map((ride) => (
            <Animated.View
              key={ride.id}
              entering={FadeInDown.duration(240).reduceMotion(ReduceMotion.System)}
              layout={LinearTransition.duration(200)}
              style={styles.request}
            >
              <View style={styles.requestTop}>
                <Text style={styles.requestPassenger} numberOfLines={1}>{ride.passenger_name || 'Pasajero'}</Text>
                <Text style={styles.requestFare}>${ride.fare_amount.toFixed(2)}</Text>
              </View>
              <View style={styles.requestRoute}>
                <View style={styles.routeStops}>
                  <View style={[styles.stopDot, { backgroundColor: theme.colors.primary }]} />
                  <View style={styles.stopLine} />
                  <View style={[styles.stopDot, { backgroundColor: theme.colors.secondary }]} />
                </View>
                <View style={styles.requestPlaces}>
                  <Text style={styles.place} numberOfLines={1}>{ride.origin}</Text>
                  <Text style={styles.place} numberOfLines={1}>{ride.destination}</Text>
                </View>
              </View>
              <View style={styles.requestMeta}>
                <Tag icon={ride.is_scheduled ? 'calendar-clock' : 'lightning-bolt'} text={ride.is_scheduled ? ride.scheduled_time || 'Programado' : 'Ahora'} />
                <Tag icon="cash" text={PAYMENT_LABEL[ride.payment_method] || ride.payment_method} />
              </View>
              <View style={styles.requestActions}>
                <PressableScale
                  containerStyle={styles.flex}
                  style={styles.reject}
                  disabled={busyRideId === ride.id}
                  onPress={() => onRespond(ride, 'rechazado')}
                >
                  <Text style={styles.rejectText}>Rechazar</Text>
                </PressableScale>
                <PressableScale
                  containerStyle={styles.flex2}
                  style={styles.accept}
                  disabled={busyRideId === ride.id || Boolean(activeRide)}
                  onPress={() => onRespond(ride, 'aceptado')}
                >
                  {busyRideId === ride.id ? (
                    <ActivityIndicator color={theme.colors.bgDark} />
                  ) : (
                    <Text style={styles.acceptText}>Aceptar viaje</Text>
                  )}
                </PressableScale>
              </View>
            </Animated.View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const Stat: React.FC<{ value: string; label: string; icon?: 'star'; gold?: boolean }> = ({ value, label, icon, gold }) => (
  <View style={styles.stat}>
    <View style={styles.statValueRow}>
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={theme.colors.gold} /> : null}
      <Text style={[styles.statValue, gold && { color: theme.colors.gold }]}>{value}</Text>
    </View>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Tag: React.FC<{ icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }> = ({ icon, text }) => (
  <View style={styles.tag}>
    <MaterialCommunityIcons name={icon} size={13} color={theme.colors.textSecondary} />
    <Text style={styles.tagText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 18,
  },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.glassBg,
  },
  statusText: {
    flex: 1,
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
  },
  statusBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  offline: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.warning,
  },
  power: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  count: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 12,
    color: theme.colors.bgDark,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  doneButton: {
    marginTop: 10,
    minHeight: 48,
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
  radar: {
    alignItems: 'center',
    gap: 6,
    padding: 28,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.cardBorder,
  },
  radarTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  radarBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  request: {
    gap: 12,
    padding: 16,
    marginBottom: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.secondaryLine,
    backgroundColor: theme.colors.glassBgStrong,
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  requestPassenger: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  requestFare: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.secondary,
  },
  requestRoute: {
    flexDirection: 'row',
    gap: 10,
  },
  routeStops: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  stopDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  stopLine: {
    width: 2,
    height: 12,
    backgroundColor: theme.colors.cardBorder,
  },
  requestPlaces: {
    flex: 1,
    gap: 4,
  },
  place: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  requestMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.cardElevated,
  },
  tagText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  reject: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  rejectText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  accept: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
  },
  acceptText: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.bgDark,
  },
});
