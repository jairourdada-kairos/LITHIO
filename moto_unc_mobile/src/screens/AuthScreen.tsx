/**
 * AuthScreen.tsx — Pantalla de Bienvenida
 *
 * Primera pantalla que ve el usuario. Permite elegir entre
 * Pasajero o Conductor, con animaciones y estética premium.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { theme } from '../constants/theme';

const { width, height } = Dimensions.get('window');

interface Props {
  onSelectPassenger: () => void;
  onSelectDriver: () => void;
  onSelectSignIn: () => void;
}

export const AuthScreen: React.FC<Props> = ({ onSelectPassenger, onSelectDriver, onSelectSignIn }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bgDark} />

      {/* Círculos decorativos de fondo */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo / Icono */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>🏍️</Text>
          <Text style={styles.appName}>LITHIO</Text>
          <Text style={styles.appSubtitle}>
            Tu movilidad universitaria, rápida y segura
          </Text>
        </View>

        {/* Insignia de comunidad */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🎓 Comunidad UNC · Altos Mirandinos</Text>
        </View>

        {/* Separador */}
        <View style={styles.divider} />

        <Text style={styles.chooseLabel}>¿Cómo deseas continuar?</Text>

        {/* Botón Pasajero */}
        <TouchableOpacity
          style={[styles.roleCard, styles.roleCardPassenger]}
          onPress={onSelectPassenger}
          activeOpacity={0.85}
        >
          <Text style={styles.roleIcon}>🎒</Text>
          <View style={styles.roleTextGroup}>
            <Text style={styles.roleTitle}>Soy Pasajero</Text>
            <Text style={styles.roleDesc}>Transporte inteligente, conectado contigo</Text>
          </View>
          <Text style={styles.roleArrow}>→</Text>
        </TouchableOpacity>

        {/* Botón Conductor */}
        <TouchableOpacity
          style={[styles.roleCard, styles.roleCardDriver]}
          onPress={onSelectDriver}
          activeOpacity={0.85}
        >
          <Text style={styles.roleIcon}>🛵</Text>
          <View style={styles.roleTextGroup}>
            <Text style={styles.roleTitle}>Soy Conductor</Text>
            <Text style={styles.roleDesc}>Gestiona tus viajes y ganancias</Text>
          </View>
          <Text style={styles.roleArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signInButton} onPress={onSelectSignIn} activeOpacity={0.85}>
          <Text style={styles.signInText}>Ya tengo una cuenta · Iniciar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Al registrarte aceptas los Términos de Servicio de la comunidad UNC
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // Fondos decorativos
  bgCircle1: {
    position: 'absolute',
    top: -height * 0.15,
    left: -width * 0.25,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: theme.colors.primary,
    opacity: 0.07,
  },
  bgCircle2: {
    position: 'absolute',
    bottom: -height * 0.1,
    right: -width * 0.2,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: theme.colors.secondary,
    opacity: 0.07,
  },
  content: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  badge: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 24,
  },
  badgeText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    width: '40%',
    height: 1,
    backgroundColor: theme.colors.cardBorder,
    marginBottom: 20,
  },
  chooseLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  roleCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
  },
  roleCardPassenger: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: theme.colors.primary,
  },
  roleCardDriver: {
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderColor: theme.colors.secondary,
  },
  roleIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  roleTextGroup: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  roleDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  roleArrow: {
    fontSize: 20,
    color: theme.colors.textMuted,
  },
  footerNote: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  signInButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 2,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  signInText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
