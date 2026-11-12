/**
 * PassengerApp.tsx — App del pasajero (sesión con rol fijo)
 *
 * Pestañas: Inicio · Viajes · Billetera · Perfil.
 * Pantallas superpuestas (pedir viaje, mi viaje, mis datos) con botón de
 * volver y soporte del botón atrás de Android.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Alert, BackHandler, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, themed } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, AccountSummary, TopupMethod } from '../services/api';
import { wsService } from '../services/websocket';
import type { AuthUser } from '../services/auth';
import { useRideCenter } from '../hooks/useRideCenter';
import { GlassBlurScope, GlassBlurTarget } from '../components/ui/GlassSurface';
import { BottomTabBar } from '../components/nav/BottomTabBar';
import { ScreenFade } from '../components/ui/Motion';
import { NoticeBanner } from '../components/ui/NoticeBanner';
import { useAdminAlerts } from '../hooks/useAdminAlerts';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { ActiveRideCard } from '../components/ActiveRideCard';
import { RequestRideModal } from '../components/RequestRideModal';
import { ReviewModal } from '../components/ReviewModal';
import { FeStoreModal } from '../components/FeStoreModal';
import { AboutLithioModal } from '../components/AboutLithioModal';
import { TutorialModal, shouldShowTutorial } from '../components/TutorialModal';
import { PassengerHome } from '../screens/passenger/PassengerHome';
import { TripRequestScreen, TripSelection } from '../screens/passenger/TripRequestScreen';
import { TripsScreen } from '../screens/shared/TripsScreen';
import { WalletScreen } from '../screens/shared/WalletScreen';
import { AccountScreen } from '../screens/shared/AccountScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { LevelScreen } from '../screens/shared/LevelScreen';
import { LevelsTableScreen } from '../screens/shared/LevelsTableScreen';
import { AdminScreen } from '../screens/admin/AdminScreen';
import { LinksScreen } from '../screens/shared/LinksScreen';
import { QuizScreen } from '../screens/shared/QuizScreen';
import { AvatarSheet } from '../components/AvatarSheet';
import { FALLBACK_LEVEL } from '../utils/elements';
import type { Driver, PaymentMethod, PresetRoute, ReviewSubmission } from '../types';

type Tab = 'home' | 'trips' | 'fe' | 'wallet' | 'profile';
type Overlay =
  | { type: 'trip'; route?: PresetRoute; scheduled?: boolean }
  | { type: 'ride' }
  | { type: 'profile' }
  | { type: 'level' }
  | { type: 'levels' }
  | { type: 'admin' }
  | { type: 'links' }
  | { type: 'quiz' }
  | null;

interface Props {
  user: AuthUser;
  onSignOut: () => void;
}

export const PassengerApp: React.FC<Props> = ({ user: initialUser, onSignOut }) => {
  // Copia local para reflejar al instante cambios como la foto de perfil.
  const [user, setUser] = useState(initialUser);
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [routes, setRoutes] = useState<PresetRoute[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversError, setDriversError] = useState(false);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [linksCount, setLinksCount] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<{ driver: Driver; selection: TripSelection } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ rideId: number; driverName: string } | null>(null);
  // Petición de abrir la recarga de iones (desde un viaje, la tienda o el aviso de bienvenida).
  const [recharge, setRecharge] = useState<{ method: TopupMethod; nonce: number } | null>(null);
  const [tutorialChecked, setTutorialChecked] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const reviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptedReviewRidesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
    };
  }, []);

  const rides = useRideCenter(user.id, 'pasajero');
  const adminAlerts = useAdminAlerts(Boolean(summary?.is_admin));

  const loadSummary = useCallback(() => {
    apiService.getSummary('pasajero').then(setSummary).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [routesData, driversData, summaryData] = await Promise.all([
        apiService.getPresetRoutes(),
        apiService.getDrivers(),
        apiService.getSummary('pasajero'),
      ]);
      setRoutes(routesData);
      setDrivers(driversData);
      setSummary(summaryData);
      apiService.getLinksCount().then(setLinksCount).catch(() => {});
      apiService.getQuizToday().then((quiz) => setQuizAnswered(quiz.answered)).catch(() => {});
    } catch (error) {
      Alert.alert('No se pudieron cargar los datos', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadData();
    shouldShowTutorial(user.id, 'pasajero').then((show) => {
      if (cancelled) return;
      setTutorialVisible(show);
      setTutorialChecked(true);
    });
    // El directorio y la billetera se actualizan en vivo.
    const unsubscribe = wsService.subscribe((msg) => {
      if (msg.type === 'DRIVER_AVAILABILITY_CHANGED') {
        setDrivers((prev) => prev.map((d) => (d.user_id === msg.driver_id ? { ...d, is_available: msg.is_available } : d)));
      } else if (msg.type === 'WALLET_UPDATED') {
        loadSummary();
        setReloadKey((key) => key + 1);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadData, loadSummary, user.id]);

  // Cada cambio de estado del viaje puede sumar Fe, mover iones o el historial.
  const rideStatus = rides.activeRide?.status;
  const activeRideId = rides.activeRide?.id;
  const activeRideDriverName = rides.activeRide?.driver_name;
  const activeRideHasReview = Boolean(rides.activeRide?.has_review);
  useEffect(() => {
    loadSummary();
    setReloadKey((key) => key + 1);
  }, [rideStatus, loadSummary]);

  // Al pasar el viaje a "completado" sin reseña previa, abre automáticamente el modal una sola vez por viaje en la sesión.
  useEffect(() => {
    if (!activeRideId || rideStatus !== 'completado' || activeRideHasReview) return;
    if (promptedReviewRidesRef.current.has(activeRideId)) return;
    promptedReviewRidesRef.current.add(activeRideId);
    setReviewTarget({ rideId: activeRideId, driverName: activeRideDriverName || 'tu conductor' });
  }, [activeRideId, rideStatus, activeRideDriverName, activeRideHasReview]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (reviewTarget) {
        setReviewTarget(null);
        return true;
      }
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
  }, [overlay, tab, pending, reviewTarget]);

  const openRecharge = useCallback((method: TopupMethod = 'pago_movil') => {
    setPending(null);
    setOverlay(null);
    setTab('wallet');
    setRecharge({ method, nonce: Date.now() });
  }, []);

  // Cuenta nueva: avisa una sola vez de los iones de bienvenida e invita a recargar.
  // Espera a que se cierre el tutorial para no tapar una ventana con otra.
  useEffect(() => {
    if (!tutorialChecked || tutorialVisible) return;
    const key = `lithio.bonoBienvenida.${user.id}`;
    let cancelled = false;
    (async () => {
      if (await AsyncStorage.getItem(key)) return;
      const wallet = await apiService.getWallet();
      if (cancelled) return;
      await AsyncStorage.setItem(key, '1');
      const bonus = wallet.transactions.find((tx) => tx.kind === 'bono_bienvenida');
      // Solo a cuentas recientes: quien ya lleva tiempo en LITHIO no necesita el aviso.
      const recent = bonus ? Date.now() - new Date(`${bonus.created_at}Z`).getTime() < 7 * 24 * 3600 * 1000 : false;
      if (!bonus || !recent) return;
      Alert.alert(
        '¡Bienvenido a LITHIO!',
        `Te regalamos Li⁺ ${bonus.amount.toFixed(2)} para tus primeros viajes. Recarga cuando quieras para seguir viajando sin efectivo.`,
        [
          { text: 'Entendido', style: 'cancel' },
          { text: 'Recargar', onPress: () => openRecharge() },
        ],
      );
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tutorialChecked, tutorialVisible, user.id, openRecharge]);

  // Si falla, la pantalla del viaje lo dice y deja reintentar: una lista vacía no es lo mismo que una red caída.
  const loadDrivers = () => {
    setDriversError(false);
    void apiService.getDrivers().then(setDrivers).catch(() => setDriversError(true));
  };

  const openTrip = (options?: { route?: PresetRoute; scheduled?: boolean }) => {
    if (rides.activeRide) {
      setOverlay({ type: 'ride' });
      return;
    }
    loadDrivers();
    setOverlay({ type: 'trip', ...options });
  };

  // La referencia del Pago Móvil se anota después, en "Mi viaje", ya con los datos del conductor.
  const confirmRide = async (paymentMethod: PaymentMethod, couponId?: number) => {
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
        fare_amount: selection.route.fare_usd,
        coupon_id: couponId,
      });
      rides.setActiveRide(ride);
      setPending(null);
      setOverlay({ type: 'ride' });
    } catch (error) {
      loadDrivers();
      Alert.alert('No se pudo solicitar el viaje', error instanceof Error ? error.message : 'Intenta de nuevo.');
      throw error;
    }
  };

  const cancelRide = () => {
    const ride = rides.activeRide;
    if (!ride) return;
    const message =
      ride.status === 'solicitado'
        ? '¿Seguro que quieres cancelar esta solicitud?'
        : `¿Seguro que quieres cancelar el viaje? ${ride.driver_name || 'El conductor'} recibirá un aviso${ride.payment_method === 'diamantes' ? ' y te devolvemos los diamantes' : ride.payment_method === 'pase' ? ' y te devolvemos el pase' : ''}.`;
    Alert.alert('Cancelar viaje', message, [
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

  const protectStreak = () => {
    const streak = summary?.streak;
    if (!streak) return;
    Alert.alert(
      'Usar comodín',
      `Cuesta ${streak.freeze.cost} Fe. Si esta semana no viajas, tu racha de ${streak.weeks} semanas sigue viva. Puedes usar uno cada 4 semanas.`,
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Usar comodín',
          onPress: () => {
            apiService
              .freezeStreak()
              .then(loadSummary)
              .catch((error: Error) => Alert.alert('No se pudo usar el comodín', error.message));
          },
        },
      ],
    );
  };

  const submitReview = async (review: ReviewSubmission) => {
    try {
      const result = await apiService.submitReview(user.id, review);
      promptedReviewRidesRef.current.add(review.ride_id);
      setReviewTarget(null);
      if (rides.activeRide?.id === review.ride_id) {
        rides.setActiveRide(null);
        setOverlay(null);
      }
      loadSummary();
      setReloadKey((key) => key + 1);
      // Se espera a que cierre la hoja de la reseña: abrir otro Modal mientras uno se
      // cierra puede dejar la pantalla congelada o en blanco (sobre todo en iOS).
      if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
      reviewTimerRef.current = setTimeout(() => {
        reviewTimerRef.current = null;
        Alert.alert(
          '¡Gracias por tu reseña!',
          result.points_earned ? `Sumaste +${result.points_earned} Fe. El conductor ya puede leerla.` : 'El conductor ya puede leerla.'
        );
      }, 350);
    } catch (error) {
      Alert.alert('No se pudo enviar la reseña', error instanceof Error ? error.message : 'Intenta de nuevo.');
    }
  };


  const renderOverlay = () => {
    if (!overlay) return null;
    if (overlay.type === 'trip') {
      return (
        <TripRequestScreen
          routes={routes}
          drivers={drivers}
          driversError={driversError}
          onRetryDrivers={loadDrivers}
          initialRoute={overlay.route}
          initialScheduled={overlay.scheduled}
          onBack={() => setOverlay(null)}
          onChooseDriver={(driver, selection) => setPending({ driver, selection })}
        />
      );
    }
    if (overlay.type === 'profile') {
      return (
        <ProfileScreen
          user={user}
          role="pasajero"
          onBack={() => setOverlay(null)}
          onUserChanged={(changes) => setUser((prev) => ({ ...prev, ...changes }))}
          onAccountDeleted={onSignOut}
        />
      );
    }
    if (overlay.type === 'level') {
      return (
        <LevelScreen
          level={summary?.level ?? FALLBACK_LEVEL}
          accent={theme.colors.primary}
          onBack={() => setOverlay(null)}
          onOpenTable={() => setOverlay({ type: 'levels' })}
        />
      );
    }
    if (overlay.type === 'levels') {
      return <LevelsTableScreen accent={theme.colors.primary} onBack={() => setOverlay({ type: 'level' })} />;
    }
    if (overlay.type === 'links') {
      return (
        <LinksScreen
          accent={theme.colors.primary}
          onBack={() => {
            setOverlay(null);
            apiService.getLinksCount().then(setLinksCount).catch(() => {});
          }}
        />
      );
    }
    if (overlay.type === 'quiz') {
      return (
        <QuizScreen
          accent={theme.colors.primary}
          onBack={() => setOverlay(null)}
          onAnswered={(points) => {
            setQuizAnswered(true);
            if (points !== undefined) setSummary((prev) => (prev ? { ...prev, points } : prev));
          }}
        />
      );
    }
    if (overlay.type === 'admin') {
      return <AdminScreen onBack={() => setOverlay(null)} />;
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
              onOpenReview={() => setReviewTarget({ rideId: ride.id, driverName: ride.driver_name || 'tu conductor' })}
              onCancel={cancelRide}
              onReferenceSaved={(reference) => rides.setActiveRide({ ...ride, payment_reference: reference })}
            />
          </View>
        ) : (
          <Text style={styles.noRide}>No tienes un viaje activo.</Text>
        )}
      </View>
    );
  };

  const renderTab = () => {
    switch (tab) {
      case 'trips':
        return (
          <TripsScreen
            role="pasajero"
            reloadKey={reloadKey}
            accent={theme.colors.primary}
            onScheduleTrip={() => openTrip({ scheduled: true })}
          />
        );
      case 'wallet':
        return <WalletScreen role="pasajero" reloadKey={reloadKey} recharge={recharge} />;
      case 'fe':
        return (
          <FeStoreModal
            variant="screen"
            visible
            reloadKey={reloadKey}
            onClose={() => setTab('home')}
            onPointsChanged={(value) => setSummary((prev) => (prev ? { ...prev, points: value } : prev))}
            onRecharge={() => openRecharge()}
          />
        );
      case 'profile':
        return (
          <AccountScreen
            user={user}
            role="pasajero"
            summary={summary}
            onOpenProfile={() => setOverlay({ type: 'profile' })}
            onEditPhoto={() => setAvatarSheetVisible(true)}
            onOpenLevel={() => setOverlay({ type: 'level' })}
            onOpenAdmin={summary?.is_admin ? () => setOverlay({ type: 'admin' }) : undefined}
            onOpenLinks={() => setOverlay({ type: 'links' })}
            onOpenRewards={() => setTab('fe')}
            onOpenTutorial={() => setTutorialVisible(true)}
            onOpenAbout={() => setAboutVisible(true)}
            onSignOut={onSignOut}
          />
        );
      default:
        return (
          <PassengerHome
            user={user}
            summary={summary}
            availableDrivers={summary ? drivers.filter((d) => d.is_available).length : null}
            onProtectStreak={protectStreak}
            routes={routes}
            activeRide={rides.activeRide}
            linksCount={linksCount}
            quizAnswered={quizAnswered}
            refreshing={refreshing}
            onRefresh={loadData}
            onRequestTrip={openTrip}
            onOpenActiveRide={() => setOverlay({ type: 'ride' })}
            onOpenWallet={() => setTab('wallet')}
            onOpenProfile={() => setTab('profile')}
            onOpenQuiz={() => setOverlay({ type: 'quiz' })}
            onOpenLinks={() => setOverlay({ type: 'links' })}
            onOpenRewards={() => setTab('fe')}
            onOpenAbout={() => setAboutVisible(true)}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <GlassBlurScope>
        <GlassBlurTarget style={styles.content}>
          <ScreenFade key={overlay ? `overlay-${overlay.type}` : `tab-${tab}`}>{overlay ? renderOverlay() : renderTab()}</ScreenFade>
        </GlassBlurTarget>

        {!overlay ? (
          <BottomTabBar<Tab>
            tabs={[
              { key: 'home', label: 'Inicio', icon: 'home-outline' },
              { key: 'trips', label: 'Viajes', icon: 'navigation-2-outline', badge: summary?.scheduled_count },
              { key: 'fe', label: 'Tienda Fe', icon: 'shopping-bag-outline' },
              { key: 'wallet', label: 'Billetera', icon: 'credit-card-outline' },
              { key: 'profile', label: 'Perfil', icon: 'person-outline' },
            ]}
            active={tab}
            onChange={setTab}
            accent={theme.colors.primary}
          />
        ) : null}

        <NoticeBanner
          notice={rides.notice}
          onClose={rides.clearNotice}
          onPress={() => rides.activeRide && setOverlay({ type: 'ride' })}
        />
        {/* Solicitudes para el administrador; espera a que se cierre el aviso del viaje. */}
        <NoticeBanner
          notice={rides.notice ? null : adminAlerts.notice}
          onClose={adminAlerts.clear}
          onPress={() => {
            adminAlerts.clear();
            setOverlay({ type: 'admin' });
          }}
        />

        <RequestRideModal
          visible={Boolean(pending)}
          driver={pending?.driver || null}
          origin={pending?.selection.route.origin || ''}
          destination={pending?.selection.route.destination || ''}
          fareAmount={pending?.selection.route.fare_usd || 0}
          isScheduled={Boolean(pending?.selection.isScheduled)}
          scheduledTime={pending?.selection.scheduledTime || ''}
          routeScope={pending?.selection.route.scope}
          onClose={() => setPending(null)}
          onConfirm={confirmRide}
          onRecharge={openRecharge}
        />

        {/* Siempre montado: si el viaje deja de estar activo mientras se escribe, la reseña sigue abierta. */}
        <ReviewModal
          visible={Boolean(reviewTarget)}
          rideId={reviewTarget?.rideId ?? 0}
          driverName={reviewTarget?.driverName ?? 'tu conductor'}
          onClose={() => setReviewTarget(null)}
          onSubmit={submitReview}
        />

        <AvatarSheet
          visible={avatarSheetVisible}
          hasPhoto={Boolean(user.avatar_url)}
          accent={theme.colors.primary}
          onClose={() => setAvatarSheetVisible(false)}
          onChanged={(avatarUrl) => setUser((prev) => ({ ...prev, avatar_url: avatarUrl ?? undefined }))}
        />
        <AboutLithioModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
        <TutorialModal visible={tutorialVisible} role="pasajero" userId={user.id} onClose={() => setTutorialVisible(false)} />
      </GlassBlurScope>
    </SafeAreaView>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
    backgroundImage: theme.fx.aurora,
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
}));
