/**
 * PassengerHome.tsx — Inicio del pasajero
 *
 * Buscador "¿A dónde vamos?", servicios, rutas frecuentes de la comunidad
 * y el viaje en curso si lo hay. Sin mapas ni ubicación: al pedir el viaje
 * se eligen ruta y conductor.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { HomeHeader } from '../../components/home/HomeHeader';
import { PressableScale } from '../../components/brand/PressableScale';
import { LithiumAtom } from '../../components/brand/LithiumAtom';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import type { AuthUser } from '../../services/auth';
import type { PresetRoute, Ride } from '../../types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  user: AuthUser;
  points: number;
  routes: PresetRoute[];
  activeRide: Ride | null;
  refreshing: boolean;
  onRefresh: () => void;
  onRequestTrip: (options?: { route?: PresetRoute; scheduled?: boolean }) => void;
  onOpenActiveRide: () => void;
  onOpenRewards: () => void;
  onOpenAccount: () => void;
  onOpenAbout: () => void;
  onOpenPasarCon20: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  solicitado: 'Esperando que el conductor acepte',
  aceptado: 'Tu conductor aceptó el viaje',
  en_camino: 'Tu conductor va en camino',
  en_curso: 'Viaje en curso',
  completado: 'Viaje completado · califícalo',
};

export const PassengerHome: React.FC<Props> = ({
  user,
  points,
  routes,
  activeRide,
  refreshing,
  onRefresh,
  onRequestTrip,
  onOpenActiveRide,
  onOpenRewards,
  onOpenAccount,
  onOpenAbout,
  onOpenPasarCon20,
}) => {
  const frequent = [...routes].sort((a, b) => Number(b.popular) - Number(a.popular)).slice(0, 6);

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 64 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <HomeHeader
        name={user.name}
        avatarUrl={user.avatar_url}
        role="pasajero"
        rank={user.xp_level}
        points={points}
        onPressAvatar={onOpenAccount}
        onPressPoints={onOpenRewards}
      />

      {activeRide ? (
        <PressableScale style={styles.activeRide} onPress={onOpenActiveRide} accessibilityLabel="Ver mi viaje en curso">
          <View style={styles.liveDot} />
          <View style={styles.activeText}>
            <Text style={styles.activeTitle}>{STATUS_LABEL[activeRide.status] || 'Viaje activo'}</Text>
            <Text style={styles.activeRoute} numberOfLines={1}>
              {activeRide.origin} → {activeRide.destination}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.primary} />
        </PressableScale>
      ) : null}

      <PressableScale style={styles.search} onPress={() => onRequestTrip()} accessibilityLabel="¿A dónde vamos? Pedir un viaje">
        <View style={styles.searchDot}>
          <View style={styles.searchDotInner} />
        </View>
        <Text style={styles.searchText}>¿A dónde vamos?</Text>
        <View style={styles.searchNow}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.searchNowText}>Ahora</Text>
        </View>
      </PressableScale>

      <View style={styles.services}>
        <ServiceTile icon="motorbike" label="Viaje ahora" accent={theme.colors.primary} onPress={() => onRequestTrip()} />
        <ServiceTile
          icon="calendar-clock"
          label="Programar"
          accent={theme.colors.primary}
          onPress={() => onRequestTrip({ scheduled: true })}
        />
        <ServiceTile icon="star-four-points" label="Tienda Fe" accent={theme.colors.gold} onPress={onOpenRewards} />
      </View>

      <PressableScale style={styles.voucher} onPress={onOpenPasarCon20} accessibilityLabel="Voucher Pasar con 20">
        <View style={styles.voucherIcon}>
          <Text style={styles.voucherGrade}>20</Text>
        </View>
        <View style={styles.voucherText}>
          <Text style={styles.voucherTitle}>Pasar con 20</Text>
          <Text style={styles.voucherBody}>¿Sacaste 20 en un examen? Canjea 500 Fe por una carrera gratis.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.gold} />
      </PressableScale>

      {frequent.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Rutas frecuentes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routes}>
            {frequent.map((route) => (
              <PressableScale
                key={route.id}
                style={styles.routeCard}
                onPress={() => onRequestTrip({ route })}
                accessibilityLabel={`${route.origin} a ${route.destination}, ${route.fare_usd} dólares`}
              >
                <Text style={styles.routeTag} numberOfLines={1}>{route.tag || 'Ruta LITHIO'}</Text>
                <View style={styles.routeLine}>
                  <View style={[styles.routeDot, { backgroundColor: theme.colors.primary }]} />
                  <Text style={styles.routePlace} numberOfLines={1}>{route.origin}</Text>
                </View>
                <View style={styles.routeConnector} />
                <View style={styles.routeLine}>
                  <View style={[styles.routeDot, { backgroundColor: theme.colors.secondary }]} />
                  <Text style={styles.routePlace} numberOfLines={1}>{route.destination}</Text>
                </View>
                <View style={styles.routeFooter}>
                  <Text style={styles.routeFare}>${route.fare_usd.toFixed(2)}</Text>
                  <Text style={styles.routeTime}>{route.estimated_minutes} min</Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Pressable style={styles.about} onPress={onOpenAbout} accessibilityRole="button">
        <LithiumAtom size={56} animated={false} />
        <View style={styles.aboutText}>
          <Text style={styles.aboutTitle}>¿Qué es LITHIO?</Text>
          <Text style={styles.aboutBody}>Movilidad comunitaria hecha por y para la universidad.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.textSecondary} />
      </Pressable>
    </ScrollView>
  );
};

const ServiceTile: React.FC<{ icon: IconName; label: string; accent: string; onPress: () => void }> = ({
  icon,
  label,
  accent,
  onPress,
}) => (
  <PressableScale containerStyle={styles.serviceCell} style={styles.service} onPress={onPress} accessibilityLabel={label}>
    <View style={[styles.serviceIcon, { borderColor: `${accent}55`, backgroundColor: `${accent}1A` }]}>
      <MaterialCommunityIcons name={icon} size={30} color={accent} />
    </View>
    <Text style={styles.serviceLabel}>{label}</Text>
  </PressableScale>
);

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 18,
  },
  activeRide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
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
    boxShadow: '0 0 10px rgba(69, 214, 197, 0.9)',
  },
  activeText: {
    flex: 1,
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.glassBgStrong,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    boxShadow: theme.glow.soft,
  },
  searchDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  searchText: {
    flex: 1,
    fontFamily: theme.fonts.semibold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  searchNow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.cardElevated,
  },
  searchNowText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  services: {
    flexDirection: 'row',
    gap: 12,
  },
  serviceCell: {
    flex: 1,
  },
  service: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.glassBg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  voucher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.35)',
    backgroundColor: theme.colors.goldSoft,
  },
  voucherIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherGrade: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 20,
    color: theme.colors.gold,
  },
  voucherText: {
    flex: 1,
  },
  voucherTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  voucherBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: -6,
  },
  routes: {
    gap: 12,
    paddingRight: 20,
  },
  routeCard: {
    width: 176,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.glassBg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  routeTag: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeConnector: {
    width: 1,
    height: 10,
    marginLeft: 3.5,
    backgroundColor: theme.colors.cardBorder,
  },
  routePlace: {
    flex: 1,
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  routeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 12,
  },
  routeFare: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.primary,
  },
  routeTime: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  about: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  aboutText: {
    flex: 1,
  },
  aboutTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  aboutBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
