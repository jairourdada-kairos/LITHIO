/**
 * RidesListScreen.tsx — Historial y viajes agendados de la sesión
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { PrimaryButton } from '../../components/brand/PrimaryButton';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import { apiService } from '../../services/api';
import type { SessionRole } from '../../services/session';
import type { Ride } from '../../types';

interface Props {
  scope: 'history' | 'scheduled';
  role: SessionRole;
  /** Cambia cuando hay que recargar (p. ej. tras un cambio de estado). */
  reloadKey: number;
  onPrimaryAction?: () => void;
}

const STATUS: Record<string, { label: string; color: string }> = {
  solicitado: { label: 'Pendiente', color: theme.colors.warning },
  aceptado: { label: 'Aceptado', color: theme.colors.primary },
  en_camino: { label: 'En camino', color: theme.colors.primary },
  en_curso: { label: 'En curso', color: theme.colors.secondary },
  completado: { label: 'Completado', color: theme.colors.success },
  cancelado: { label: 'Cancelado', color: theme.colors.error },
  rechazado: { label: 'Rechazado', color: theme.colors.error },
};

function formatDate(ride: Ride) {
  if (ride.is_scheduled && ride.scheduled_time) return ride.scheduled_time;
  const date = new Date(ride.created_at);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const RidesListScreen: React.FC<Props> = ({ scope, role, reloadKey, onPrimaryAction }) => {
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setRides(await apiService.getMyRides(scope, role));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los viajes.');
    } finally {
      setRefreshing(false);
    }
  }, [scope, role]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const title = scope === 'history' ? 'Historial' : 'Viajes agendados';
  const counterpart = (ride: Ride) => (role === 'pasajero' ? ride.driver_name : ride.passenger_name);

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} />
      {rides === null && !error ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={rides || []}
          keyExtractor={(ride) => String(ride.id)}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_HEIGHT + 64 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name={scope === 'history' ? 'history' : 'calendar-blank-outline'}
                size={44}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyText}>
                {error ||
                  (scope === 'history'
                    ? 'Aún no tienes viajes terminados.'
                    : role === 'pasajero'
                      ? 'No tienes viajes agendados por ahora.'
                      : 'No tienes viajes programados aceptados ni pendientes.')}
              </Text>
              {scope === 'scheduled' && role === 'pasajero' && onPrimaryAction ? (
                <PrimaryButton label="Agendar un viaje" onPress={onPrimaryAction} style={styles.emptyButton} />
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const status = STATUS[item.status] || { label: item.status, color: theme.colors.textMuted };
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.date}>{formatDate(item)}</Text>
                  <Text style={[styles.status, { color: status.color, borderColor: `${status.color}66` }]}>
                    {status.label}
                  </Text>
                </View>
                <View style={styles.route}>
                  <View style={styles.stops}>
                    <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
                    <View style={styles.line} />
                    <View style={[styles.dot, { backgroundColor: theme.colors.secondary }]} />
                  </View>
                  <View style={styles.places}>
                    <Text style={styles.place} numberOfLines={1}>{item.origin}</Text>
                    <Text style={styles.place} numberOfLines={1}>{item.destination}</Text>
                  </View>
                  <Text style={styles.fare}>${item.fare_amount.toFixed(2)}</Text>
                </View>
                <Text style={styles.person}>
                  {role === 'pasajero' ? 'Conductor' : 'Pasajero'}: {counterpart(item) || '—'}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    marginTop: 48,
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 80,
  },
  emptyText: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  status: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stops: {
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  line: {
    width: 2,
    height: 12,
    backgroundColor: theme.colors.cardBorder,
  },
  places: {
    flex: 1,
    gap: 4,
  },
  place: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  fare: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  person: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});
