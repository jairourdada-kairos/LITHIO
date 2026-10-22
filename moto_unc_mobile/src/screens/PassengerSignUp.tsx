/**
 * PassengerSignUp.tsx — Registro de Pasajero
 *
 * Formulario de creación de cuenta con validación local.
 * Campos: nombres, apellidos, cédula, correo, carrera / semestre,
 * teléfono y contraseña.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { theme } from '../constants/theme';
import { signUpPassenger, AuthUser } from '../services/auth';
import { FormField } from '../components/FormField';
import {
  EMPTY_IDENTITY,
  IdentityErrors,
  IdentityFields,
  IdentityForm,
  toIdentityPayload,
  validateIdentity,
} from '../components/IdentityFields';
import { validatePassword } from '../utils/validation';

interface Props {
  onSuccess: (user: AuthUser) => void;
  onBack: () => void;
}

interface FormErrors extends IdentityErrors {
  password?: string;
}

export const PassengerSignUp: React.FC<Props> = ({ onSuccess, onBack }) => {
  const [identity, setIdentity] = useState<IdentityForm>(EMPTY_IDENTITY);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const updateIdentity = <K extends keyof IdentityForm>(field: K, value: IdentityForm[K]) => {
    setIdentity((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = { ...validateIdentity(identity) };
    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const user = await signUpPassenger(toIdentityPayload(identity), password);

      Alert.alert(
        '🎉 ¡Bienvenido/a!',
        `Cuenta creada con éxito. Recibes 100 Fe de bienvenida, ${user.name}.`,
        [{ text: '¡Genial!', onPress: () => onSuccess(user) }]
      );
    } catch (e: any) {
      Alert.alert('Error al registrarse', e.message || 'Inténtalo de nuevo.');
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
          <Text style={styles.emoji}>🎒</Text>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Pasajero · Comunidad UNC</Text>
        </View>

        {/* Bono de bienvenida */}
        <View style={styles.bonusBadge}>
          <Text style={styles.bonusText}>🎁 Recibirás 100 Fe al registrarte</Text>
        </View>

        <IdentityFields form={identity} errors={errors} onChange={updateIdentity} />

        <FormField
          label="Contraseña"
          required
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
        />

        <Text style={styles.requiredNote}>* Campos obligatorios</Text>

        {/* Botón submit */}
        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#0B0F19" />
          ) : (
            <Text style={styles.btnPrimaryText}>Crear mi cuenta →</Text>
          )}
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
    marginBottom: 20,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  bonusBadge: {
    backgroundColor: 'rgba(255, 200, 87, 0.12)',
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
    alignItems: 'center',
  },
  bonusText: {
    color: theme.colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  requiredNote: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: {
    color: '#0B0F19',
    fontSize: 16,
    fontWeight: '800',
  },
});
