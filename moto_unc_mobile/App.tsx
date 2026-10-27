import { FeedbackHost, installAlertBridge } from './src/components/ui/Feedback';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Alert, StatusBar, AppState } from 'react-native';
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
import { AuthUser } from './src/services/auth';
import { claimDeviceSession, restoreSession, roleAccessError, saveSessionRole, SessionRole, signOut } from './src/services/session';
import { onSessionReplaced } from './src/services/deviceSession';
import { initApiBase } from './src/config/api';
import { registerForPush, unregisterPush } from './src/services/notifications';
import { AboutLithioModal } from './src/components/AboutLithioModal';
import { LithiumAtom } from './src/components/brand/LithiumAtom';
import { AuthScreen } from './src/screens/AuthScreen';
import { PassengerSignIn } from './src/screens/PassengerSignIn';
import { PassengerSignUp } from './src/screens/PassengerSignUp';
import { DriverSignIn } from './src/screens/DriverSignIn';
import { DriverSignUp } from './src/screens/DriverSignUp';
import { PassengerApp } from './src/shells/PassengerApp';
import { DriverApp } from './src/shells/DriverApp';

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
  const [isAboutVisible, setIsAboutVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // En el APK, primero se averigua la dirección vigente del servidor.
    initApiBase()
      .then(restoreSession)
      .then((restored) => {
        if (cancelled) return;
        if (restored) {
          setSession(restored);
          void registerForPush();
        }
        setAuthStep('welcome');
      });
    // Al volver a la app, la dirección pudo cambiar (se reinició el modo público).
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void initApiBase();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const startSession = (role: SessionRole) => async (user: AuthUser) => {
    const denied = roleAccessError(user, role);
    if (denied) {
      await signOut();
      Alert.alert('No puedes entrar con este rol', denied);
      return;
    }
    try {
      await claimDeviceSession();
    } catch (error) {
      await signOut();
      Alert.alert('No se pudo iniciar sesión', error instanceof Error ? error.message : 'Intenta de nuevo.');
      return;
    }
    await saveSessionRole(role);
    setSession({ user, role });
    void registerForPush();
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

  const renderScreen = () => {
    if (session) {
      return session.role === 'conductor' ? (
        <DriverApp key={`d-${session.user.id}`} user={session.user} onSignOut={endSession} />
      ) : (
        <PassengerApp key={`p-${session.user.id}`} user={session.user} onSignOut={endSession} />
      );
    }

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
          onSwitchRole={() => setAuthStep('driver-signin')}
          onBack={() => setAuthStep('welcome')}
        />
      );
    }

    if (authStep === 'passenger-signup') {
      return <PassengerSignUp onSuccess={startSession('pasajero')} onBack={() => setAuthStep('passenger-signin')} />;
    }

    if (authStep === 'driver-signup') {
      return <DriverSignUp onSuccess={startSession('conductor')} onBack={() => setAuthStep('driver-signin')} />;
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
