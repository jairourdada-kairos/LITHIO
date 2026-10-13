/**
 * DriverSignIn.tsx — Inicio de sesión para conductor
 *
 * Permite entrar con correo y ofrece la opción de crear cuenta si no existe.
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

export const DriverSignIn: React.FC<Props> = ({ onSuccess, onGoToSignUp, onBack }) => {
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
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.emoji}>🛵</Text>
          <Text style={styles.title}>Conductor</Text>
          <Text style={styles.subtitle}>Inicia sesión con tu correo</Text>
        </View>

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

        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={handleEmailLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnPrimaryText}>Entrar como conductor →</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={onGoToSignUp}>
          <Text style={styles.linkText}>
            ¿No tienes cuenta?{' '}
            <Text style={styles.linkAccent}>Crear cuenta de conductor</Text>
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
  label: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.textPrimary,
    marginBottom: 20,
    fontSize: 16,
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnPrimaryText: {
    color: '#08111d',
    fontSize: 16,
    fontWeight: '800',
  },
  linkRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  linkAccent: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
