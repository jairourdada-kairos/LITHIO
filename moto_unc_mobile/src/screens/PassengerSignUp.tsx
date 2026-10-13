/**
 * PassengerSignUp.tsx — Registro de Pasajero
 *
 * Formulario de creación de cuenta con validación local.
 * Campos: nombre, apellido, edad, teléfono, email.
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { theme } from '../constants/theme';
import { signUpPassenger, AuthUser } from '../services/auth';

interface Props {
  onSuccess: (user: AuthUser) => void;
  onBack: () => void;
}

interface FormData {
  name: string;
  last_name: string;
  age: string;
  phone: string;
  email: string;
}

interface FormErrors {
  name?: string;
  last_name?: string;
  age?: string;
  phone?: string;
  email?: string;
}

export const PassengerSignUp: React.FC<Props> = ({ onSuccess, onBack }) => {
  const [form, setForm] = useState<FormData>({
    name: '',
    last_name: '',
    age: '',
    phone: '',
    email: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!form.last_name.trim()) newErrors.last_name = 'El apellido es requerido';

    const age = parseInt(form.age, 10);
    if (!form.age || isNaN(age) || age < 16 || age > 80) {
      newErrors.age = 'Edad debe estar entre 16 y 80 años';
    }

    if (!form.phone.trim() || form.phone.length < 7) {
      newErrors.phone = 'Teléfono inválido (mínimo 7 dígitos)';
    }

    if (!form.email.trim() || !form.email.includes('@')) {
      newErrors.email = 'Correo electrónico inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const user = await signUpPassenger({
        name: form.name.trim(),
        last_name: form.last_name.trim(),
        age: parseInt(form.age, 10),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
      });

      Alert.alert(
        '🎉 ¡Bienvenido/a!',
        `Cuenta creada con éxito. Recibes 100 Fe de bienvenida, ${form.name}.`,
        [{ text: '¡Genial!', onPress: () => onSuccess(user) }]
      );
    } catch (e: any) {
      Alert.alert('Error al registrarse', e.message || 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({
    label,
    field,
    placeholder,
    keyboardType = 'default',
    autoCapitalize = 'words',
  }: {
    label: string;
    field: keyof FormData;
    placeholder: string;
    keyboardType?: any;
    autoCapitalize?: any;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, errors[field] ? styles.inputError : null]}
        value={form[field]}
        onChangeText={(v) => updateField(field, v)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
      {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
    </View>
  );

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

        {/* Formulario */}
        <View style={styles.row}>
          <View style={[styles.halfField]}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              value={form.name}
              onChangeText={(v) => updateField('name', v)}
              placeholder="Juan"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={[styles.halfField]}>
            <Text style={styles.label}>Apellido</Text>
            <TextInput
              style={[styles.input, errors.last_name ? styles.inputError : null]}
              value={form.last_name}
              onChangeText={(v) => updateField('last_name', v)}
              placeholder="Pérez"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {errors.last_name && <Text style={styles.errorText}>{errors.last_name}</Text>}
          </View>
        </View>

        <InputField
          label="Edad"
          field="age"
          placeholder="22"
          keyboardType="numeric"
          autoCapitalize="none"
        />

        <InputField
          label="Teléfono"
          field="phone"
          placeholder="+58 412 1234567"
          keyboardType="phone-pad"
          autoCapitalize="none"
        />

        <InputField
          label="Correo electrónico"
          field="email"
          placeholder="juan@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

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
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
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
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  halfField: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 4,
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
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: theme.colors.textPrimary,
    fontSize: 15,
    marginBottom: 16,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: -12,
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
