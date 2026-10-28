/**
 * PassengerSignUp.tsx — Registro de Pasajero
 *
 * Formulario de creación de cuenta con validación local.
 * Campos: nombres, apellidos, cédula, correo, carrera / semestre,
 * teléfono y contraseña.
 */

import { isEmailVerificationPending } from '../services/emailGate';
import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { theme, themed } from '../constants/theme';
import { signUpPassenger, AuthUser } from '../services/auth';
import { FormField } from '../components/FormField';
import { AuthLayout } from '../components/brand/AuthLayout';
import { PrimaryButton } from '../components/brand/PrimaryButton';
import {
  IdentityErrors,
  IdentityFields,
  IdentityForm,
  prefillIdentity,
  toIdentityPayload,
  validateIdentity,
} from '../components/IdentityFields';
import { validatePassword } from '../utils/validation';
import { PROVIDER_LABEL, SocialPrefill } from '../services/socialAuth';

interface Props {
  onSuccess: (user: AuthUser) => void;
  onBack: () => void;
  /** Viene de entrar con Google/Facebook: no pide contraseña. */
  social?: SocialPrefill | null;
}

interface FormErrors extends IdentityErrors {
  password?: string;
}

export const PassengerSignUp: React.FC<Props> = ({ onSuccess, onBack, social }) => {
  const [identity, setIdentity] = useState<IdentityForm>(() => prefillIdentity(social));
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const updateIdentity = <K extends keyof IdentityForm>(field: K, value: IdentityForm[K]) => {
    setIdentity((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = { ...validateIdentity(identity) };
    const passwordError = social ? undefined : validatePassword(password);
    if (passwordError) newErrors.password = passwordError;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const user = await signUpPassenger(toIdentityPayload(identity), social ? '' : password);

      Alert.alert(
        '🎉 ¡Bienvenido/a!',
        `Cuenta creada con éxito. Recibes 100 Fe de bienvenida, ${user.name}.`,
        [{ text: '¡Genial!', onPress: () => onSuccess(user) }]
      );
    } catch (e: any) {
      if (isEmailVerificationPending(e)) return;
      Alert.alert('Error al registrarse', e.message || 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={social ? 'Completa tu perfil' : 'Crear cuenta'}
      subtitle={social ? `Pasajero · entraste con ${PROVIDER_LABEL[social.provider]}` : 'Pasajero · Comunidad universitaria'}
      onBack={onBack}
    >
        {/* Bono de bienvenida */}
        <View style={styles.bonusBadge}>
          <Text style={styles.bonusText}>🎁 Recibirás 100 Fe al registrarte</Text>
        </View>

        <IdentityFields form={identity} errors={errors} onChange={updateIdentity} emailLocked={!!social} />

        {!social && <FormField
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
        />}

        <Text style={styles.requiredNote}>* Campos obligatorios</Text>

        <PrimaryButton label="Crear mi cuenta →" onPress={handleSubmit} loading={loading} style={styles.submit} />
    </AuthLayout>
  );
};

const styles = themed(() => ({
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
}));
