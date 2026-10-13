/**
 * PassengerSignIn.tsx — Inicio de Sesión / Registro de Pasajero
 *
 * Muestra opciones de auth social (Google, Facebook) y email.
 * Navega a PassengerSignUp si el usuario no tiene cuenta.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { theme } from '../constants/theme';
import { signInWithEmail } from '../services/auth';
import { AuthUser } from '../services/auth';

interface Props {
  onSuccess: (user: AuthUser) => void;
  onGoToSignUp: () => void;
  onBack: () => void;
}

export const PassengerSignIn: React.FC<Props> = ({ onSuccess, onGoToSignUp, onBack }) => {
  const [email, setEmail] = useState('jairourdada@gmail.com');
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !email.includes('@')) {
      shake();
      Alert.alert('Correo inválido', 'Por favor ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);
    try {
      const user = await signInWithEmail(email.trim().toLowerCase());
      if (user) {
        onSuccess(user);
      } else {
        Alert.alert(
          'Cuenta no encontrada',
          'No existe una cuenta con ese correo. ¿Deseas crear una nueva?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Registrarme', onPress: onGoToSignUp },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar con el servidor. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    Alert.alert(
      `${provider} Sign-In`,
      `Para habilitar ${provider}, configura Firebase Auth y expo-auth-session con tu App ID.\n\nPor ahora usa tu correo electrónico.`,
      [{ text: 'Entendido' }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.emoji}>🎒</Text>
          <Text style={styles.title}>Iniciar sesión</Text>
          <Text style={styles.subtitle}>con tu cuenta LITHIO</Text>
        </View>

        {/* Opciones sociales: requieren configurar Firebase antes de habilitarlas */}
        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => handleSocialLogin('Google')}
            activeOpacity={0.8}
          >
            <Text style={styles.socialIcon}>🇬</Text>
            <Text style={styles.socialLabel}>Google · próximamente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => handleSocialLogin('Facebook')}
            activeOpacity={0.8}
          >
            <Text style={styles.socialIcon}>f</Text>
            <Text style={styles.socialLabel}>Facebook · próximamente</Text>
          </TouchableOpacity>
        </View>

        {/* Divisor */}
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>o continúa con email</Text>
          <View style={styles.orLine} />
        </View>

        {/* Campo Email */}
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Animated.View>

        {/* Botón login */}
        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={handleEmailLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnPrimaryText}>Continuar →</Text>
          )}
        </TouchableOpacity>

        {/* Link a registro */}
        <TouchableOpacity style={styles.linkRow} onPress={onGoToSignUp}>
          <Text style={styles.linkText}>
            ¿Nuevo aquí?{' '}
            <Text style={styles.linkAccent}>Crear cuenta de pasajero</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backBtn: {
    marginBottom: 20,
  },
  backText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.md,
    paddingVertical: 13,
    gap: 8,
  },
  socialIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  socialLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.cardBorder,
  },
  orText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.colors.textPrimary,
    fontSize: 15,
    marginBottom: 20,
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: {
    color: '#0B0F19',
    fontSize: 16,
    fontWeight: '800',
  },
  linkRow: {
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  linkAccent: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
