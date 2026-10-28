/**
 * DriverSignIn.tsx — Inicio de sesión para conductor
 *
 * Permite entrar con correo y ofrece la opción de crear cuenta si no existe.
 */

import React, { useState } from 'react';
import { Text, StyleSheet, Alert, Pressable } from 'react-native';
import { theme, themed } from '../constants/theme';
import { signInWithEmail } from '../services/auth';
import { AuthUser } from '../services/auth';
import { AuthLayout } from '../components/brand/AuthLayout';
import { FormField } from '../components/FormField';
import { RecoverySheet } from '../components/RecoverySheet';
import { PrimaryButton } from '../components/brand/PrimaryButton';
import { validateEmail } from '../utils/validation';

interface Props {
  onSuccess: (user: AuthUser) => void;
  onGoToSignUp: () => void;
  /** Lleva al inicio de sesión del otro rol. */
  onSwitchRole?: () => void;
  onBack: () => void;
}

export const DriverSignIn: React.FC<Props> = ({ onSuccess, onGoToSignUp, onSwitchRole, onBack }) => {
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
        if (user.role !== 'conductor' && user.role !== 'ambos') {
          Alert.alert(
            'Cuenta no autorizada',
            'Este correo pertenece a un usuario que no tiene acceso como conductor.',
            [{ text: 'Entendido' }]
          );
          return;
        }
        onSuccess(user);
      } else {
        Alert.alert(
          'Cuenta no encontrada',
          'No existe una cuenta de conductor con ese correo. ¿Deseas crear una nueva?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Registrarme', onPress: onGoToSignUp },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo conectar con el servidor. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Conductor"
      subtitle="Inicia sesión con tu correo"
      accent={theme.colors.secondary}
      onBack={onBack}
    >
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
        <Text style={[styles.forgotText, { color: theme.colors.secondary }]}>¿Olvidaste tu contraseña o tu correo?</Text>
      </Pressable>

      <PrimaryButton
        label="Entrar como conductor →"
        onPress={handleEmailLogin}
        loading={loading}
        accent={theme.colors.secondary}
        style={styles.submit}
      />

      <Pressable style={styles.linkRow} onPress={onGoToSignUp} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.linkText}>
          ¿No tienes cuenta? <Text style={styles.linkAccent}>Crear cuenta de conductor</Text>
        </Text>
      </Pressable>

      {onSwitchRole ? (
        <Pressable style={styles.linkRow} onPress={onSwitchRole} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>¿Viajas como pasajero? Entra por aquí</Text>
        </Pressable>
      ) : null}
      <RecoverySheet visible={recoveryVisible} accent={theme.colors.secondary} initialEmail={email} onClose={() => setRecoveryVisible(false)} />
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
    color: theme.colors.secondary,
  },
}));
