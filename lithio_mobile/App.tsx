import { FeedbackHost, installAlertBridge } from './src/components/ui/Feedback';
import { useCallback, useEffect, useState } from 'react';
import { View, Alert, StatusBar, AppState, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { ColorScheme, theme, themed } from './src/constants/theme';
import { ThemeModeProvider } from './src/theme/ThemeMode';
import { AuthUser, loadOwnProfile } from './src/services/auth';
import { isEmailVerificationPending, onEmailVerificationRequired } from './src/services/emailGate';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { claimDeviceSession, restoreSession, roleAccessError, saveSessionRole, SessionRole, signOut } from './src/services/session';
import { onSessionReplaced } from './src/services/deviceSession';
import { initApiBase } from './src/config/api';
import { dismissPushOffer, registerForPush, shouldOfferPush, syncPushIfGranted, unregisterPush } from './src/services/notifications';
import { NotificationPrimer } from './src/components/NotificationPrimer';
import { checkAppVersion } from './src/services/appVersion';
import { applyUpdateOnStartup, downloadUpdateInBackground, restartWithUpdate } from './src/services/liveUpdates';
import { UpdateRequiredScreen } from './src/screens/UpdateRequiredScreen';
import { AboutLithioModal } from './src/components/AboutLithioModal';
import { LithiumAtom } from './src/components/brand/LithiumAtom';
import { EVA_FONT } from './src/components/ui/Icon';
import { AuthScreen } from './src/screens/AuthScreen';
import { PassengerSignIn } from './src/screens/PassengerSignIn';
import { PassengerSignUp } from './src/screens/PassengerSignUp';
import { DriverSignIn } from './src/screens/DriverSignIn';
import { DriverSignUp } from './src/screens/DriverSignUp';
import { PassengerApp } from './src/shells/PassengerApp';
import { DriverApp } from './src/shells/DriverApp';
import { SocialPrefill } from './src/services/socialAuth';

// Ningún mensaje usa alertas nativas: Alert.alert abre el diálogo de LITHIO.
installAlertBridge();

type AuthStep = 'restoring' | 'welcome' | 'passenger-signin' | 'passenger-signup' | 'driver-signin' | 'driver-signup';

interface Session {
  user: AuthUser;
  role: SessionRole;
}

// ============================================================================
// ENTRADA PRINCIPAL — Fuentes de marca y márgenes seguros
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
    ...EVA_FONT, // Eva Icons: se precarga para que los íconos no parpadeen.
  });

  return (
    <SafeAreaProvider>
      {/* Si las fuentes fallan se sigue con las del sistema en vez de bloquear la app. */}
      {fontsLoaded || fontError ? (
        <ThemeModeProvider>{(scheme) => <AppContent scheme={scheme} />}</ThemeModeProvider>
      ) : (
        <View style={styles.blank} />
      )}
    </SafeAreaProvider>
  );
}

