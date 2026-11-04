/**
 * PassengerHome.tsx — Inicio del pasajero (boceto v3)
 *
 * Una tarjeta protagonista para viajar, tus saldos en una sola tarjeta y un
 * carrusel "Explora" con lo demás. Sin mapas: al pedir el viaje se eligen
 * ruta y conductor de confianza.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Icon, IconName } from '../../components/ui/Icon';
import { PulseRing } from '../../components/brand/PulseRing';
import { LithiumAtom } from '../../components/brand/LithiumAtom';
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { theme, themed } from '../../constants/theme';
import { TopBar, greeting } from '../../components/home/TopBar';
import { PressableScale } from '../../components/brand/PressableScale';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import type { AuthUser } from '../../services/auth';
import type { AccountSummary } from '../../services/api';
import type { PresetRoute, Ride } from '../../types';

interface Props {
  user: AuthUser;
  summary: AccountSummary | null;
  /** null: todavía no se sabe. */
  availableDrivers: number | null;
  routes: PresetRoute[];
  activeRide: Ride | null;
  linksCount: number | null;
  quizAnswered: boolean | null;
  refreshing: boolean;
  onRefresh: () => void;
  onRequestTrip: (options?: { route?: PresetRoute; scheduled?: boolean }) => void;
  onOpenActiveRide: () => void;
  onOpenWallet: () => void;
  onOpenProfile: () => void;
  onOpenQuiz: () => void;
  onOpenLinks: () => void;
  onOpenRewards: () => void;
  onOpenAbout: () => void;
  onProtectStreak: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  solicitado: 'Esperando que el conductor acepte',
  aceptado: 'Tu conductor aceptó el viaje',
  en_camino: 'Tu conductor va en camino',
  en_curso: 'Viaje en curso',
  completado: 'Viaje completado · califícalo',
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const enter = (index: number) =>
  FadeInDown.duration(320).delay(index * 50).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

