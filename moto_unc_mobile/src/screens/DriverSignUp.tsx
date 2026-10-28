/**
 * DriverSignUp.tsx — Registro de Conductor
 *
 * Formulario en dos secciones:
 * 1. Datos personales (nombres, apellidos, cédula, correo, carrera / semestre,
 *    teléfono, edad y contraseña)
 * 2. Datos de la moto + métodos de pago (Binance, pago móvil, banco)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { theme, themed } from '../constants/theme';
import { signUpDriver, AuthUser } from '../services/auth';
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
  /** Viene de entrar con Google/Facebook: no pide contraseña. */
  social?: SocialPrefill | null;
  onBack: () => void;
}

interface DriverForm {
  // Datos personales (los de identidad viven en IdentityForm)
  age: string;
  password: string;
  // Moto
  moto_brand_model: string;
  moto_color: string;
  plate: string;
  license_number: string;
  moto_year: string;
  helmet_provided: boolean;
  // Pagos
  binance_address: string;
  mobile_payment_number: string;
  mobile_payment_bank: string;
  mobile_payment_id: string;
  bank_account_number: string;
}

interface FormErrors extends IdentityErrors {
  age?: string;
  password?: string;
  plate?: string;
  license_number?: string;
  moto_year?: string;
}

export const DriverSignUp: React.FC<Props> = ({ onSuccess, onBack, social }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [identity, setIdentity] = useState<IdentityForm>(() => prefillIdentity(social));
  const [form, setForm] = useState<DriverForm>({
    age: '',
    password: '',
    moto_brand_model: 'Bera SBR 150',
    moto_color: 'Negro',
    plate: '',
    license_number: '',
    moto_year: '',
    helmet_provided: true,
    binance_address: '',
    mobile_payment_number: '',
    mobile_payment_bank: '',
    mobile_payment_id: '',
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

  const updateIdentity = <K extends keyof IdentityForm>(field: K, value: IdentityForm[K]) => {
    setIdentity((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = { ...validateIdentity(identity) };
    const age = Number(form.age);
    if (!form.age || !Number.isInteger(age) || age < 18 || age > 80) {
      newErrors.age = 'Debes tener entre 18 y 80 años para conducir';
    }
    const passwordError = social ? undefined : validatePassword(form.password);
    if (passwordError) newErrors.password = passwordError;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};
    const plate = form.plate.replace(/[\s-]/g, '');
    if (plate.length < 5 || plate.length > 10) newErrors.plate = 'Placa inválida (5 a 10 caracteres)';
    const license = form.license_number.trim();
    if (license.length < 5 || license.length > 20) newErrors.license_number = 'Escribe el número de tu licencia de conducir';
    const year = Number(form.moto_year);
    if (!form.moto_year || !Number.isInteger(year) || year < 1990 || year > new Date().getFullYear() + 1) {
      newErrors.moto_year = 'Año de la moto no válido';
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return false;
    }
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
        ...toIdentityPayload(identity),
        age: Number(form.age),
        moto_brand_model: form.moto_brand_model.trim() || 'Bera SBR 150',
        moto_color: form.moto_color.trim() || 'Negro',
        plate: form.plate.trim().toUpperCase(),
        license_number: form.license_number.trim().toUpperCase(),
        moto_year: Number(form.moto_year),
        helmet_provided: form.helmet_provided,
        binance_address: form.binance_address.trim() || undefined,
        mobile_payment_number: form.mobile_payment_number.trim() || undefined,
        mobile_payment_bank: form.mobile_payment_bank.trim() || undefined,
        mobile_payment_id: form.mobile_payment_id.trim() || undefined,
        bank_account_number: form.bank_account_number.trim() || undefined,
      }, social ? '' : form.password);

      Alert.alert(
        'Postulación enviada',
        `Gracias, ${user.name}. Revisaremos tus datos y te contactaremos para inspeccionar tu moto. Podrás seguir el avance desde la app.`,
        [{ text: 'Ver mi postulación', onPress: () => onSuccess(user) }]
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
      <IdentityFields
        form={identity}
        errors={errors}
        onChange={updateIdentity}
        accent={theme.colors.secondary}
        emailLocked={!!social}
      />

      <FormField
        label="Edad (mínimo 18 años)"
        required
        value={form.age}
        onChangeText={(v) => updateField('age', v.replace(/\D/g, '').slice(0, 2))}
        placeholder="25"
        keyboardType="number-pad"
        error={errors.age}
      />

      {!social && <FormField
        label="Contraseña"
        required
        value={form.password}
        onChangeText={(v) => updateField('password', v)}
        placeholder="Mínimo 6 caracteres"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.password}
      />}

      <Text style={styles.requiredNote}>* Campos obligatorios</Text>

      <PrimaryButton
        label="Siguiente: Moto y Pagos →"
        onPress={handleNext}
        accent={theme.colors.secondary}
        style={styles.submit}
      />
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

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Licencia de conducir *</Text>
          <TextInput
            style={[styles.input, errors.license_number ? styles.inputError : null]}
            value={form.license_number}
            onChangeText={(v) => updateField('license_number', v)}
            placeholder="Nº de licencia"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
          />
          {errors.license_number && <Text style={styles.errorText}>{errors.license_number}</Text>}
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Año de la moto *</Text>
          <TextInput
            style={[styles.input, errors.moto_year ? styles.inputError : null]}
            value={form.moto_year}
            onChangeText={(v) => updateField('moto_year', v.replace(/\D/g, '').slice(0, 4))}
            placeholder="2021"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="number-pad"
          />
          {errors.moto_year && <Text style={styles.errorText}>{errors.moto_year}</Text>}
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
        placeholder="0412-1234567"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="phone-pad"
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Banco del Pago Móvil</Text>
          <TextInput
            style={styles.input}
            value={form.mobile_payment_bank}
            onChangeText={(v) => updateField('mobile_payment_bank', v)}
            placeholder="Banco de Venezuela"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Cédula del titular</Text>
          <TextInput
            style={styles.input}
            value={form.mobile_payment_id}
            onChangeText={(v) => updateField('mobile_payment_id', v)}
            placeholder="V-12345678"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
          />
        </View>
      </View>

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

        <View style={styles.btnFlex}>
          <PrimaryButton
            label="Crear cuenta →"
            onPress={handleSubmit}
            loading={loading}
            accent={theme.colors.secondary}
          />
        </View>
      </View>
    </>
  );

  return (
    <AuthLayout
      title={social ? 'Completa tu perfil' : 'Crear cuenta'}
      subtitle={social ? `Conductor · entraste con ${PROVIDER_LABEL[social.provider]}` : 'Conductor · Comunidad universitaria'}
      accent={theme.colors.secondary}
      onBack={onBack}
    >
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
    </AuthLayout>
  );
};

const styles = themed(() => ({
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
  progressLabel: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.textMuted },
  progressLabelActive: { fontFamily: theme.fonts.bold, color: theme.colors.secondary },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  label: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    fontFamily: theme.fonts.regular,
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
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.error,
    marginTop: -12,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.glassBg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  switchTextGroup: { flex: 1 },
  switchLabel: { fontFamily: theme.fonts.semibold, fontSize: 14, color: theme.colors.textPrimary },
  switchDesc: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  sectionHeader: { marginBottom: 12 },
  requiredNote: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginBottom: 12 },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  sectionDesc: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted },
  buttonsRow: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'stretch' },
  btnSecondary: {
    flex: 0,
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.glassBg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { fontFamily: theme.fonts.semibold, color: theme.colors.textSecondary, fontSize: 15 },
  btnFlex: { flex: 1 },
  submit: { marginTop: 8 },
}));
