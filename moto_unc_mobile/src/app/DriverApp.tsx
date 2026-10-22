/**
 * DriverApp.tsx — App del conductor (sesión con rol fijo)
 *
 * Pestañas: Inicio · Historial · [Conectarse] · Agendados · Cuenta.
 * El botón central conecta o desconecta al conductor del directorio.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { apiService, AccountSummary } from '../services/api';
import type { AuthUser } from '../services/auth';
import { useRideCenter } from '../hooks/useRideCenter';
import { BottomTabBar } from '../components/nav/BottomTabBar';
import { NoticeBanner } from '../components/ui/NoticeBanner';
import { AboutLithioModal } from '../components/AboutLithioModal';
import { DriverHome } from '../screens/driver/DriverHome';
import { RidesListScreen } from '../screens/shared/RidesListScreen';
import { AccountScreen } from '../screens/shared/AccountScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import type { Ride, RideStatus } from '../types';

type Tab = 'home' | 'history' | 'scheduled' | 'account';

interface Props {
  user: AuthUser;
  onSignOut: () => void;
}

export const DriverApp: React.FC<Props> = ({ user, onSignOut }) => {
  const [tab, setTab] = useState<Tab>('home');
  const [profileOpen, setProfileOpen] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [busyRideId, setBusyRideId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const rides = useRideCenter(user.id, 'conductor');
  const isAvailable = Boolean(summary?.is_available);
  const points = summary?.points ?? user.points;

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await apiService.getSummary('conductor'));
    } catch {
      // Se reintenta al deslizar para actualizar.
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSummary(), rides.refresh()]);
    setRefreshing(false);
  }, [loadSummary, rides.refresh]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const rideStatus = rides.activeRide?.status;
  useEffect(() => {
    void loadSummary();
    setReloadKey((key) => key + 1);
  }, [rideStatus, loadSummary]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
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
  }, [profileOpen, tab]);

  const toggleAvailability = async () => {
    if (rides.activeRide) {
      Alert.alert('Tienes un viaje en curso', 'Termina el viaje para cambiar tu disponibilidad.');
      return;
    }
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
    const run = async () => {
      setBusyRideId(ride.id);
      try {
        await rides.updateStatus(ride, status);
        if (status === 'aceptado') setTab('home');
      } catch (error) {
        Alert.alert('No se pudo actualizar el viaje', error instanceof Error ? error.message : 'Intenta de nuevo.');
        void rides.refresh();
      } finally {
        setBusyRideId(null);
      }
    };
    if (status === 'cancelado') {
      Alert.alert('Cancelar viaje', '¿Seguro que quieres cancelar este viaje? El pasajero será notificado.', [
        { text: 'No', style: 'cancel' },
        { text: 'Sí, cancelar', style: 'destructive', onPress: () => void run() },
      ]);
      return;
    }
    await run();
  };

  const online = isAvailable && !rides.activeRide;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        {profileOpen ? (
          <ProfileScreen user={user} role="conductor" onBack={() => setProfileOpen(false)} />
        ) : tab === 'home' ? (
          <DriverHome
            user={user}
            points={points}
            summary={summary}
            isAvailable={isAvailable}
            togglingAvailability={toggling}
            connected={rides.connected}
            activeRide={rides.activeRide}
            requests={rides.requests}
            busyRideId={busyRideId}
            refreshing={refreshing}
            onRefresh={refreshAll}
            onToggleAvailability={toggleAvailability}
            onRespond={respond}
            onDismissCompleted={() => {
              rides.setActiveRide(null);
              void loadSummary();
            }}
            onOpenAccount={() => setTab('account')}
          />
        ) : tab === 'history' || tab === 'scheduled' ? (
          <RidesListScreen scope={tab} role="conductor" reloadKey={reloadKey} />
        ) : (
          <AccountScreen
            user={user}
            role="conductor"
            points={points}
            summary={summary}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenHistory={() => setTab('history')}
            onOpenScheduled={() => setTab('scheduled')}
            onOpenAbout={() => setAboutVisible(true)}
            onSignOut={onSignOut}
          />
        )}
      </View>

      {!profileOpen ? (
        <BottomTabBar<Tab>
          tabs={[
            { key: 'home', label: 'Inicio', icon: 'home-variant-outline', badge: rides.requests.length },
            { key: 'history', label: 'Historial', icon: 'history' },
            { key: 'scheduled', label: 'Agendados', icon: 'calendar-month-outline', badge: summary?.scheduled_count },
            { key: 'account', label: 'Cuenta', icon: 'account-outline' },
          ]}
          active={tab}
          onChange={setTab}
          center={{
            icon: 'power',
            label: online ? 'Desconectarme' : 'Conectarme',
            color: online ? theme.colors.success : theme.colors.secondary,
            onPress: () => void toggleAvailability(),
            live: online,
          }}
        />
      ) : null}

      <NoticeBanner notice={rides.notice} onClose={rides.clearNotice} onPress={() => setTab('home')} />
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
});
