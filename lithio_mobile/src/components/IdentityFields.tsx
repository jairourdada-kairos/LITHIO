/**
 * IdentityFields.tsx — Datos de identidad comunes a pasajero y conductor
 *
 * Nombres, apellidos, cédula, correo, carrera / semestre y teléfono, con la
 * validación y el formato que espera POST /api/{passengers|drivers}/register.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { theme, themed } from '../constants/theme';
import { FormField, fieldStyles } from './FormField';
import {
  CedulaNationality,
  SEMESTER_OPTIONS,
  collapseSpaces,
  formatCedula,
  normalizePhone,
  validateCareer,
  validateCedulaDigits,
  validateGmail,
  validatePersonName,
  validatePhone,
  validateSemester,
} from '../utils/validation';

export interface IdentityForm {
  name: string;
  last_name: string;
  nationality: CedulaNationality;
  cedula_digits: string;
  email: string;
  career: string;
  semester: string;
  phone: string;
}

export type IdentityErrors = Partial<Record<keyof IdentityForm, string>>;

export const EMPTY_IDENTITY: IdentityForm = {
  name: '',
  last_name: '',
  nationality: 'V',
  cedula_digits: '',
  email: '',
  career: '',
  semester: '',
  phone: '',
};

/** Formulario vacío, o con el correo y nombre que ya dio Google/Facebook. */
export function prefillIdentity(prefill?: { email: string; name: string; last_name: string } | null): IdentityForm {
  if (!prefill) return EMPTY_IDENTITY;
  return { ...EMPTY_IDENTITY, email: prefill.email, name: prefill.name, last_name: prefill.last_name };
}

export function validateIdentity(form: IdentityForm): IdentityErrors {
  const errors: IdentityErrors = {
    name: validatePersonName(form.name, 'El nombre'),
    last_name: validatePersonName(form.last_name, 'El apellido'),
    cedula_digits: validateCedulaDigits(form.cedula_digits),
    email: validateGmail(form.email),
    career: validateCareer(form.career),
    semester: validateSemester(form.semester),
    phone: validatePhone(form.phone),
  };
  (Object.keys(errors) as (keyof IdentityForm)[]).forEach((key) => {
    if (!errors[key]) delete errors[key];
  });
  return errors;
}

export function toIdentityPayload(form: IdentityForm) {
  return {
    name: collapseSpaces(form.name),
    last_name: collapseSpaces(form.last_name),
    cedula: formatCedula(form.nationality, form.cedula_digits),
    email: form.email.trim().toLowerCase(),
    career: collapseSpaces(form.career),
    semester: form.semester,
    phone: normalizePhone(form.phone),
  };
}

interface Props {
  form: IdentityForm;
  errors: IdentityErrors;
  onChange: <K extends keyof IdentityForm>(field: K, value: IdentityForm[K]) => void;
  /** Color de acento: turquesa para pasajero, coral para conductor. */
  accent?: string;
  /** El correo viene de Google o Facebook y debe coincidir con esa cuenta. */
  emailLocked?: boolean;
}

export const IdentityFields: React.FC<Props> = ({ form, errors, onChange, accent = theme.colors.primary, emailLocked = false }) => (
  <>
    <View style={styles.row}>
      <FormField accent={accent}
        label="Nombres"
        required
        containerStyle={styles.half}
        value={form.name}
        onChangeText={(v) => onChange('name', v)}
        placeholder="María José"
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        error={errors.name}
      />
      <FormField accent={accent}
        label="Apellidos"
        required
        containerStyle={styles.half}
        value={form.last_name}
        onChangeText={(v) => onChange('last_name', v)}
        placeholder="Pérez Gómez"
        autoCapitalize="words"
        autoComplete="family-name"
        textContentType="familyName"
        error={errors.last_name}
      />
    </View>

    <FormField accent={accent}
      label="Cédula de identidad"
      required
      value={form.cedula_digits}
      onChangeText={(v) => onChange('cedula_digits', v.replace(/\D/g, '').slice(0, 9))}
      placeholder="12345678"
      keyboardType="number-pad"
      // Sin maxLength: contaría los puntos pegados ("12.345.678") antes de limpiarlos.
      error={errors.cedula_digits}
      hint="Se guarda cifrada. Nadie más puede verla completa."
      prefix={
        <View style={styles.nationality} accessibilityRole="radiogroup" accessibilityLabel="Nacionalidad">
          {(['V', 'E'] as CedulaNationality[]).map((option) => {
            const selected = form.nationality === option;
            return (
              <TouchableOpacity
                key={option}
                onPress={() => onChange('nationality', option)}
                style={[styles.nationalityOption, selected && { backgroundColor: accent }]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option === 'V' ? 'Venezolano' : 'Extranjero'}
              >
                <Text style={[styles.nationalityText, selected && styles.nationalityTextSelected]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      }
    />

    <FormField accent={accent}
      label="Correo de Gmail"
      required
      value={form.email}
      onChangeText={(v) => onChange('email', v)}
      placeholder="maria@gmail.com"
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      textContentType="emailAddress"
      editable={!emailLocked}
      hint={emailLocked ? 'Es el correo de la cuenta con la que entraste.' : 'Te enviaremos un enlace para verificar que es tuyo.'}
      error={errors.email}
    />

    <FormField accent={accent}
      label="Carrera universitaria"
      required
      value={form.career}
      onChangeText={(v) => onChange('career', v)}
      placeholder="Ingeniería en Computación"
      autoCapitalize="sentences"
      error={errors.career}
    />

    <View style={styles.semesterGroup}>
      <Text style={fieldStyles.label}>
        Semestre<Text style={{ color: theme.colors.secondary }}> *</Text>
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel="Semestre"
      >
        {SEMESTER_OPTIONS.map((option) => {
          const selected = form.semester === option;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onChange('semester', option)}
              style={[
                styles.chip,
                selected && { backgroundColor: accent, borderColor: accent },
                errors.semester && !form.semester ? styles.chipError : null,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {/^\d+$/.test(option) ? `${option}°` : option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {errors.semester ? <Text style={styles.error}>{errors.semester}</Text> : null}
    </View>

    <FormField accent={accent}
      label="Teléfono celular"
      required
      value={form.phone}
      onChangeText={(v) => onChange('phone', v)}
      placeholder="0412-1234567"
      keyboardType="phone-pad"
      autoComplete="tel"
      textContentType="telephoneNumber"
      error={errors.phone}
    />
  </>
);

const styles = themed(() => ({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  nationality: {
    flexDirection: 'row',
    backgroundColor: theme.colors.glassBgStrong,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    borderRadius: theme.radius.md,
    padding: 3,
  },
  nationalityOption: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
  },
  nationalityText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
  nationalityTextSelected: {
    color: theme.colors.bgDark,
  },
  semesterGroup: {
    marginBottom: 16,
  },
  chips: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    minWidth: 44,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBgStrong,
  },
  chipError: {
    borderColor: theme.colors.error,
  },
  chipText: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  chipTextSelected: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.bgDark,
  },
  error: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 6,
  },
}));