export const PassengerHome: React.FC<Props> = ({
  user,
  summary,
  availableDrivers,
  routes,
  activeRide,
  linksCount,
  quizAnswered,
  refreshing,
  onRefresh,
  onRequestTrip,
  onOpenActiveRide,
  onOpenWallet,
  onOpenProfile,
  onOpenQuiz,
  onOpenLinks,
  onOpenRewards,
  onOpenAbout,
  onProtectStreak,
}) => {
  const suggested = [...routes].sort((a, b) => Number(b.popular) - Number(a.popular)).slice(0, 2);
  const diamonds = summary?.diamonds ?? 0;
  const points = summary?.points ?? user.points;
  const streak = summary?.streak;
  const hasStreak = Boolean(streak && streak.weeks > 0);
  const comeback = Boolean(streak && streak.weeks === 0 && streak.best > 0);
  // Barra hacia la siguiente meta: la mejor marca, o una semana más si ya la igualó (máximo 8 tramos).
  const streakGoal = streak ? Math.min(Math.max(streak.best, streak.weeks + 1, 4), 8) : 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 56 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <TopBar name={user.name} avatarUrl={user.avatar_url} accent={theme.colors.primary} onPressAvatar={onOpenProfile} />

      <Animated.View entering={enter(0)}>
        <Text style={styles.hello}>{greeting()}</Text>
        <Text style={styles.name}>{user.name.split(' ')[0]}</Text>
      </Animated.View>

      {activeRide ? (
        <Animated.View entering={enter(1)}>
          <PressableScale variant="glass" style={styles.activeRide} onPress={onOpenActiveRide} accessibilityLabel="Ver mi viaje en curso">
            <View style={styles.liveDot} />
            <View style={styles.flex}>
              <Text style={styles.activeTitle}>{STATUS_LABEL[activeRide.status] || 'Viaje activo'}</Text>
              <Text style={styles.activeRoute} numberOfLines={1}>
                {activeRide.origin} → {activeRide.destination}
              </Text>
            </View>
            <Icon name="chevron-right-outline" size={24} color={theme.colors.primary} />
          </PressableScale>
        </Animated.View>
      ) : null}

      {streak && comeback ? (
        <Animated.View entering={enter(1)} style={styles.comeback} accessibilityRole="text">
          <View style={styles.comebackIcon}>
            <Icon name="flash-outline" size={22} color={theme.colors.textSecondary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.streakTitle}>Tu mejor racha: {streak.best} {streak.best === 1 ? 'semana' : 'semanas'}</Text>
            <Text style={styles.streakCaption}>Un viaje esta semana y empiezas otra.</Text>
          </View>
        </Animated.View>
      ) : null}

      {streak && hasStreak ? (
        <Animated.View entering={enter(1)} style={styles.streak}>
          <View style={styles.streakIcon}>
            <Icon name={streak.protected_this_week ? 'shield' : 'flash-outline'} size={22} color={theme.colors.gold} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.streakTitle}>
              Racha de {streak.weeks} {streak.weeks === 1 ? 'semana' : 'semanas'}
            </Text>
            <Text style={styles.streakCaption}>
              {streak.active_this_week
                ? 'Ya viajaste esta semana.'
                : streak.protected_this_week
                  ? 'Protegida con tu comodín esta semana.'
                  : 'Viaja antes del domingo para mantenerla.'}
            </Text>
            <View
              style={styles.streakBar}
              accessibilityRole="progressbar"
              accessibilityLabel={`${streak.weeks} de ${streakGoal} semanas`}
            >
              {Array.from({ length: streakGoal }, (_, week) => (
                <View key={week} style={[styles.streakStep, week < streak.weeks && styles.streakStepDone]} />
              ))}
            </View>
            {streak.freeze.available ? (
              <PressableScale
                variant="plain"
                style={[styles.freeze, points < streak.freeze.cost && styles.freezeOff]}
                disabled={points < streak.freeze.cost}
                onPress={onProtectStreak}
                accessibilityLabel={`Proteger la racha con un comodín por ${streak.freeze.cost} Fe`}
              >
                <Icon name="shield-outline" size={16} color={theme.colors.gold} />
                <Text style={styles.freezeText}>
                  {points < streak.freeze.cost
                    ? `Comodín: te faltan ${streak.freeze.cost - points} Fe`
                    : `Usar comodín · ${streak.freeze.cost} Fe`}
                </Text>
              </PressableScale>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(2)} style={styles.hero}>
        {/* Órbitas decorativas: el átomo de la marca, sin cargar la tarjeta */}
        <View style={styles.watermark} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {[0, 60, -60].map((tilt) => (
            <View key={tilt} style={[styles.watermarkOrbit, { transform: [{ rotate: `${tilt}deg` }, { scaleY: 0.36 }] }]} />
          ))}
        </View>
        <View style={styles.heroEdge} pointerEvents="none" />

        <Text style={styles.heroTitle}>¿A dónde vas hoy?</Text>
        {availableDrivers !== null ? (
          <View style={styles.live} accessibilityLiveRegion="polite">
            <View style={styles.liveMark}>
              {availableDrivers > 0 ? <PulseRing size={8} color={theme.colors.success} /> : null}
              <View style={[styles.liveCore, availableDrivers === 0 && styles.liveCoreOff]} />
            </View>
            <Text style={styles.liveText}>
              {availableDrivers === 0
                ? 'Sin conductores disponibles ahora'
                : `${availableDrivers} ${availableDrivers === 1 ? 'conductor disponible' : 'conductores disponibles'} ahora`}
            </Text>
          </View>
        ) : null}
        <View style={styles.suggestions}>
          {suggested.map((route, index) => (
            <Pressable
              key={route.id}
              onPress={() => onRequestTrip({ route })}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${route.origin} a ${route.destination}, ${route.estimated_minutes} minutos, ${route.fare_usd} dólares`}
            >
              <View style={[styles.dot, { backgroundColor: index === 0 ? theme.colors.primary : theme.colors.secondary }]} />
              <View style={styles.flex}>
                <Text style={styles.suggestionText} numberOfLines={1}>
                  {route.origin} → {route.destination}
                </Text>
                <Text style={styles.suggestionTime}>{route.estimated_minutes} min</Text>
              </View>
              <Text style={styles.suggestionFare}>${route.fare_usd.toFixed(2)}</Text>
            </Pressable>
          ))}
        </View>
        <PressableScale variant="solid" style={styles.primaryButton} onPress={() => onRequestTrip()} accessibilityLabel="Iniciar trayecto">
          <Text style={styles.primaryButtonText}>Iniciar trayecto</Text>
        </PressableScale>
        <Pressable
          onPress={() => onRequestTrip({ scheduled: true })}
          style={styles.scheduleLink}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Icon name="calendar-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.scheduleText}>Programar para después</Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <PressableScale variant="glass" style={styles.energy} onPress={onOpenWallet} accessibilityLabel="Abrir billetera">
          <View style={styles.flex}>
            <Text style={styles.energyLabel}>Diamantes</Text>
            <Text style={[styles.energyValue, { color: theme.colors.diamond }]}>◆ {diamonds.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.flex, styles.energyRight]}>
            <Text style={styles.energyLabel}>Hierro</Text>
            <Text style={[styles.energyValue, { color: theme.colors.gold }]}>Fe {points}</Text>
          </View>
          <Icon name="chevron-right-outline" size={22} color={theme.colors.textMuted} />
        </PressableScale>
      </Animated.View>

      <Animated.View entering={enter(4)}>
        <Text style={styles.sectionTitle}>Explora</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          <ExploreCard
            icon="droplet-outline"
            tint={theme.colors.primary}
            title="Reacción del día"
            caption={quizAnswered ? 'Respondida · vuelve mañana' : '+10 Fe si aciertas'}
            onPress={onOpenQuiz}
          />
          <ExploreCard
            icon="people-outline"
            tint={theme.colors.secondary}
            title="Tus enlaces"
            caption={linksCount === null ? 'Amigos de viaje' : `${linksCount} ${linksCount === 1 ? 'enlace' : 'enlaces'}`}
            onPress={onOpenLinks}
          />
          <ExploreCard
            icon="book-open-outline"
            tint={theme.colors.gold}
            title="Pasar con 20"
            caption="Carrera gratis por tu 20"
            onPress={onOpenRewards}
          />
          <PressableScale variant="glass" style={[styles.exploreCard, { borderColor: theme.colors.glassBorder }]} onPress={onOpenAbout}>
            <LithiumAtom size={40} animated={false} />
            <Text style={styles.exploreTitle}>¿Qué es LITHIO?</Text>
            <Text style={styles.exploreCaption}>Nuestro manifiesto</Text>
          </PressableScale>
        </ScrollView>
      </Animated.View>
    </ScrollView>
  );
};

const ExploreCard: React.FC<{ icon: IconName; tint: string; title: string; caption: string; onPress: () => void }> = ({
  icon,
  tint,
  title,
  caption,
  onPress,
}) => (
  <PressableScale
    style={[styles.exploreCard, { backgroundImage: theme.fx.tint(tint), borderColor: `${tint}2E` }]}
    onPress={onPress}
    accessibilityLabel={title}
  >
    <View style={[styles.exploreIcon, { backgroundColor: `${tint}22` }]}>
      <Icon name={icon} size={22} color={tint} />
    </View>
    <Text style={styles.exploreTitle}>{title}</Text>
    <Text style={styles.exploreCaption}>{caption}</Text>
  </PressableScale>
);

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
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: `${theme.colors.gold}2E`,
    backgroundImage: theme.fx.tint(theme.colors.gold),
    boxShadow: theme.fx.cardGlow(theme.colors.gold),
  },
  streakIcon: {
    boxShadow: `0 0 18px ${theme.colors.gold}59`,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.gold}22`,
  },
  freeze: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    marginTop: 10,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.gold}66`,
    backgroundColor: theme.colors.goldSoft,
  },
  freezeOff: {
    opacity: 0.7,
  },
  freezeText: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: theme.colors.gold,
  },
  streakBar: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  streakStep: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: `${theme.colors.gold}2E`,
  },
  streakStepDone: {
    backgroundColor: theme.colors.gold,
    boxShadow: `0 0 8px ${theme.colors.gold}80`,
  },
  comeback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.surface,
    backgroundImage: theme.fx.sheen,
  },
  comebackIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardElevated,
  },
  streakTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  streakCaption: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  hello: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  name: {
    fontFamily: theme.fonts.bold,
    fontSize: 34,
    color: theme.colors.textPrimary,
    letterSpacing: -0.8,
  },
  activeRide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
    backgroundColor: theme.colors.primarySoft,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  activeTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  activeRoute: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  hero: {
    padding: 20,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    backgroundImage: theme.fx.tint(theme.colors.primary),
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    overflow: 'hidden',
    boxShadow: theme.fx.cardGlow(theme.colors.primary),
  },
  heroEdge: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 1.5,
    backgroundImage: theme.fx.energy,
  },
  watermark: {
    position: 'absolute',
    right: -70,
    top: -96,
    width: 250,
    height: 250,
    opacity: 0.55,
  },
  watermarkOrbit: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
  },
  heroTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 21,
    color: theme.colors.textPrimary,
  },
  suggestions: {
    marginTop: 14,
    marginBottom: 18,
    gap: 4,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  liveMark: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  liveCoreOff: {
    backgroundColor: theme.colors.textMuted,
  },
  liveText: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  suggestionTime: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  suggestionText: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  suggestionFare: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  primaryButton: {
    backgroundImage: theme.fx.gloss,
    boxShadow: theme.fx.glowOf(theme.colors.primary),
    minHeight: 54,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.onPrimary,
  },
  scheduleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    marginTop: 6,
  },
  scheduleText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  energy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    backgroundImage: theme.fx.sheen,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  energyRight: {
    paddingLeft: 2,
  },
  divider: {
    width: 1,
    height: 34,
    backgroundColor: theme.colors.glassBorder,
  },
  energyLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    color: theme.colors.textMuted,
  },
  energyValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 19,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  carousel: {
    gap: 12,
    paddingRight: 20,
  },
  exploreCard: {
    width: 148,
    minHeight: 132,
    padding: 14,
    gap: 8,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    backgroundImage: theme.fx.sheen,
  },
  exploreIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 14.5,
    color: theme.colors.textPrimary,
  },
  exploreCaption: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
}));
