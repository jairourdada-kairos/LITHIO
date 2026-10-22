/**
 * PassengerApp.tsx — App del pasajero (sesión con rol fijo)
 *
 * Pestañas: Inicio · Historial · [Pedir viaje] · Agendados · Cuenta.
 * Pantallas superpuestas (pedir viaje, mi viaje, mis datos) con botón de
 * volver y soporte del botón atrás de Android.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Alert, BackHandler, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { apiService, AccountSummary } from '../services/api';
import { wsService } from '../services/websocket';
import type { AuthUser } from '../services/auth';
import { useRideCenter } from '../hooks/useRideCenter';
import { BottomTabBar } from '../components/nav/BottomTabBar';
import { NoticeBanner } from '../components/ui/NoticeBanner';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { ActiveRideCard } from '../components/ActiveRideCard';
import { RequestRideModal } from '../components/RequestRideModal';
import { ReviewModal } from '../components/ReviewModal';
import { RewardsStoreModal } from '../components/RewardsStoreModal';
import { AboutLithioModal } from '../components/AboutLithioModal';
import { PassengerHome } from '../screens/passenger/PassengerHome';
import { TripRequestScreen, TripSelection } from '../screens/passenger/TripRequestScreen';
import { RidesListScreen } from '../screens/shared/RidesListScreen';
import { AccountScreen } from '../screens/shared/AccountScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import type { Driver, PaymentMethod, PresetRoute, Reward, ReviewSubmission } from '../types';

type Tab = 'home' | 'history' | 'scheduled' | 'account';
type Overlay =
  | { type: 'trip'; route?: PresetRoute; scheduled?: boolean }
  | { type: 'ride' }
  | { type: 'profile' }
  | null;

interface Props {
  user: AuthUser;
  onSignOut: () => void;
}

export const PassengerApp: React.FC<Props> = ({ user, onSignOut }) => {
  const [tab, setTab] = useState<Tab>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [routes, setRoutes] = useState<PresetRoute[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<{ driver: Driver; selection: TripSelection } | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [rewardsVisible, setRewardsVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);

  const rides = useRideCenter(user.id, 'pasajero');
  const points = summary?.points ?? user.points;

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [routesData, driversData, rewardsData, summaryData] = await Promise.all([
        apiService.getPresetRoutes(),
        apiService.getDrivers(),
        apiService.getRewards(),
        apiService.getSummary('pasajero'),
      ]);
      setRoutes(routesData);
      setDrivers(driversData);
      setRewards(rewardsData);
      setSummary(summaryData);
    } catch (error) {
      Alert.alert('No se pudieron cargar los datos', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    // El directorio se actualiza en vivo cuando un conductor se conecta o toma un viaje.
    return wsService.subscribe((msg) => {
      if (msg.type === 'DRIVER_AVAILABILITY_CHANGED') {
        setDrivers((prev) => prev.map((d) => (d.user_id === msg.driver_id ? { ...d, is_available: msg.is_available } : d)));
      }
    });
  }, [loadData]);

  // Cada cambio de estado del viaje puede sumar Fe o mover el historial.
  const rideStatus = rides.activeRide?.status;
  useEffect(() => {
    apiService.getSummary('pasajero').then(setSummary).catch(() => {});
    setReloadKey((key) => key + 1);
  }, [rideStatus]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pending) {
        setPending(null);
        return true;
      }
      if (overlay) {
        setOverlay(null);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [overlay, tab, pending]);

  const openTrip = (options?: { route?: PresetRoute; scheduled?: boolean }) => {
    if (rides.activeRide) {
      setOverlay({ type: 'ride' });
      return;
    }
    void apiService.getDrivers().then(setDrivers).catch(() => {});
    setOverlay({ type: 'trip', ...options });
  };

  const confirmRide = async (paymentMethod: PaymentMethod, reference?: string) => {
    if (!pending) return;
    const { driver, selection } = pending;
    try {
      const ride = await apiService.requestRide(user.id, {
        driver_id: driver.user_id,
        origin: selection.route.origin,
        destination: selection.route.destination,
        is_scheduled: selection.isScheduled,
        scheduled_time: selection.isScheduled ? selection.scheduledTime : undefined,
        payment_method: paymentMethod,
        payment_reference: reference,
        fare_amount: selection.route.fare_usd,
      });
      rides.setActiveRide(ride);
      setPending(null);
      setOverlay({ type: 'ride' });
    } catch (error) {
      Alert.alert('No se pudo solicitar el viaje', error instanceof Error ? error.message : 'Intenta de nuevo.');
    }
  };

  const cancelRide = () => {
    const ride = rides.activeRide;
    if (!ride) return;
    Alert.alert('Cancelar viaje', '¿Seguro que quieres cancelar esta solicitud?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await rides.updateStatus(ride, 'cancelado');
            setOverlay(null);
          } catch (error) {
            Alert.alert('No se pudo cancelar', error instanceof Error ? error.message : 'Intenta de nuevo.');
          }
        },
      },
    ]);
  };

  const submitReview = async (review: ReviewSubmission) => {
    try {
      const result = await apiService.submitReview(user.id, review);
      setReviewVisible(false);
      rides.setActiveRide(null);
      setOverlay(null);
      setSummary((prev) => (prev ? { ...prev, points: prev.points + result.points_earned } : prev));
      Alert.alert('¡Gracias por tu reseña!', `Sumaste +${result.points_earned} Fe.`);
    } catch (error) {
      Alert.alert('No se pudo enviar la reseña', error instanceof Error ? error.message : 'Intenta de nuevo.');
    }
  };

  const redeem = async (reward: Reward) => {
    const result = await apiService.redeemReward(user.id, reward.id);
    setSummary((prev) => (prev ? { ...prev, points: result.new_balance } : prev));
    return { discount_code: result.discount_code };
  };

  const pasarCon20 = () =>
    Alert.alert(
      'Pasar con 20',
      'Muy pronto podrás canjear 500 Fe por una carrera gratis subiendo la evidencia de tu 20. Sigue acumulando Fe.'
    );

  const renderOverlay = () => {
    if (!overlay) return null;
    if (overlay.type === 'trip') {
      return (
        <TripRequestScreen
          routes={routes}
          drivers={drivers}
          initialRoute={overlay.route}
          initialScheduled={overlay.scheduled}
          onBack={() => setOverlay(null)}
          onChooseDriver={(driver, selection) => setPending({ driver, selection })}
        />
      );
    }
    if (overlay.type === 'profile') {
      return <ProfileScreen user={user} role="pasajero" onBack={() => setOverlay(null)} />;
    }
    const ride = rides.activeRide;
    return (
      <View style={styles.overlayRoot}>
        <ScreenHeader title="Mi viaje" onBack={() => setOverlay(null)} />
        {ride ? (
          <View style={styles.rideBody}>
            <ActiveRideCard
              ride={ride}
              role="pasajero"
              onUpdateStatus={() => {}}
              onOpenReview={() => setReviewVisible(true)}
              onCancel={cancelRide}
            />
          </View>
        ) : (
          <Text style={styles.noRide}>No tienes un viaje activo.</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        {overlay ? renderOverlay() : tab === 'home' ? (
          <PassengerHome
            user={user}
            points={points}
            routes={routes}
            activeRide={rides.activeRide}
            refreshing={refreshing}
            onRefresh={loadData}
            onRequestTrip={openTrip}
            onOpenActiveRide={() => setOverlay({ type: 'ride' })}
            onOpenRewards={() => setRewardsVisible(true)}
            onOpenAccount={() => setTab('account')}
            onOpenAbout={() => setAboutVisible(true)}
            onOpenPasarCon20={pasarCon20}
          />
        ) : tab === 'history' || tab === 'scheduled' ? (
          <RidesListScreen
            scope={tab}
            role="pasajero"
            reloadKey={reloadKey}
            onPrimaryAction={() => openTrip({ scheduled: true })}
          />
        ) : (
          <AccountScreen
            user={user}
            role="pasajero"
            points={points}
            summary={summary}
            onOpenProfile={() => setOverlay({ type: 'profile' })}
            onOpenHistory={() => setTab('history')}
            onOpenScheduled={() => setTab('scheduled')}
            onOpenRewards={() => setRewardsVisible(true)}
            onOpenAbout={() => setAboutVisible(true)}
            onSignOut={onSignOut}
          />
        )}
      </View>

      {!overlay ? (
        <BottomTabBar<Tab>
          tabs={[
            { key: 'home', label: 'Inicio', icon: 'home-variant-outline' },
            { key: 'history', label: 'Historial', icon: 'history' },
            { key: 'scheduled', label: 'Agendados', icon: 'calendar-month-outline', badge: summary?.scheduled_count },
            { key: 'account', label: 'Cuenta', icon: 'account-outline' },
          ]}
          active={tab}
          onChange={setTab}
          center={{
            icon: rides.activeRide ? 'map-marker-path' : 'motorbike',
            label: rides.activeRide ? 'Ver mi viaje' : 'Pedir un viaje',
            color: theme.colors.primary,
            onPress: () => openTrip(),
            live: Boolean(rides.activeRide),
          }}
        />
      ) : null}

      <NoticeBanner
        notice={rides.notice}
        onClose={rides.clearNotice}
        onPress={() => rides.activeRide && setOverlay({ type: 'ride' })}
      />

      <RequestRideModal
        visible={Boolean(pending)}
        driver={pending?.driver || null}
        origin={pending?.selection.route.origin || ''}
        destination={pending?.selection.route.destination || ''}
        fareAmount={pending?.selection.route.fare_usd || 0}
        isScheduled={Boolean(pending?.selection.isScheduled)}
        scheduledTime={pending?.selection.scheduledTime || ''}
        userPoints={points}
        onClose={() => setPending(null)}
        onConfirm={confirmRide}
      />

      {rides.activeRide ? (
        <ReviewModal
          visible={reviewVisible}
          rideId={rides.activeRide.id}
          driverName={rides.activeRide.driver_name || 'Conductor'}
          onClose={() => setReviewVisible(false)}
          onSubmit={submitReview}
        />
      ) : null}

      <RewardsStoreModal
        visible={rewardsVisible}
        userPoints={points}
        rewards={rewards}
        onClose={() => setRewardsVisible(false)}
        onRedeem={redeem}
      />

      <AboutLithioModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  content: {
    flex: 1,
  },
  overlayRoot: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  rideBody: {
    paddingHorizontal: 16,
  },
  noRide: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 48,
  },
});