// ============================================================================
// FLUJO DE SESIÓN — El rol se elige al entrar y queda fijo hasta cerrar sesión
// ============================================================================
function AppContent({ scheme }: { scheme: ColorScheme }) {
  const [authStep, setAuthStep] = useState<AuthStep>('restoring');
  const [session, setSession] = useState<Session | null>(null);
  // Entró con Google/Facebook por primera vez: el registro no pide contraseña.
  const [socialPrefill, setSocialPrefill] = useState<SocialPrefill | null>(null);
  const [isAboutVisible, setIsAboutVisible] = useState(false);
  const [primerVisible, setPrimerVisible] = useState(false);
  const [requiredUpdate, setRequiredUpdate] = useState<string | null | undefined>(undefined);
  // La cuenta aún no verificó su Gmail: se muestra "Verifica tu correo".
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [pendingRole, setPendingRole] = useState<SessionRole | null>(null);

  // Con permiso ya dado se registra en silencio; si nunca se preguntó, se invita con la pantalla de LITHIO.
  const setUpPush = useCallback(async () => {
    await syncPushIfGranted();
    if (await shouldOfferPush()) setPrimerVisible(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Si hay una actualización publicada, se aplica antes de mostrar nada.
    // Luego, en el APK, se averigua la dirección vigente del servidor.
    applyUpdateOnStartup()
      .then(initApiBase)
      .then(async () => {
        // Cambios nativos: el servidor puede exigir (o sugerir) un APK más nuevo.
        const version = await checkAppVersion();
        if (version?.required) setRequiredUpdate(version.downloadUrl);
        else if (version?.suggested && version.downloadUrl) {
          const url = version.downloadUrl;
          Alert.alert('Hay una versión nueva de LITHIO', 'Trae mejoras para tu teléfono. Instálala encima de esta; tus datos se mantienen.', [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Descargar', onPress: () => void Linking.openURL(url) },
          ]);
        }
      })
      .then(restoreSession)
      .then((restored) => {
        if (cancelled) return;
        if (restored) {
          setSession(restored);
          void setUpPush();
        }
        setAuthStep('welcome');
      });
    // Al volver a la app, la dirección pudo cambiar (se reinició el modo público).
    // También puede haber una actualización nueva: se descarga y se ofrece reiniciar.
    let offeredRestart = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void initApiBase();
      if (offeredRestart) return;
      void downloadUpdateInBackground().then((ready) => {
        if (!ready || cancelled) return;
        offeredRestart = true;
        Alert.alert('LITHIO se actualizó', 'Reinicia la app para ver las mejoras. Tu sesión se mantiene.', [
          { text: 'Después', style: 'cancel' },
          { text: 'Reiniciar ahora', onPress: restartWithUpdate },
        ]);
      });
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => onEmailVerificationRequired(() => setVerifyingEmail(true)), []);

  const startSession = (role: SessionRole) => async (user: AuthUser) => {
    const denied = roleAccessError(user, role);
    if (denied) {
      await signOut();
      Alert.alert('No puedes entrar con este rol', denied);
      return;
    }
    setSocialPrefill(null);
    try {
      await claimDeviceSession();
    } catch (error) {
      // Sin verificar: la sesión de Firebase se conserva para comprobarlo después.
      if (isEmailVerificationPending(error)) {
        setPendingRole(role);
        setVerifyingEmail(true);
        return;
      }
      await signOut();
      Alert.alert('No se pudo iniciar sesión', error instanceof Error ? error.message : 'Intenta de nuevo.');
      return;
    }
    await saveSessionRole(role);
    setSession({ user, role });
    void setUpPush();
  };

  // Política de sesión única: si la cuenta se abre en otro dispositivo, este sale.
  useEffect(
    () =>
      onSessionReplaced(() => {
        void signOut();
        setSession(null);
        setAuthStep('welcome');
        Alert.alert(
          'Tu cuenta se abrió en otro dispositivo',
          'Por seguridad, LITHIO solo permite una sesión a la vez. Si fuiste tú, sigue en el otro dispositivo; si no, entra aquí y cambia tu contraseña.'
        );
      }),
    []
  );

  const endSession = useCallback(async () => {
    await unregisterPush();
    await signOut();
    setSession(null);
    setAuthStep('welcome');
  }, []);

  // Correo verificado: entra con el rol que estaba eligiendo (o el guardado).
  const finishEmailVerification = async () => {
    setVerifyingEmail(false);
    try {
      const restored = await restoreSession();
      if (restored) {
        setSession(restored);
        void setUpPush();
        return;
      }
      const user = await loadOwnProfile();
      if (!user) {
        setAuthStep('welcome');
        return;
      }
      const role: SessionRole = pendingRole ?? (authStep.startsWith('driver') ? 'conductor' : 'pasajero');
      await startSession(role)(user);
    } catch (error) {
      if (!isEmailVerificationPending(error)) {
        Alert.alert('No se pudo iniciar sesión', error instanceof Error ? error.message : 'Intenta de nuevo.');
      }
    }
  };

  const renderScreen = () => {
    if (requiredUpdate !== undefined) return <UpdateRequiredScreen downloadUrl={requiredUpdate} />;
    if (verifyingEmail && !session) {
      const driver = pendingRole === 'conductor' || (!pendingRole && authStep.startsWith('driver'));
      return (
        <VerifyEmailScreen
          accent={driver ? theme.colors.secondary : theme.colors.primary}
          onVerified={() => void finishEmailVerification()}
          onUseOtherAccount={() => {
            setVerifyingEmail(false);
            setPendingRole(null);
            void signOut();
            setAuthStep('welcome');
          }}
        />
      );
    }
    if (session) {
      return session.role === 'conductor' ? (
        <DriverApp key={`d-${session.user.id}`} user={session.user} onSignOut={endSession} />
      ) : (
        <PassengerApp key={`p-${session.user.id}`} user={session.user} onSignOut={endSession} />
      );
    }

    // Si se arrepiente de completar el perfil social, se cierra esa sesión de Firebase.
    const leaveSignUp = (step: AuthStep) => () => {
      if (socialPrefill) {
        setSocialPrefill(null);
        void signOut();
      }
      setAuthStep(step);
    };

    if (authStep === 'restoring') {
      return (
        <View style={styles.restoring}>
          <LithiumAtom size={120} />
        </View>
      );
    }

    if (authStep === 'driver-signin') {
      return (
        <DriverSignIn
          onSuccess={startSession('conductor')}
          onGoToSignUp={() => setAuthStep('driver-signup')}
          onSocialSignUp={(prefill) => {
            setSocialPrefill(prefill);
            setAuthStep('driver-signup');
          }}
          onSwitchRole={() => setAuthStep('passenger-signin')}
          onBack={() => setAuthStep('welcome')}
        />
      );
    }

    if (authStep === 'passenger-signin') {
      return (
        <PassengerSignIn
          onSuccess={startSession('pasajero')}
          onGoToSignUp={() => setAuthStep('passenger-signup')}
          onSocialSignUp={(prefill) => {
            setSocialPrefill(prefill);
            setAuthStep('passenger-signup');
          }}
          onSwitchRole={() => setAuthStep('driver-signin')}
          onBack={() => setAuthStep('welcome')}
        />
      );
    }

    if (authStep === 'passenger-signup') {
      return <PassengerSignUp social={socialPrefill} onSuccess={startSession('pasajero')} onBack={leaveSignUp('passenger-signin')} />;
    }

    if (authStep === 'driver-signup') {
      return <DriverSignUp social={socialPrefill} onSuccess={startSession('conductor')} onBack={leaveSignUp('driver-signin')} />;
    }

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
  };

  return (
    // Al cambiar de tema se vuelve a montar la interfaz (no la sesión) con la paleta nueva.
    <View key={scheme} style={[styles.blank, { backgroundColor: theme.colors.bgDark }]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      {renderScreen()}
      {session ? (
        <NotificationPrimer
          visible={primerVisible}
          role={session.role}
          onActivate={async () => {
            await registerForPush();
            setPrimerVisible(false);
          }}
          onLater={() => {
            void dismissPushOffer();
            setPrimerVisible(false);
          }}
        />
      ) : null}
      <FeedbackHost />
    </View>
  );
}

const styles = themed(() => ({
  blank: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  restoring: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgDark,
  },
}));
