import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  StatusBar, 
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { theme } from './src/constants/theme';
import { 
  Driver, 
  Ride, 
  RideStatus, 
  UserRole, 
  PaymentMethod, 
  PresetRoute, 
  Reward, 
  ReviewSubmission 
} from './src/types';
import { apiService } from './src/services/api';
import { wsService } from './src/services/websocket';
import { AuthUser } from './src/services/auth';
import { Header } from './src/components/Header';
import { RoutePicker } from './src/components/RoutePicker';
import { DriverCard } from './src/components/DriverCard';
import { RequestRideModal } from './src/components/RequestRideModal';
import { ActiveRideCard } from './src/components/ActiveRideCard';
import { ReviewModal } from './src/components/ReviewModal';
import { RewardsStoreModal } from './src/components/RewardsStoreModal';
import { AboutLithioModal } from './src/components/AboutLithioModal';
import { DriverDashboard } from './src/components/DriverDashboard';
import { AuthScreen } from './src/screens/AuthScreen';
import { PassengerSignIn } from './src/screens/PassengerSignIn';
import { PassengerSignUp } from './src/screens/PassengerSignUp';
import { DriverSignIn } from './src/screens/DriverSignIn';
import { DriverSignUp } from './src/screens/DriverSignUp';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';

type AuthStep = 'welcome' | 'passenger-signin' | 'passenger-signup' | 'driver-signin' | 'driver-signup' | 'app';
type AppScreen = 'home' | 'schedule' | 'routes' | 'profile';

// ============================================================================
// COMPONENTE PRINCIPAL DE LA APP (requiere usuario autenticado)
// Separado para cumplir las reglas de hooks de React
// ============================================================================
interface MainAppProps {
  currentUser: AuthUser;
}

