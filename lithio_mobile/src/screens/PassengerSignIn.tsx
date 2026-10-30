/**
 * PassengerSignIn.tsx — Inicio de Sesión / Registro de Pasajero
 *
 * Entrar con Google, Facebook o correo.
 * Navega a PassengerSignUp si el usuario no tiene cuenta.
 */

import { isEmailVerificationPending } from '../services/emailGate';
import React, { useState } from 'react';
import { Text, Alert, Pressable } from 'react-native';
import { theme, themed } from '../constants/theme';
import { signInWithEmail } from '../services/auth';
import { AuthUser } from '../services/auth';
import { AuthLayout } from '../components/brand/AuthLayout';
import { FormField } from '../components/FormField';
import { RecoverySheet } from '../components/RecoverySheet';
import { PrimaryButton } from '../components/brand/PrimaryButton';
import { LegalNotice } from '../components/LegalNotice';
import { SocialSignIn } from '../components/SocialSignIn';
import { SocialPrefill } from '../services/socialAuth';
import { validateEmail } from '../utils/validation';

interface Props {
  onSuccess: (user: AuthUser) => void;
  onGoToSignUp: () => void;
  /** Primera vez con Google/Facebook: completar el registro. */
  onSocialSignUp: (prefill: SocialPrefill) => void;
  /** Lleva al inicio de sesión del otro rol. */
  onSwitchRole?: () => void;
  onBack: () => void;
}

export const PassengerSignIn: React.FC<Props> = ({ onSuccess, onGoToSignUp, onSocialSignUp, onSwitchRole, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [recoveryVisible, setRecoveryVisible] = useState(false);

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
      if (isEmailVerificationPending(error)) return;
      Alert.alert('Error al iniciar sesión', error instanceof Error ? error.message : 'Verifica tus credenciales y conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Iniciar sesión" subtitle="Pasajero · tu cuenta LITHIO" onBack={onBack}>
      <SocialSignIn onUser={onSuccess} onNeedsProfile={onSocialSignUp} />

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

      <Pressable onPress={() => setRecoveryVisible(true)} style={styles.forgot} accessibilityRole="button" hitSlop={8}>
        <Text style={[styles.forgotText, { color: theme.colors.primary }]}>¿Olvidaste tu contraseña o tu correo?</Text>
      </Pressable>

      <PrimaryButton label="Continuar →" onPress={handleEmailLogin} loading={loading} style={styles.submit} />
      <LegalNotice lead="Al continuar, aceptas" />

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
      <RecoverySheet visible={recoveryVisible} accent={theme.colors.primary} initialEmail={email} onClose={() => setRecoveryVisible(false)} />
    </AuthLayout>
  );
};

const styles = themed(() => ({
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 4,
  },
  forgotText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
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
