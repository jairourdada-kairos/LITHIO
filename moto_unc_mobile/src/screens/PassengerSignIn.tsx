/**
 * PassengerSignIn.tsx — Inicio de Sesión / Registro de Pasajero
 *
 * Muestra opciones de auth social (Google, Facebook) y email.
 * Navega a PassengerSignUp si el usuario no tiene cuenta.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, themed } from '../constants/theme';
import { signInWithEmail } from '../services/auth';
import { AuthUser } from '../services/auth';
import { AuthLayout } from '../components/brand/AuthLayout';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/brand/PrimaryButton';
import { PressableScale } from '../components/brand/PressableScale';
import { validateEmail } from '../utils/validation';

interface Props {
  onSuccess: (user: AuthUser) => void;
  onGoToSignUp: () => void;
  /** Lleva al inicio de sesión del otro rol. */
  onSwitchRole?: () => void;
  onBack: () => void;
}

export const PassengerSignIn: React.FC<Props> = ({ onSuccess, onGoToSignUp, onSwitchRole, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async () => {
    const newErrors = {
      email: validateEmail(email),
      password: password ? undefined : 'Escribe tu contraseña',
    };
    setErrors(newErrors);
    if (newErrors.email || newErrors.password) return;

    setLoading(true);
    try {
      const user = await signInWithEmail(email.trim().toLowerCase(), password);
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
    } catch (error) {
      Alert.alert('Error al iniciar sesión', error instanceof Error ? error.message : 'Verifica tus credenciales y conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    Alert.alert(
      `Entrar con ${provider}`,
      `Muy pronto podrás entrar con ${provider}. Por ahora usa tu correo electrónico.`,
      [{ text: 'Entendido' }]
    );
  };

  return (
    <AuthLayout title="Iniciar sesión" subtitle="Pasajero · tu cuenta LITHIO" onBack={onBack}>
      {/* Opciones sociales: requieren configurar Firebase antes de habilitarlas */}
      <View style={styles.socialRow}>
        <PressableScale containerStyle={styles.socialCell} style={styles.socialBtn} onPress={() => handleSocialLogin('Google')}>
          <MaterialCommunityIcons name="google" size={18} color={theme.colors.textPrimary} />
          <Text style={styles.socialLabel}>Google</Text>
          <Text style={styles.soon}>pronto</Text>
        </PressableScale>
        <PressableScale containerStyle={styles.socialCell} style={styles.socialBtn} onPress={() => handleSocialLogin('Facebook')}>
          <MaterialCommunityIcons name="facebook" size={18} color={theme.colors.textPrimary} />
          <Text style={styles.socialLabel}>Facebook</Text>
          <Text style={styles.soon}>pronto</Text>
        </PressableScale>
      </View>

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>o continúa con tu correo</Text>
        <View style={styles.orLine} />
      </View>

      <FormField
        label="Correo electrónico"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setErrors((prev) => ({ ...prev, email: undefined }));
        }}
        placeholder="tu@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        error={errors.email}
      />

      <FormField
        label="Contraseña"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setErrors((prev) => ({ ...prev, password: undefined }));
        }}
        placeholder="Tu contraseña"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        error={errors.password}
        onSubmitEditing={handleEmailLogin}
      />

      <PrimaryButton label="Continuar →" onPress={handleEmailLogin} loading={loading} style={styles.submit} />

      <Pressable style={styles.linkRow} onPress={onGoToSignUp} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.linkText}>
          ¿Nuevo aquí? <Text style={styles.linkAccent}>Crear cuenta de pasajero</Text>
        </Text>
      </Pressable>

      {onSwitchRole ? (
        <Pressable style={styles.linkRow} onPress={onSwitchRole} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.linkText, { color: theme.colors.secondary }]}>¿Eres conductor? Entra por aquí</Text>
        </Pressable>
      ) : null}
    </AuthLayout>
  );
};

const styles = themed(() => ({
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  socialCell: {
    flex: 1,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  socialLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  soon: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textMuted,
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
    backgroundColor: theme.colors.glassBorder,
  },
  orText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  submit: {
    marginTop: 8,
    marginBottom: 20,
  },
  linkRow: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  linkAccent: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
}));