function MainApp({ currentUser }: MainAppProps) {
  const [screen, setScreen] = useState<AppScreen>('home');
  // Estado de Usuario y Rol
  const [currentRole, setCurrentRole] = useState<UserRole>(
    currentUser.role === 'conductor' ? 'conductor' : 'pasajero'
  );
  const [userPoints, setUserPoints] = useState<number>(currentUser.points);
  const [xpLevel, setXpLevel] = useState<string>(currentUser.xp_level);
  const [isDriverAvailable, setIsDriverAvailable] = useState<boolean>(true);

  // Datos de Rutas y Conductores
  const [presetRoutes, setPresetRoutes] = useState<PresetRoute[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Selección de Ruta
  const [selectedOrigin, setSelectedOrigin] = useState<string>('Rectorado / Campus UNC');
  const [selectedDestination, setSelectedDestination] = useState<string>('Redoma de San Antonio de los Altos');
  const [selectedFare, setSelectedFare] = useState<number>(2.50);
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');

  // Viaje Activo
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  // Modales
  const [selectedDriverForRequest, setSelectedDriverForRequest] = useState<Driver | null>(null);
  const [isRequestModalVisible, setIsRequestModalVisible] = useState<boolean>(false);
  const [isReviewModalVisible, setIsReviewModalVisible] = useState<boolean>(false);
  const [isRewardsModalVisible, setIsRewardsModalVisible] = useState<boolean>(false);
  const [isAboutVisible, setIsAboutVisible] = useState<boolean>(false);
  const [rewards, setRewards] = useState<Reward[]>([]);

  // Carga inicial + suscripción WebSocket
  useEffect(() => {
    loadData();

    // Suscribirse a notificaciones WebSocket en tiempo real
    const unsub = wsService.subscribe((msg) => {
      if (msg.type === 'NEW_RIDE_REQUEST') {
        Alert.alert(
          '🛵 ¡Nueva Solicitud!',
          `${msg.passenger_name} quiere ir de ${msg.origin} a ${msg.destination}.\nTarifa: $${msg.fare_amount} · Pago: ${msg.payment_method}`
        );
      } else if (msg.type === 'RIDE_STATUS_UPDATED') {
        Alert.alert(
          '📍 Estado del Viaje',
          `Tu viaje cambió a: ${msg.new_status}`
        );
      } else if (msg.type === 'DRIVER_AVAILABILITY_CHANGED') {
        setDrivers((prev) =>
          prev.map((d) =>
            d.user_id === msg.driver_id ? { ...d, is_available: msg.is_available } : d
          )
        );
      }
    });

    return () => {
      unsub();
    };
  }, []);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const routesData = await apiService.getPresetRoutes();
      const driversData = await apiService.getDrivers();
      const rewardsData = await apiService.getRewards();
      setPresetRoutes(routesData);
      setDrivers(driversData);
      setRewards(rewardsData);
    } catch (error) {
      Alert.alert(
        'No se pudieron cargar los datos',
        error instanceof Error ? error.message : 'Intenta de nuevo.'
      );
    } finally {
      setRefreshing(false);
    }
  };

  // Alternar entre Modo Pasajero y Modo Conductor
  const handleToggleRole = () => {
    const nextRole: UserRole = currentRole === 'pasajero' ? 'conductor' : 'pasajero';
    setCurrentRole(nextRole);
    Alert.alert(
      "Modo Cambiado",
      nextRole === 'conductor' 
        ? "Has entrado al Modo Conductor. Ahora recibirás aquí las solicitudes directas de los estudiantes."
        : "Has entrado al Modo Pasajero. Puedes elegir tu ruta y conductor preferido."
    );
  };

  // Cambiar disponibilidad del conductor
  const handleToggleAvailability = async (val: boolean) => {
    try {
      await apiService.toggleDriverAvailability(currentUser.id, val);
      setIsDriverAvailable(val);
      setDrivers(prev => prev.map(d => d.user_id === currentUser.id ? { ...d, is_available: val } : d));
    } catch (error) {
      Alert.alert('No se pudo actualizar la disponibilidad', error instanceof Error ? error.message : 'Intenta de nuevo.');
    }
  };

  // 1. Pasajero pulsa "Elegir a X como mi Moto Taxi"
  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriverForRequest(driver);
    setIsRequestModalVisible(true);
  };

  const openImmediateRide = () => {
    setIsScheduled(false);
    setScreen('routes');
  };

  const openScheduledRide = () => {
    setIsScheduled(true);
    setScreen('schedule');
  };

  const handleScheduleSelected = (date: string, time: string) => {
    setScheduledTime(`${date} ${time}`);
    setScreen('routes');
  };

  // 2. Pasajero confirma viaje y método de pago
  const handleConfirmRide = async (paymentMethod: PaymentMethod, reference?: string) => {
    if (!selectedDriverForRequest) return;

    let newRide: Ride;
    try {
      newRide = await apiService.requestRide(currentUser.id, {
        driver_id: selectedDriverForRequest.user_id,
        origin: selectedOrigin,
        destination: selectedDestination,
        is_scheduled: isScheduled,
        scheduled_time: isScheduled ? scheduledTime : undefined,
        payment_method: paymentMethod,
        payment_reference: reference,
        fare_amount: selectedFare,
      });
    } catch (error) {
      Alert.alert('No se pudo solicitar el viaje', error instanceof Error ? error.message : 'Intenta de nuevo.');
      return;
    }

    setActiveRide(newRide);
    setIsRequestModalVisible(false);

    Alert.alert(
      "¡Solicitud Enviada!",
      `Se ha notificado directamente a ${selectedDriverForRequest.name}. Puedes cambiar al 'Modo Conductor' arriba para ver cómo le llega la alerta.`
    );
  };

  // 3. Cambiar estado del viaje (Aceptar, En camino, Completar)
  const handleUpdateRideStatus = async (status: RideStatus) => {
    if (!activeRide) return;
    let result: { fe_awarded: number };
    try {
      result = await apiService.updateRideStatus(activeRide.id, status);
    } catch (error) {
      Alert.alert('No se pudo actualizar el viaje', error instanceof Error ? error.message : 'Intenta de nuevo.');
      return;
    }
    
    // El backend acredita los Fe cuando confirma el viaje completado.
    if (status === 'completado') {
      setUserPoints(prev => prev + result.fe_awarded);
      Alert.alert(
        "🎉 ¡Carrera Completada!",
        `Has ganado +${result.fe_awarded} Fe por completar este viaje. ¡Sigue acumulando para canjear recompensas!`
      );
    }

    if (status === 'rechazado' || status === 'cancelado') {
      setActiveRide(null);
      Alert.alert("Viaje Finalizado", "La solicitud fue cancelada o rechazada.");
      return;
    }

    setActiveRide({ ...activeRide, status });
  };

  // 4. Calificar viaje completado
  const handleSubmitReview = async (review: ReviewSubmission) => {
    let res: { points_earned: number };
    try {
      res = await apiService.submitReview(currentUser.id, review);
    } catch (error) {
      Alert.alert('No se pudo enviar la reseña', error instanceof Error ? error.message : 'Intenta de nuevo.');
      return;
    }
    setUserPoints(prev => prev + res.points_earned);
    setIsReviewModalVisible(false);
    setActiveRide(null);

    Alert.alert(
      "⭐ ¡Gracias por tu reseña!",
      `Has calificado con éxito y sumaste +${res.points_earned} Fe. ¡Tu opinión hace crecer la comunidad LITHIO!`
    );
  };

  // 5. Canjear recompensa en la tienda
  const handleRedeemReward = async (reward: Reward) => {
    const result = await apiService.redeemReward(currentUser.id, reward.id);
    setUserPoints(result.new_balance);
    return { discount_code: result.discount_code };
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bgDark} />

      {/* Encabezado con selector de rol y balance de puntos */}
      <Header
        currentRole={currentRole}
        onToggleRole={handleToggleRole}
        points={userPoints}
        xpLevel={xpLevel}
        onOpenRewards={() => setIsRewardsModalVisible(true)}
        onOpenAbout={() => setIsAboutVisible(true)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={theme.colors.primary} />
        }
      >
        {screen === 'home' && !activeRide && (
          <HomeScreen
            userName={currentUser.name}
            points={userPoints}
            onRequestRide={openImmediateRide}
            onScheduleRide={openScheduledRide}
            onRewards={() => setIsRewardsModalVisible(true)}
            onProfile={() => setScreen('profile')}
          />
        )}

        {screen === 'schedule' && !activeRide && (
          <ScheduleScreen onBack={() => setScreen('home')} onContinue={handleScheduleSelected} />
        )}

        {screen === 'profile' && !activeRide && (
          <View style={styles.profileScreen}>
            <Text style={styles.backLink} onPress={() => setScreen('home')}>‹ Volver</Text>
            <Text style={styles.screenTitle}>Mi perfil</Text>
            <View style={styles.profileCard}>
              <Text style={styles.profileAvatar}>J</Text>
              <Text style={styles.profileName}>{currentUser.name}</Text>
              <Text style={styles.profileDetail}>{currentUser.email}</Text>
              <Text style={styles.profileDetail}>{currentUser.phone}</Text>
              <View style={styles.vehicleBox}>
                <Text style={styles.vehicleLabel}>Mi moto</Text>
                <Text style={styles.vehicleName}>Bera SBR 2026</Text>
                <Text style={styles.vehicleColor}>Roja</Text>
              </View>
            </View>
          </View>
        )}

        {/* Si hay un viaje activo, se muestra fijado arriba */}
        {activeRide && (
          <ActiveRideCard
            ride={activeRide}
            role={currentRole}
            onUpdateStatus={handleUpdateRideStatus}
            onOpenReview={() => setIsReviewModalVisible(true)}
            onCancel={() => handleUpdateRideStatus('cancelado')}
          />
        )}

        {/* VISTA 1: MODO PASAJERO */}
        {screen === 'routes' && currentRole === 'pasajero' && (
          <View style={styles.passengerView}>
            {/* Selector de Rutas UNC, IVIC, San Antonio, Caracas */}
            <RoutePicker
              presetRoutes={presetRoutes}
              selectedOrigin={selectedOrigin}
              selectedDestination={selectedDestination}
              onSelectRoute={(orig, dest, fare) => {
                setSelectedOrigin(orig);
                setSelectedDestination(dest);
                setSelectedFare(fare);
              }}
              isScheduled={isScheduled}
              scheduledTime={scheduledTime}
              onToggleScheduled={setIsScheduled}
              onChangeScheduledTime={setScheduledTime}
            />

            {/* Listado Directo de Conductores */}
            <View style={styles.driversSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>🛵 2. Elige a tu Conductor de Confianza</Text>
                  <Text style={styles.sectionSubtitle}>
                    Selecciona a quién prefieres para tu carrera de hoy
                  </Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{drivers.length} conductores</Text>
                </View>
              </View>

              {drivers.map((driver) => (
                <DriverCard
                  key={driver.user_id}
                  driver={driver}
                  onSelectDriver={handleSelectDriver}
                />
              ))}
            </View>
          </View>
        )}

        {screen === 'routes' && currentRole === 'conductor' && (
          /* VISTA 2: MODO CONDUCTOR */
          <View style={styles.driverView}>
            <DriverDashboard
              isAvailable={isDriverAvailable}
              onToggleAvailability={handleToggleAvailability}
              activeRide={activeRide}
              onUpdateRideStatus={handleUpdateRideStatus}
            />
          </View>
        )}
      </ScrollView>

      {/* Modal para Confirmar Solicitud Directa */}
      <RequestRideModal
        visible={isRequestModalVisible}
        driver={selectedDriverForRequest}
        origin={selectedOrigin}
        destination={selectedDestination}
        fareAmount={selectedFare}
        isScheduled={isScheduled}
        scheduledTime={scheduledTime}
        userPoints={userPoints}
        onClose={() => setIsRequestModalVisible(false)}
        onConfirm={handleConfirmRide}
      />

      {/* Modal de Calificación y Recompensas */}
      {activeRide && (
        <ReviewModal
          visible={isReviewModalVisible}
          rideId={activeRide.id}
          driverName={activeRide.driver_name || 'Conductor'}
          onClose={() => setIsReviewModalVisible(false)}
          onSubmit={handleSubmitReview}
        />
      )}

      {/* Tienda de Canje de Puntos */}
      <RewardsStoreModal
        visible={isRewardsModalVisible}
        userPoints={userPoints}
        rewards={rewards}
        onClose={() => setIsRewardsModalVisible(false)}
        onRedeem={handleRedeemReward}
      />

      <AboutLithioModal visible={isAboutVisible} onClose={() => setIsAboutVisible(false)} />
    </SafeAreaView>
  );
}


