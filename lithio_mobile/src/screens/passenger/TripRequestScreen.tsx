/**
 * TripRequestScreen.tsx — Pedir un viaje, en tres pasos
 *
 * Paso 1 · Tipo: Rutas Internas (dentro del IVIC) o Rutas Externas (del IVIC hacia
 *   afuera): dos tarjetas iguales con cuántas rutas hay y "desde $X".
 * Paso 2 · Ruta: ¿ahora o programado? (fechas y horas solo futuras) y la ruta
 *   del tipo elegido con su tarifa. Un botón fijo abajo lleva al paso 3.
 * Paso 3 · Conductor: resumen del trayecto (con "Cambiar") y los conductores
 *   disponibles → confirmar en RequestRideModal.
 * Cada paso ocupa la pantalla entera y entra deslizándose, como una página
 * siguiente. Desde el inicio con una ruta ya elegida se salta el paso Tipo
 * y se abre en el paso 3.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Animated, { ReduceMotion, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Icon } from '../../components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Avatar } from '../../components/ui/Avatar';
import { PressableScale } from '../../components/brand/PressableScale';
import { PrimaryButton } from '../../components/brand/PrimaryButton';
import { SlidingPill } from '../../components/ui/Motion';
import { hapticSelect } from '../../services/haptics';
import type { Driver, PresetRoute } from '../../types';
import { apiService } from '../../services/api';
import { formatBs, useBcvRate } from '../../services/rates';
import { placeName } from '../../utils/text';

export interface TripSelection {
  route: PresetRoute;
  isScheduled: boolean;
  scheduledTime: string;
}

interface Props {
  routes: PresetRoute[];
  drivers: Driver[];
  /** La lista no se pudo cargar: se avisa y se deja reintentar en vez de mostrarla como vacía. */
  driversError?: boolean;
  onRetryDrivers?: () => void;
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
  driversError = false,
  onRetryDrivers,
  initialRoute,
  initialScheduled = false,
  onBack,
  onChooseDriver,
}) => {
  const bcv = useBcvRate();
  const insets = useSafeAreaInsets();
  const [scheduled, setScheduled] = useState(initialScheduled);
  const days = useMemo(() => upcomingDays(7), []);
  const [dayKey, setDayKey] = useState(days[0].key);
  const day = days.find((d) => d.key === dayKey) || days[0];
  const slots = useMemo(() => timeSlots(day.isToday), [day.isToday]);
  const [time, setTime] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<number | null>(initialRoute?.id ?? null);
  // Rutas invertidas por el pasajero (ej. BIBLIOTECA → UNC en vez de UNC → BIBLIOTECA): misma tarifa y tiempo.
  const [flipped, setFlipped] = useState<number[]>([]);
  const toggleFlip = (id: number) => {
    hapticSelect();
    setRouteId(id);
    flip(id);
  };
  const flip = (id: number) => setFlipped((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const oriented = (r: PresetRoute): PresetRoute => (flipped.includes(r.id) ? { ...r, origin: r.destination, destination: r.origin } : r);
  const baseRoute = routes.find((r) => r.id === routeId) || null;
  const route = baseRoute ? oriented(baseRoute) : null;
  const [scope, setScope] = useState<RouteScope | null>(initialRoute ? scopeOf(initialRoute) : null);
  const [step, setStep] = useState<Step>(initialRoute ? (initialScheduled ? 'route' : 'driver') : 'type');
  // Hacia adelante entra por la derecha; al volver, por la izquierda.
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const goTo = (next: Step) => {
    setDirection(STEPS.indexOf(next) > STEPS.indexOf(step) ? 'forward' : 'back');
    setStep(next);
  };
  const chooseScope = (next: RouteScope) => {
    setScope(next);
    // Si la ruta elegida antes es del otro tipo, se limpia.
    if (route && scopeOf(route) !== next) setRouteId(null);
    goTo('route');
  };
  const scopeRoutes = useMemo(() => routes.filter((r) => scopeOf(r) === scope), [routes, scope]);
  const scopeStats = useMemo(
    () =>
      SCOPES.map((option) => {
        const list = routes.filter((r) => scopeOf(r) === option.key);
        return { ...option, count: list.length, from: list.length ? Math.min(...list.map((r) => r.fare_usd)) : null };
      }),
    [routes],
  );

  useEffect(() => {
    if (time && !slots.includes(time)) setTime(null);
  }, [slots, time]);

  const available = drivers
    .filter((d) => d.is_available)
    .sort((a, b) => b.rating_avg - a.rating_avg || b.trips_count - a.trips_count);
  const [driversAlerted, setDriversAlerted] = useState(false);
  const choosingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noDriversNow = step === 'driver' && !scheduled && available.length === 0 && !driversError;

  useEffect(() => {
    return () => {
      if (choosingTimerRef.current) clearTimeout(choosingTimerRef.current);
    };
  }, []);

  // Cuenta como demanda sin atender y avisa a los conductores fuera de servicio.
  useEffect(() => {
    if (!noDriversNow) return;
    let cancelled = false;
    apiService
      .reportNoDrivers()
      .then((result) => {
        if (!cancelled) setDriversAlerted(result.drivers_notified > 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [noDriversNow]);

  const chooseDriverOnce = (driver: Driver) => {
    if (!route || choosingTimerRef.current) return;
    choosingTimerRef.current = setTimeout(() => {
      choosingTimerRef.current = null;
    }, 600);
    onChooseDriver(driver, {
      route,
      isScheduled: scheduled,
      scheduledTime: scheduled && time ? `${dayKey} ${time}` : '',
    });
  };

  const scheduleReady = !scheduled || Boolean(time);
  const canContinue = Boolean(route) && scheduleReady;
  const whenLabel = scheduled && time ? `${day.label} ${day.day} · ${time}` : 'Ahora';
  const entering = (direction === 'forward' ? SlideInRight : SlideInLeft).duration(280).reduceMotion(ReduceMotion.System);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={step === 'type' ? '¿Qué tipo de viaje?' : step === 'route' ? '¿A dónde te diriges?' : 'Elige tu conductor'}
        onBack={step === 'driver' ? () => goTo('route') : step === 'route' && !initialRoute ? () => goTo('type') : onBack}
      />
      <Stepper step={step} onGoTo={goTo} />

      {step === 'type' ? (
        <Animated.View key="type" entering={entering} style={styles.page}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
            <Text style={styles.typeIntro}>Elige a dónde va tu viaje: dentro del IVIC o hacia afuera.</Text>
            <View style={styles.typeCards}>
              {scopeStats.map((option) => {
                const color = option.key === 'interna' ? theme.colors.primary : theme.colors.secondary;
                const soft = option.key === 'interna' ? theme.colors.primarySoft : theme.colors.secondarySoft;
                const line = option.key === 'interna' ? theme.colors.primaryLine : theme.colors.secondaryLine;
                const selected = scope === option.key;
                return (
                  <PressableScale
                    variant="glass"
                    key={option.key}
                    onPress={() => chooseScope(option.key)}
                    style={[styles.typeCard, { backgroundColor: soft }, selected && { borderColor: line }]}
                    accessibilityLabel={`${option.title}, ${option.count} rutas${option.from !== null ? `, desde ${option.from.toFixed(2)} dólares` : ''}`}
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.typeIcon, { borderColor: line }]}>
                      <Icon name={option.icon} size={30} color={color} />
                    </View>
                    <Text style={styles.typeTitle}>{option.title}</Text>
                    <Text style={styles.typeSubtitle}>{option.subtitle}</Text>
                    <View style={styles.typeFooter}>
                      <Text style={styles.typeCount}>
                        {option.count} {option.count === 1 ? 'ruta' : 'rutas'}
                      </Text>
                      {option.from !== null ? (
                        <Text style={[styles.typeFrom, { color }]}>desde ${option.from.toFixed(2)}</Text>
                      ) : null}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      ) : null}

      {step === 'route' ? (
        <Animated.View key="route" entering={entering} style={styles.page}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 112 }]} showsVerticalScrollIndicator={false}>
            <View style={styles.segment} accessibilityRole="radiogroup">
              <SlidingPill index={scheduled ? 1 : 0} count={2} color={theme.colors.primary} />
              {[
                { value: false, label: 'Ahora', icon: 'flash-outline' as const },
                { value: true, label: 'Programar', icon: 'calendar-outline' as const },
              ].map((option) => {
                const selected = scheduled === option.value;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => {
                      if (scheduled !== option.value) hapticSelect();
                      setScheduled(option.value);
                    }}
                    style={styles.segmentItem}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Icon
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
              <Text style={styles.stepLabel}>
                {scope === 'interna' ? 'Rutas Internas · dentro del IVIC' : scope === 'externa' ? 'Rutas Externas · hacia afuera' : 'Elige tu ruta'}
              </Text>
              {scopeRoutes.length === 0 ? (
                <Text style={styles.hint}>Aún no hay rutas de este tipo. Vuelve atrás y elige el otro tipo.</Text>
              ) : null}
              {scopeRoutes.map((base) => {
                const r = oriented(base);
                const selected = r.id === routeId;
                return (
                  <PressableScale variant="glass"
                    key={r.id}
                    onPress={() => {
                      if (!selected) hapticSelect();
                      setRouteId(r.id);
                    }}
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
                      <Text style={styles.routePlace} numberOfLines={2}>{placeName(r.origin)}</Text>
                      <Text style={styles.routePlace} numberOfLines={2}>{placeName(r.destination)}</Text>
                      <Text style={styles.routeMeta}>{r.tag || 'Ruta LITHIO'} · {r.estimated_minutes} min</Text>
                    </View>
                    <Pressable
                      onPress={() => toggleFlip(r.id)}
                      style={styles.flipButton}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Invertir ruta: ir de ${r.destination} a ${r.origin}`}
                    >
                      <Icon name="swap-outline" size={18} color={theme.colors.primary} style={{ transform: [{ rotate: '90deg' }] }} />
                    </Pressable>
                    <View style={styles.fareBox}>
                      <Text style={[styles.routeFare, selected && { color: theme.colors.primary }]}>${r.fare_usd.toFixed(2)}</Text>
                      {bcv ? <Text style={styles.routeBs}>{formatBs(r.fare_usd, bcv)}</Text> : null}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </ScrollView>

          {/* Botón fijo: siempre a la vista mientras se elige la ruta. */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <PrimaryButton
              label={
                !route ? 'Elige una ruta' : !scheduleReady ? 'Elige la hora del viaje' : `Ver conductores · $${route.fare_usd.toFixed(2)} →`
              }
              disabled={!canContinue}
              onPress={() => goTo('driver')}
            />
          </View>
        </Animated.View>
      ) : route ? (
        <Animated.View key="driver" entering={entering} style={styles.page}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
            {/* Resumen del paso 1 */}
            <View style={styles.summary}>
              <View style={styles.routeStops}>
                <View style={[styles.stopDot, { backgroundColor: theme.colors.primary }]} />
                <View style={styles.stopLine} />
                <View style={[styles.stopDot, { backgroundColor: theme.colors.secondary }]} />
              </View>
              <View style={styles.routeText}>
                <Text style={styles.routePlace} numberOfLines={2}>{placeName(route.origin)}</Text>
                <Text style={styles.routePlace} numberOfLines={2}>{placeName(route.destination)}</Text>
                <View style={styles.summaryMeta}>
                  <Icon name={scheduled ? 'calendar-outline' : 'flash-outline'} size={13} color={theme.colors.primary} />
                  <Text style={styles.summaryWhen}>{whenLabel}</Text>
                  <Text style={styles.routeMeta}>· ${route.fare_usd.toFixed(2)}</Text>
                </View>
              </View>
              <PressableScale variant="glass" style={styles.change} onPress={() => goTo('route')} accessibilityLabel="Cambiar ruta u horario">
                <Text style={styles.changeText}>Cambiar</Text>
              </PressableScale>
            </View>

            <View style={styles.block}>
              <View style={styles.driversHeader}>
                <Text style={styles.stepLabel}>Conductores disponibles</Text>
                <Text style={styles.count}>{available.length}</Text>
              </View>
              {available.length === 0 ? (
                <View style={styles.empty}>
                  <Icon name="motorbike-off" size={32} color={theme.colors.textMuted} />
                  <Text style={styles.emptyText}>{driversError
                    ? 'No pudimos cargar los conductores. Revisa tu conexión e intenta de nuevo.'
                    : driversAlerted
                      ? 'No hay conductores disponibles en este momento. Ya les avisamos: cuando alguno se active, aparecerá aquí.'
                      : 'No hay conductores disponibles en este momento. Desliza hacia abajo en el inicio para actualizar.'}</Text>
                  {driversError && onRetryDrivers ? (
                    <PrimaryButton label="Reintentar" onPress={onRetryDrivers} style={styles.retryButton} />
                  ) : null}
                </View>
              ) : (
                available.map((driver, index) => (
                  <DriverOption
                    key={driver.user_id}
                    driver={driver}
                    topRated={index === 0 && available.length > 1 && driver.trips_count > 0}
                    onChoose={() => chooseDriverOnce(driver)}
                  />
                ))
              )}
            </View>
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
};

type Step = 'type' | 'route' | 'driver';
const STEPS: Step[] = ['type', 'route', 'driver'];
type RouteScope = 'interna' | 'externa';
const scopeOf = (route: PresetRoute): RouteScope => (route.scope === 'interna' ? 'interna' : 'externa');

const SCOPES: { key: RouteScope; title: string; subtitle: string; icon: 'home-outline' | 'navigation-2-outline' }[] = [
  { key: 'interna', title: 'Rutas Internas', subtitle: 'Dentro del IVIC', icon: 'home-outline' },
  { key: 'externa', title: 'Rutas Externas', subtitle: 'Del IVIC hacia afuera', icon: 'navigation-2-outline' },
];

/** Indicador de pasos: 1 Tipo — 2 Ruta — 3 Conductor. Los pasos ya hechos se pueden tocar para volver. */
const Stepper: React.FC<{ step: Step; onGoTo: (step: Step) => void }> = ({ step, onGoTo }) => {
  const items: { key: Step; label: string }[] = [
    { key: 'type', label: 'Tipo' },
    { key: 'route', label: 'Ruta' },
    { key: 'driver', label: 'Conductor' },
  ];
  const current = STEPS.indexOf(step);
  return (
    <View style={styles.stepper}>
      {items.map((item, index) => {
        const active = item.key === step;
        const done = index < current;
        return (
          <React.Fragment key={item.key}>
            {index > 0 ? <View style={[styles.stepperLine, index <= current && styles.stepperLineDone]} /> : null}
            <Pressable
              onPress={done ? () => onGoTo(item.key) : undefined}
              disabled={!done}
              style={styles.stepperItem}
              accessibilityRole={done ? 'button' : 'text'}
              accessibilityLabel={`Paso ${index + 1} de 3: ${item.label}${done ? ', volver' : active ? ', actual' : ''}`}
            >
              <View style={[styles.stepperDot, (active || done) && styles.stepperDotActive]}>
                {done ? (
                  <Icon name="checkmark-outline" size={14} color={theme.colors.bgDark} />
                ) : (
                  <Text style={[styles.stepperNumber, active && styles.stepperNumberActive]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepperLabel, (active || done) && styles.stepperLabelActive]}>{item.label}</Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
};

const DriverOption: React.FC<{ driver: Driver; topRated: boolean; onChoose: () => void }> = ({ driver, topRated, onChoose }) => {
  const verified = driver.is_verified === true;
  return (
    <PressableScale variant="glass" style={styles.driver} onPress={onChoose} accessibilityLabel={`Elegir a ${driver.name}`}>
      <Avatar name={driver.name} uri={driver.avatar_url} size={48} ringColor={theme.colors.secondary} />
      <View style={styles.driverText}>
        {topRated ? <Text style={styles.topRated}>Mejor calificado</Text> : null}
        <View style={styles.driverNameRow}>
          <Text style={styles.driverName} numberOfLines={1}>{driver.name}</Text>
          {verified ? (
            <View style={styles.verifiedBadge} accessibilityLabel="Conductor verificado">
              <Icon name="checkmark-circle-2" size={12} color={theme.colors.primary} />
              <Text style={styles.verifiedBadgeText}>Verificado</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.driverVehicleRow}>
          <Text style={styles.driverMoto} numberOfLines={1}>
            {driver.moto_brand_model} · {driver.moto_color}
          </Text>
        </View>
        <View style={styles.driverMeta}>
          <Icon name="star" size={14} color={theme.colors.gold} />
          <Text style={styles.driverRating}>
            {driver.trips_count > 0 ? driver.rating_avg.toFixed(2) : 'Nuevo'}
          </Text>
          <Text style={styles.driverTrips} numberOfLines={1}>· {driver.trips_count} viajes</Text>
          {driver.helmet_provided ? (
            <View style={styles.helmet}>
              <Icon name="racing-helmet" size={12} color={theme.colors.primary} />
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
};

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
    backgroundImage: theme.fx.aurora,
  },
  page: {
    flex: 1,
  },
  typeIntro: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  typeCards: {
    gap: 16,
  },
  typeCard: {
    minHeight: 190,
    padding: 20,
    gap: 6,
    justifyContent: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: theme.colors.glassBg,
    marginBottom: 8,
  },
  typeTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
  typeSubtitle: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  typeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  typeCount: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  typeFrom: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 24,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  stepperItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
  },
  stepperDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  stepperDotActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepperNumber: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  stepperNumberActive: {
    color: theme.colors.bgDark,
  },
  stepperLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  stepperLabelActive: {
    color: theme.colors.textPrimary,
  },
  stepperLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 10,
    borderRadius: 1,
    backgroundColor: theme.colors.glassBorder,
  },
  stepperLineDone: {
    backgroundColor: theme.colors.primary,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: theme.colors.glassBg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.primarySoft,
  },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  summaryWhen: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  change: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  changeText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  flipButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
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
    fontFamily: theme.fonts.medium,
    fontVariant: ['tabular-nums'],
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
  fareBox: {
    alignItems: 'flex-end',
  },
  routeBs: {
    fontFamily: theme.fonts.medium,
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  routeFare: {
    fontVariant: ['tabular-nums'],
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
    color: theme.colors.onAccent,
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
  topRated: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.gold,
    marginBottom: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  driverName: {
    flexShrink: 1,
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
  },
  verifiedBadgeText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  driverVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  driverMoto: {
    flexShrink: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  plateChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  plateChipText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 11,
    color: theme.colors.textPrimary,
    letterSpacing: 0.4,
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
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  driverTrips: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
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
    fontSize: 12,
    color: theme.colors.primary,
  },
  choose: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    backgroundImage: theme.fx.gloss,
    boxShadow: theme.fx.glowOf(theme.colors.primary),
  },
  chooseText: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.bgDark,
  },
}));
