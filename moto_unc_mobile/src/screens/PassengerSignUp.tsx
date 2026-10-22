/**
 * PassengerSignUp.tsx — Registro de Pasajero
 *
 * Formulario de creación de cuenta con validación local.
 * Campos: nombres, apellidos, cédula, correo, carrera / semestre,
 * teléfono y contraseña.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { theme } from '../constants/theme';
import { signUpPassenger, AuthUser } from '../services/auth';
import { FormField } from '../components/FormField';
import { AuthLayout } from '../components/brand/AuthLayout';
import { PrimaryButton } from '../components/brand/PrimaryButton';
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
    <AuthLayout title="Crear cuenta" subtitle="Pasajero · Comunidad universitaria" onBack={onBack}>
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

        <PrimaryButton label="Crear mi cuenta →" onPress={handleSubmit} loading={loading} style={styles.submit} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  bonusBadge: {
    backgroundColor: theme.colors.goldSoft,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
    alignItems: 'center',
  },
  bonusText: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.gold,
    fontSize: 13,
  },
  requiredNote: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  submit: {
    marginTop: 8,
  },
});