// ============================================================================
// ENTRADA PRINCIPAL — Gestiona el flujo de autenticación
// ============================================================================
export default function App() {
  // Space Grotesk (textos) y Space Mono (datos): la app se ve igual sin
  // importar la fuente del sistema que tenga configurada el teléfono.
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  return (
    <SafeAreaProvider style={{ backgroundColor: theme.colors.bgDark }}>
      {/* Si las fuentes fallan se sigue con las del sistema en vez de bloquear la app. */}
      {fontsLoaded || fontError ? <AppContent /> : <View style={styles.fontLoading} />}
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [authStep, setAuthStep] = useState<AuthStep>('welcome');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAboutVisible, setIsAboutVisible] = useState(false);

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    // El servidor obtiene la identidad directamente del ID token Firebase.
    wsService.connect();
    setAuthStep('app');
  };

  if (authStep === 'welcome') {
    return (
      <>
        <AuthScreen
          onSelectPassenger={() => setAuthStep('passenger-signin')}
          onSelectDriver={() => setAuthStep('driver-signin')}
          onSelectSignIn={() => setAuthStep('passenger-signin')}
          onOpenAbout={() => setIsAboutVisible(true)}
        />
        <AboutLithioModal visible={isAboutVisible} onClose={() => setIsAboutVisible(false)} />
      </>
    );
  }

  if (authStep === 'driver-signin') {
    return (
      <DriverSignIn
        onSuccess={handleAuthSuccess}
        onGoToSignUp={() => setAuthStep('driver-signup')}
        onBack={() => setAuthStep('welcome')}
      />
    );
  }

  if (authStep === 'passenger-signin') {
    return (
      <PassengerSignIn
        onSuccess={handleAuthSuccess}
        onGoToSignUp={() => setAuthStep('passenger-signup')}
        onBack={() => setAuthStep('welcome')}
      />
    );
  }

  if (authStep === 'passenger-signup') {
    return (
      <PassengerSignUp
        onSuccess={handleAuthSuccess}
        onBack={() => setAuthStep('passenger-signin')}
      />
    );
  }

  if (authStep === 'driver-signup') {
    return (
      <DriverSignUp
        onSuccess={handleAuthSuccess}
        onBack={() => setAuthStep('welcome')}
      />
    );
  }

  // authStep === 'app' && currentUser !== null
  return <MainApp currentUser={currentUser!} />;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  fontLoading: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  passengerView: {
    flex: 1,
  },
  driverView: {
    flex: 1,
  },
  driversSection: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
  profileScreen: {
    padding: 20,
  },
  backLink: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    fontSize: 16,
    marginBottom: 24,
  },
  screenTitle: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    fontSize: 28,
    marginBottom: 18,
  },
  profileCard: {
    alignItems: 'center',
    padding: 22,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  profileAvatar: {
    fontFamily: theme.fonts.bold,
    width: 72,
    height: 72,
    borderRadius: 36,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: theme.colors.primary,
    color: '#082f49',
    fontSize: 32,
    marginBottom: 14,
  },
  profileName: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    fontSize: 18,
    textAlign: 'center',
  },
  profileDetail: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 6,
  },
  vehicleBox: {
    width: '100%',
    marginTop: 22,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.cardElevated,
  },
  vehicleLabel: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  vehicleName: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    fontSize: 17,
    marginTop: 4,
  },
  vehicleColor: {
    fontFamily: theme.fonts.bold,
    color: '#ef4444',
    fontSize: 14,
    marginTop: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  sectionSubtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: theme.colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  countText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    fontSize: 11,
  }
});
