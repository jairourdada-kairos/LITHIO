/**
 * TripRequestScreen.tsx — Pedir un viaje
 *
 * 1. ¿Ahora o programado? (fechas y horas solo futuras)
 * 2. Ruta de la comunidad con su tarifa
 * 3. Conductores disponibles para esa ruta → confirmar en RequestRideModal
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Avatar } from '../../components/ui/Avatar';
import { PressableScale } from '../../components/brand/PressableScale';
import type { Driver, PresetRoute } from '../../types';

export interface TripSelection {
  route: PresetRoute;
  isScheduled: boolean;
  scheduledTime: string;
}

interface Props {
  routes: PresetRoute[];
  drivers: Driver[];
  initialRoute?: PresetRoute;
  initialScheduled?: boolean;
  onBack: () => void;
  onChooseDriver: (driver: Driver, selection: TripSelection) => void;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const pad = (value: number) => String(value).padStart(2, '0');

function upcomingDays(count: number) {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    return {
      key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      label: index === 0 ? 'Hoy' : index === 1 ? 'Mañana' : DAY_NAMES[date.getDay()],
      day: date.getDate(),
      isToday: index === 0,
    };
  });
}

/** Horarios cada 30 min de 05:30 a 22:00; hoy solo desde 30 min después de ahora. */
function timeSlots(isToday: boolean) {
  const now = new Date();
  const earliest = now.getHours() * 60 + now.getMinutes() + 30;
  const slots: string[] = [];
  for (let minutes = 5 * 60 + 30; minutes <= 22 * 60; minutes += 30) {
    if (isToday && minutes < earliest) continue;
    slots.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return slots;
}

export const TripRequestScreen: React.FC<Props> = ({
  routes,
  drivers,
  initialRoute,
  initialScheduled = false,
  onBack,
  onChooseDriver,
}) => {
  const insets = useSafeAreaInsets();
  const [scheduled, setScheduled] = useState(initialScheduled);
  const days = useMemo(() => upcomingDays(7), []);
  const [dayKey, setDayKey] = useState(days[0].key);
  const day = days.find((d) => d.key === dayKey) || days[0];
  const slots = useMemo(() => timeSlots(day.isToday), [day.isToday]);
  const [time, setTime] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<number | null>(initialRoute?.id ?? null);
  const route = routes.find((r) => r.id === routeId) || null;

  useEffect(() => {
    if (time && !slots.includes(time)) setTime(null);
  }, [slots, time]);

  const available = drivers
    .filter((d) => d.is_available)
    .sort((a, b) => b.rating_avg - a.rating_avg || b.trips_count - a.trips_count);
  const scheduleReady = !scheduled || Boolean(time);

  return (
    <View style={styles.root}>
      <ScreenHeader title="¿A dónde vamos?" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {[
            { value: false, label: 'Ahora', icon: 'lightning-bolt' as const },
            { value: true, label: 'Programar', icon: 'calendar-clock' as const },
          ].map((option) => {
            const selected = scheduled === option.value;
            return (
              <Pressable
                key={option.label}
                onPress={() => setScheduled(option.value)}
                style={[styles.segmentItem, selected && styles.segmentItemActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={18}
                  color={selected ? theme.colors.bgDark : theme.colors.textSecondary}
                />
                <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {scheduled ? (
          <View style={styles.block}>
            <Text style={styles.stepLabel}>¿Cuándo?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {days.map((d) => {
                const selected = d.key === dayKey;
                return (
                  <Pressable
                    key={d.key}
                    onPress={() => setDayKey(d.key)}
                    style={[styles.dayChip, selected && styles.chipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.dayName, selected && styles.chipTextActive]}>{d.label}</Text>
                    <Text style={[styles.dayNumber, selected && styles.chipTextActive]}>{d.day}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {slots.length === 0 ? (
              <Text style={styles.hint}>Ya no quedan horarios hoy. Elige otro día.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {slots.map((slot) => {
                  const selected = slot === time;
                  return (
                    <Pressable
                      key={slot}
                      onPress={() => setTime(slot)}
                      style={[styles.timeChip, selected && styles.chipActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.timeText, selected && styles.chipTextActive]}>{slot}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.stepLabel}>Elige tu ruta</Text>
          {routes.map((r) => {
            const selected = r.id === routeId;
            return (
              <PressableScale
                key={r.id}
                onPress={() => setRouteId(r.id)}
                style={[styles.routeRow, selected && styles.routeRowActive]}
                accessibilityLabel={`${r.origin} a ${r.destination}, ${r.fare_usd} dólares`}
                accessibilityState={{ selected }}
              >
                <View style={styles.routeStops}>
                  <View style={[styles.stopDot, { backgroundColor: theme.colors.primary }]} />
                  <View style={styles.stopLine} />
                  <View style={[styles.stopDot, { backgroundColor: theme.colors.secondary }]} />
                </View>
                <View style={styles.routeText}>
                  <Text style={styles.routePlace} numberOfLines={1}>{r.origin}</Text>
                  <Text style={styles.routePlace} numberOfLines={1}>{r.destination}</Text>
                  <Text style={styles.routeMeta}>{r.tag || 'Ruta LITHIO'} · {r.estimated_minutes} min</Text>
                </View>
                <Text style={[styles.routeFare, selected && { color: theme.colors.primary }]}>${r.fare_usd.toFixed(2)}</Text>
              </PressableScale>
            );
          })}
        </View>

        {route ? (
          <View style={styles.block}>
            <View style={styles.driversHeader}>
              <Text style={styles.stepLabel}>Conductores disponibles</Text>
              <Text style={styles.count}>{available.length}</Text>
            </View>
            {!scheduleReady ? (
              <Text style={styles.hint}>Elige la hora del viaje para ver a los conductores.</Text>
            ) : available.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="motorbike-off" size={32} color={theme.colors.textMuted} />
                <Text style={styles.emptyText}>No hay conductores disponibles en este momento. Desliza hacia abajo en el inicio para actualizar.</Text>
              </View>
            ) : (
              available.map((driver) => (
                <DriverOption
                  key={driver.user_id}
                  driver={driver}
                  onChoose={() =>
                    onChooseDriver(driver, {
                      route,
                      isScheduled: scheduled,
                      scheduledTime: scheduled && time ? `${dayKey} ${time}` : '',
                    })
                  }
                />
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const DriverOption: React.FC<{ driver: Driver; onChoose: () => void }> = ({ driver, onChoose }) => (
  <PressableScale style={styles.driver} onPress={onChoose} accessibilityLabel={`Elegir a ${driver.name}`}>
    <Avatar name={driver.name} uri={driver.avatar_url} size={48} ringColor={theme.colors.secondary} />
    <View style={styles.driverText}>
      <Text style={styles.driverName} numberOfLines={1}>{driver.name}</Text>
      <Text style={styles.driverMoto} numberOfLines={1}>
        {driver.moto_brand_model} · {driver.moto_color}
      </Text>
      <View style={styles.driverMeta}>
        <MaterialCommunityIcons name="star" size={14} color={theme.colors.gold} />
        <Text style={styles.driverRating}>
          {driver.trips_count > 0 ? driver.rating_avg.toFixed(2) : 'Nuevo'}
        </Text>
        <Text style={styles.driverTrips} numberOfLines={1}>· {driver.trips_count} viajes</Text>
        {driver.helmet_provided ? (
          <View style={styles.helmet}>
            <MaterialCommunityIcons name="racing-helmet" size={12} color={theme.colors.primary} />
            <Text style={styles.helmetText}>Casco</Text>
          </View>
        ) : null}
      </View>
    </View>
    <View style={styles.choose}>
      <Text style={styles.chooseText}>Elegir</Text>
    </View>
  </PressableScale>
);

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 24,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.glassBgStrong,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: theme.radius.full,
  },
  segmentItemActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: theme.colors.bgDark,
  },
  block: {
    gap: 10,
  },
  stepLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  chipRow: {
    gap: 8,
    paddingRight: 20,
  },
  dayChip: {
    width: 64,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  dayName: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  dayNumber: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  timeChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  timeText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipTextActive: {
    color: theme.colors.bgDark,
  },
  hint: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  routeRowActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  routeStops: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stopLine: {
    width: 2,
    height: 14,
    backgroundColor: theme.colors.cardBorder,
  },
  routeText: {
    flex: 1,
    gap: 2,
  },
  routePlace: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  routeMeta: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  routeFare: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  driversHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  count: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 12,
    color: theme.colors.bgDark,
    backgroundColor: theme.colors.success,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.cardBorder,
  },
  emptyText: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  driver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  driverText: {
    flex: 1,
    gap: 2,
  },
  driverName: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  driverMoto: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  driverMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 4,
    rowGap: 4,
    marginTop: 2,
  },
  driverRating: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
  },
  driverTrips: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    color: theme.colors.textMuted,
  },
  helmet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primarySoft,
  },
  helmetText: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    color: theme.colors.primary,
  },
  choose: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
  chooseText: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.bgDark,
  },
}));
