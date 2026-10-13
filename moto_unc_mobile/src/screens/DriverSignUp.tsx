/**
 * DriverSignUp.tsx — Registro de Conductor
 *
 * Formulario en dos secciones:
 * 1. Datos personales (nombre, apellido, edad, teléfono, email)
 * 2. Datos de la moto + métodos de pago (Binance, pago móvil, banco)
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
  Switch,
} from 'react-native';
import { theme } from '../constants/theme';
import { signUpDriver, AuthUser } from '../services/auth';

interface Props {
  onSuccess: (user: AuthUser) => void;
  onBack: () => void;
}

interface DriverForm {
  // Datos personales
  name: string;
  last_name: string;
  age: string;
  phone: string;
  email: string;
  // Moto
  moto_brand_model: string;
  moto_color: string;
  plate: string;
  helmet_provided: boolean;
  // Pagos
  binance_address: string;
  mobile_payment_number: string;
  bank_account_number: string;
}

interface FormErrors {
  name?: string;
  last_name?: string;
  age?: string;
  phone?: string;
  email?: string;
  plate?: string;
}

export const DriverSignUp: React.FC<Props> = ({ onSuccess, onBack }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<DriverForm>({
    name: '',
    last_name: '',
    age: '',
    phone: '',
    email: '',
    moto_brand_model: 'Bera SBR 150',
    moto_color: 'Negro',
    plate: '',
    helmet_provided: true,
    binance_address: '',
    mobile_payment_number: '',
    bank_account_number: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const updateField = (field: keyof DriverForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (typeof value === 'string') {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!form.last_name.trim()) newErrors.last_name = 'El apellido es requerido';
    const age = parseInt(form.age, 10);
    if (!form.age || isNaN(age) || age < 18 || age > 70) {
      newErrors.age = 'Edad debe estar entre 18 y 70 años';
    }
    if (!form.phone.trim() || form.phone.length < 7) {
      newErrors.phone = 'Teléfono inválido';
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      newErrors.email = 'Correo inválido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.plate.trim()) newErrors.plate = 'La placa es requerida';
    if (!form.binance_address && !form.mobile_payment_number && !form.bank_account_number) {
      Alert.alert(
        'Método de pago requerido',
        'Debes registrar al menos un método de pago (Binance, Pago Móvil o Cuenta Bancaria) para recibir pagos.'
      );
      return false;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const user = await signUpDriver({
        name: form.name.trim(),
        last_name: form.last_name.trim(),
        age: parseInt(form.age, 10),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        moto_brand_model: form.moto_brand_model.trim() || 'Bera SBR 150',
        moto_color: form.moto_color.trim() || 'Negro',
        plate: form.plate.trim().toUpperCase(),
        helmet_provided: form.helmet_provided,
        binance_address: form.binance_address.trim() || undefined,
        mobile_payment_number: form.mobile_payment_number.trim() || undefined,
        bank_account_number: form.bank_account_number.trim() || undefined,
      });

      Alert.alert(
        '🛵 ¡Bienvenido, Conductor!',
        `Tu cuenta fue creada exitosamente, ${form.name}. Ya puedes empezar a recibir solicitudes de viaje.`,
        [{ text: '¡Arrancar!', onPress: () => onSuccess(user) }]
      );
    } catch (e: any) {
      Alert.alert('Error al registrarse', e.message || 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 1: Datos Personales
  // --------------------------------------------------------------------------
  const renderStep1 = () => (
    <>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            value={form.name}
            onChangeText={(v) => updateField('name', v)}
            placeholder="José"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Apellido *</Text>
          <TextInput
            style={[styles.input, errors.last_name ? styles.inputError : null]}
            value={form.last_name}
            onChangeText={(v) => updateField('last_name', v)}
            placeholder="Rodríguez"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
          />
          {errors.last_name && <Text style={styles.errorText}>{errors.last_name}</Text>}
        </View>
      </View>

      <Text style={styles.label}>Edad * (mínimo 18 años)</Text>
      <TextInput
        style={[styles.input, errors.age ? styles.inputError : null]}
        value={form.age}
        onChangeText={(v) => updateField('age', v)}
        placeholder="25"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="numeric"
      />
      {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}

      <Text style={styles.label}>Teléfono *</Text>
      <TextInput
        style={[styles.input, errors.phone ? styles.inputError : null]}
        value={form.phone}
        onChangeText={(v) => updateField('phone', v)}
        placeholder="+58 414 1234567"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="phone-pad"
      />
      {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

      <Text style={styles.label}>Correo electrónico *</Text>
      <TextInput
        style={[styles.input, errors.email ? styles.inputError : null]}
        value={form.email}
        onChangeText={(v) => updateField('email', v)}
        placeholder="conductor@correo.com"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

      <TouchableOpacity style={styles.btnPrimary} onPress={handleNext} activeOpacity={0.85}>
        <Text style={styles.btnPrimaryText}>Siguiente: Moto y Pagos →</Text>
      </TouchableOpacity>
    </>
  );

  // --------------------------------------------------------------------------
  // STEP 2: Datos de Moto + Pagos
  // --------------------------------------------------------------------------
  const renderStep2 = () => (
    <>
      {/* Sección Moto */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🏍️ Datos de tu Moto</Text>
      </View>

      <Text style={styles.label}>Marca y Modelo</Text>
      <TextInput
        style={styles.input}
        value={form.moto_brand_model}
        onChangeText={(v) => updateField('moto_brand_model', v)}
        placeholder="Bera SBR 150"
        placeholderTextColor={theme.colors.textMuted}
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Color</Text>
          <TextInput
            style={styles.input}
            value={form.moto_color}
            onChangeText={(v) => updateField('moto_color', v)}
            placeholder="Negro"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Placa *</Text>
          <TextInput
            style={[styles.input, errors.plate ? styles.inputError : null]}
            value={form.plate}
            onChangeText={(v) => updateField('plate', v)}
            placeholder="AB1C23D"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
          />
          {errors.plate && <Text style={styles.errorText}>{errors.plate}</Text>}
        </View>
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchTextGroup}>
          <Text style={styles.switchLabel}>⛑️ Ofrezco casco adicional al pasajero</Text>
          <Text style={styles.switchDesc}>Aumenta tu calificación y solicitudes</Text>
        </View>
        <Switch
          value={form.helmet_provided}
          onValueChange={(v) => updateField('helmet_provided', v)}
          trackColor={{ false: theme.colors.cardBorder, true: theme.colors.primary }}
          thumbColor="#fff"
        />
      </View>

      {/* Sección Pagos */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>💳 Métodos de Pago</Text>
        <Text style={styles.sectionDesc}>Registra al menos uno para recibir pagos</Text>
      </View>

      <Text style={styles.label}>Dirección Binance (USDT / BNB)</Text>
      <TextInput
        style={styles.input}
        value={form.binance_address}
        onChangeText={(v) => updateField('binance_address', v)}
        placeholder="0xABCD1234... o usuario@binance"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Número de Pago Móvil</Text>
      <TextInput
        style={styles.input}
        value={form.mobile_payment_number}
        onChangeText={(v) => updateField('mobile_payment_number', v)}
        placeholder="0412-1234567 · Banco Mercantil"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Número de Cuenta Bancaria</Text>
      <TextInput
        style={styles.input}
        value={form.bank_account_number}
        onChangeText={(v) => updateField('bank_account_number', v)}
        placeholder="0105 0000 00 0000000000"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="numeric"
      />

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => setStep(1)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnSecondaryText}>← Atrás</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnPrimary, styles.btnFlex, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#0B0F19" />
          ) : (
            <Text style={styles.btnPrimaryText}>Crear cuenta →</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
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
          <Text style={styles.emoji}>🛵</Text>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Conductor · Comunidad UNC</Text>
        </View>

        {/* Indicador de progreso */}
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
          <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
          <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressLabel, step === 1 && styles.progressLabelActive]}>
            Datos Personales
          </Text>
          <Text style={[styles.progressLabel, step === 2 && styles.progressLabelActive]}>
            Moto y Pagos
          </Text>
        </View>

        {step === 1 ? renderStep1() : renderStep2()}
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
  backBtn: { marginBottom: 20 },
  backText: { color: theme.colors.secondary, fontSize: 15, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: 20 },
  emoji: { fontSize: 48, marginBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: theme.colors.textPrimary },
  subtitle: { fontSize: 14, color: theme.colors.secondary, fontWeight: '600', marginTop: 4 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    gap: 0,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.cardBorder,
  },
  progressDotActive: {
    backgroundColor: theme.colors.secondary,
  },
  progressLine: {
    flex: 1,
    maxWidth: 80,
    height: 2,
    backgroundColor: theme.colors.cardBorder,
    marginHorizontal: 6,
  },
  progressLineActive: {
    backgroundColor: theme.colors.secondary,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  progressLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '500' },
  progressLabelActive: { color: theme.colors.secondary, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
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
  inputError: { borderColor: theme.colors.error },
  errorText: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: -12,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  switchTextGroup: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  switchDesc: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  sectionDesc: { fontSize: 12, color: theme.colors.textMuted },
  buttonsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnSecondary: {
    flex: 0,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { color: theme.colors.textSecondary, fontSize: 15, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  btnFlex: { flex: 1, marginTop: 0 },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
