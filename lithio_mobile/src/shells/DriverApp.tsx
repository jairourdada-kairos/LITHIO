/**
 * DriverApp.tsx — App del conductor (sesión con rol fijo)
 *
 * Mientras la postulación no esté aprobada se muestra "Tu postulación".
 * Aprobado: Inicio · Viajes · Billetera · Perfil, y las solicitudes nuevas
 * llegan como hoja inferior con 25 s para responder.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Alert, BackHandler, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, themed } from '../constants/theme';
import { apiService, AccountSummary } from '../services/api';
import { wsService } from '../services/websocket';
import type { AuthUser } from '../services/auth';
import { useRideCenter } from '../hooks/useRideCenter';
import { GlassBlurScope, GlassBlurTarget } from '../components/ui/GlassSurface';
import { BottomTabBar } from '../components/nav/BottomTabBar';
import { NoticeBanner } from '../components/ui/NoticeBanner';
import { useAdminAlerts } from '../hooks/useAdminAlerts';
import { AboutLithioModal } from '../components/AboutLithioModal';
import { TutorialModal, shouldShowTutorial } from '../components/TutorialModal';
import { RequestSheet } from '../components/driver/RequestSheet';
import { DriverHome } from '../screens/driver/DriverHome';
import { DriverApplicationScreen } from '../screens/driver/DriverApplicationScreen';
import { TripsScreen } from '../screens/shared/TripsScreen';
import { WalletScreen } from '../screens/shared/WalletScreen';
import { AccountScreen } from '../screens/shared/AccountScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { LevelScreen } from '../screens/shared/LevelScreen';
import { LevelsTableScreen } from '../screens/shared/LevelsTableScreen';
import { AdminScreen } from '../screens/admin/AdminScreen';
import { AvatarSheet } from '../components/AvatarSheet';
import { FALLBACK_LEVEL } from '../utils/elements';
import { LinksScreen } from '../screens/shared/LinksScreen';
import { DriverReviewsScreen } from '../screens/driver/DriverReviewsScreen';
import type { Ride, RideStatus } from '../types';

type Tab = 'home' | 'trips' | 'wallet' | 'profile';

interface Props {
  user: AuthUser;
  onSignOut: () => void;
}

export const DriverApp: React.FC<Props> = ({ user: initialUser, onSignOut }) => {
  // Copia local para reflejar al instante cambios como la foto de perfil.
  const [user, setUser] = useState(initialUser);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await apiService.getSummary('conductor'));
    } catch {
      // Se reintenta al deslizar para actualizar.
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    shouldShowTutorial(user.id, 'conductor').then(setTutorialVisible);
  }, [loadSummary, user.id]);

  const modals = (
    <>
      <AboutLithioModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
      <TutorialModal visible={tutorialVisible} role="conductor" userId={user.id} onClose={() => setTutorialVisible(false)} />
    </>
  );

  if (!summary) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.secondary} />
      </View>
    );
  }

  if (summary.verification_status !== 'aprobado') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <DriverApplicationScreen
          user={user}
          onApproved={() => void loadSummary()}
          onOpenTutorial={() => setTutorialVisible(true)}
          onSignOut={onSignOut}
        />
        {modals}
      </SafeAreaView>
    );
  }

  return (
    <ApprovedDriverApp
      user={user}
      onAvatarChanged={(avatarUrl) => setUser((prev) => ({ ...prev, avatar_url: avatarUrl ?? undefined }))}
      onUserChanged={(changes) => setUser((prev) => ({ ...prev, ...changes }))}
      summary={summary}
      setSummary={setSummary}
      reloadSummary={loadSummary}
      onOpenAbout={() => setAboutVisible(true)}
      onOpenTutorial={() => setTutorialVisible(true)}
      onSignOut={onSignOut}
    >
      {modals}
    </ApprovedDriverApp>
  );
};

interface ApprovedProps {
  user: AuthUser;
  onAvatarChanged: (avatarUrl: string | null) => void;
  onUserChanged: (changes: Partial<AuthUser>) => void;
  summary: AccountSummary;
  setSummary: React.Dispatch<React.SetStateAction<AccountSummary | null>>;
  reloadSummary: () => Promise<void>;
  onOpenAbout: () => void;
  onOpenTutorial: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

const ApprovedDriverApp: React.FC<ApprovedProps> = ({
  user,
  onAvatarChanged,
  onUserChanged,
  summary,
  setSummary,
  reloadSummary,
  onOpenAbout,
  onOpenTutorial,
  onSignOut,
  children,
}) => {
  const [tab, setTab] = useState<Tab>('home');
  const [profileOpen, setProfileOpen] = useState(false);
  const [overlay, setOverlay] = useState<'level' | 'levels' | 'admin' | 'links' | 'reviews' | null>(null);
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetRide, setSheetRide] = useState<Ride | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const seenRequests = useRef<Set<number>>(new Set());

  const rides = useRideCenter(user.id, 'conductor');
  const isAvailable = Boolean(summary.is_available);
  const adminAlerts = useAdminAlerts(Boolean(summary.is_admin));

  // Cada solicitud nueva sube la hoja una sola vez; después queda en la bandeja.
  useEffect(() => {
    const fresh = rides.requests.find((ride) => !seenRequests.current.has(ride.id));
    rides.requests.forEach((ride) => seenRequests.current.add(ride.id));
    if (fresh && !rides.activeRide) {
      setSheetRide(fresh);
      setTab('home');
    }
    if (sheetRide && !rides.requests.some((ride) => ride.id === sheetRide.id)) setSheetRide(null);
  }, [rides.requests, rides.activeRide, sheetRide]);

  const rideStatus = rides.activeRide?.status;
  useEffect(() => {
    void reloadSummary();
    setReloadKey((key) => key + 1);
  }, [rideStatus, reloadSummary]);

  useEffect(
    () =>
      wsService.subscribe((msg) => {
        if (msg.type === 'WALLET_UPDATED') {
          void reloadSummary();
          setReloadKey((key) => key + 1);
        }
      }),
    [reloadSummary]
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (overlay) {
        setOverlay(overlay === 'levels' ? 'level' : null);
        return true;
      }
      if (profileOpen) {
        setProfileOpen(false);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [profileOpen, tab, overlay]);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([reloadSummary(), rides.refresh()]);
    setRefreshing(false);
  };

  const toggleAvailability = async () => {
    setToggling(true);
    try {
      await apiService.toggleDriverAvailability(user.id, !isAvailable);
      setSummary((prev) => (prev ? { ...prev, is_available: !isAvailable } : prev));
    } catch (error) {
      Alert.alert('No se pudo cambiar tu estado', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setToggling(false);
    }
  };

  const respond = async (ride: Ride, status: RideStatus) => {
    setBusy(true);
    try {
      await rides.updateStatus(ride, status);
      setSheetRide(null);
    } catch (error) {
      Alert.alert('No se pudo actualizar el viaje', error instanceof Error ? error.message : 'Intenta de nuevo.');
      void rides.refresh();
    } finally {
      setBusy(false);
    }
  };

  const updateActiveRide = (status: RideStatus) => {
    const ride = rides.activeRide;
    if (!ride) return;
    if (status === 'cancelado') {
      Alert.alert('Cancelar viaje', '¿Seguro que quieres cancelar este viaje? El pasajero será notificado.', [
        { text: 'No', style: 'cancel' },
        { text: 'Sí, cancelar', style: 'destructive', onPress: () => void respond(ride, status) },
      ]);
      return;
    }
    void respond(ride, status);
  };


  const renderTab = () => {
    if (overlay === 'level') {
      return (
        <LevelScreen
          level={summary.level ?? FALLBACK_LEVEL}
          accent={theme.colors.secondary}
          onBack={() => setOverlay(null)}
          onOpenTable={() => setOverlay('levels')}
        />
      );
    }
    if (overlay === 'levels') return <LevelsTableScreen accent={theme.colors.secondary} onBack={() => setOverlay('level')} />;
    if (overlay === 'admin') return <AdminScreen onBack={() => setOverlay(null)} />;
    if (overlay === 'links') return <LinksScreen accent={theme.colors.secondary} onBack={() => setOverlay(null)} />;
    if (overlay === 'reviews') return <DriverReviewsScreen accent={theme.colors.secondary} onBack={() => setOverlay(null)} />;
    if (profileOpen) {
      return (
        <ProfileScreen
          user={user}
          role="conductor"
          onBack={() => setProfileOpen(false)}
          onUserChanged={onUserChanged}
          onAccountDeleted={onSignOut}
        />
      );
    }
    switch (tab) {
      case 'trips':
        return <TripsScreen role="conductor" reloadKey={reloadKey} accent={theme.colors.secondary} />;
      case 'wallet':
        return <WalletScreen role="conductor" reloadKey={reloadKey} />;
      case 'profile':
        return (
          <AccountScreen
            user={user}
            role="conductor"
            summary={summary}
            onOpenProfile={() => setProfileOpen(true)}
            onEditPhoto={() => setAvatarSheetVisible(true)}
            onOpenLevel={() => setOverlay('level')}
            onOpenAdmin={summary.is_admin ? () => setOverlay('admin') : undefined}
            onOpenLinks={() => setOverlay('links')}
            onOpenReviews={() => setOverlay('reviews')}
            onOpenTutorial={onOpenTutorial}
            onOpenAbout={onOpenAbout}
            onSignOut={onSignOut}
          />
        );
      default:
        return (
          <DriverHome
            user={user}
            summary={summary}
            isAvailable={isAvailable}
            togglingAvailability={toggling}
            connected={rides.connected}
            activeRide={rides.activeRide}
            requests={rides.requests}
            refreshing={refreshing}
            onRefresh={refreshAll}
            onToggleAvailability={toggleAvailability}
            onOpenRequest={setSheetRide}
            onUpdateActiveRide={updateActiveRide}
            onDismissCompleted={() => {
              rides.setActiveRide(null);
              void reloadSummary();
            }}
            onOpenWallet={() => setTab('wallet')}
            onOpenProfile={() => setTab('profile')}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <GlassBlurScope>
        <GlassBlurTarget style={styles.content}>{renderTab()}</GlassBlurTarget>

        {!profileOpen && !overlay ? (
          <BottomTabBar<Tab>
            tabs={[
              { key: 'home', label: 'Inicio', icon: 'home-outline', badge: rides.requests.length },
              { key: 'trips', label: 'Viajes', icon: 'navigation-2-outline', badge: summary.scheduled_count },
              { key: 'wallet', label: 'Billetera', icon: 'credit-card-outline' },
              { key: 'profile', label: 'Perfil', icon: 'person-outline' },
            ]}
            active={tab}
            onChange={setTab}
            accent={theme.colors.secondary}
          />
        ) : null}

        <NoticeBanner notice={rides.notice} onClose={rides.clearNotice} onPress={() => setTab('home')} />
        {/* Solicitudes para el administrador; espera a que se cierre el aviso del viaje. */}
        <NoticeBanner
          notice={rides.notice ? null : adminAlerts.notice}
          onClose={adminAlerts.clear}
          onPress={() => {
            adminAlerts.clear();
            setOverlay('admin');
          }}
        />
        <RequestSheet
          ride={sheetRide}
          busy={busy}
          onAccept={(ride) => void respond(ride, 'aceptado')}
          onReject={(ride) => void respond(ride, 'rechazado')}
          onDismiss={() => setSheetRide(null)}
        />
        <AvatarSheet
          visible={avatarSheetVisible}
          hasPhoto={Boolean(user.avatar_url)}
          accent={theme.colors.secondary}
          onClose={() => setAvatarSheetVisible(false)}
          onChanged={onAvatarChanged}
        />
        {children}
      </GlassBlurScope>
    </SafeAreaView>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgDark,
  },
}));
