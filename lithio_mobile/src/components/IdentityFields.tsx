/**
 * IdentityFields.tsx — Datos de identidad comunes a pasajero y conductor
 *
 * Nombres, apellidos, cédula, correo, perfil (estudiante: carrera y semestre;
 * trabajador: institución y área) y teléfono, con la validación y el formato
 * que espera POST /api/{passengers|drivers}/register.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { theme, themed } from '../constants/theme';
import { FormField, fieldStyles } from './FormField';
import { SelectField } from './SelectField';
import {
  CedulaNationality,
  collapseSpaces,
  formatCedula,
  normalizePhone,
  validateCedulaDigits,
  validateGmail,
  validatePersonName,
  validatePhone,
} from '../utils/validation';
import { FALLBACK_OPTIONS, Occupation, fetchRegistrationOptions } from '../utils/registrationOptions';

export interface IdentityForm {
  name: string;
  last_name: string;
  nationality: CedulaNationality;
  cedula_digits: string;
  email: string;
  /** Estudiante (carrera y semestre) o trabajador (institución y área). */
  occupation: Occupation | '';
  institution: string;
  career: string;
  semester: string;
  work_area: string;
  phone: string;
}

export type IdentityErrors = Partial<Record<keyof IdentityForm, string>>;

export const EMPTY_IDENTITY: IdentityForm = {
  name: '',
  last_name: '',
  nationality: 'V',
  cedula_digits: '',
  email: '',
  occupation: '',
  institution: '',
  career: '',
  semester: '',
  work_area: '',
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
    occupation: form.occupation ? undefined : 'Elige si eres estudiante o trabajador',
    phone: validatePhone(form.phone),
  };
  // El servidor comprueba que cada valor esté en sus listas; aquí solo se exige elegirlo.
  if (form.occupation === 'estudiante') {
    errors.career = form.career ? undefined : 'Elige tu carrera';
    errors.semester = form.semester ? undefined : 'Selecciona tu semestre';
  } else if (form.occupation === 'trabajador') {
    errors.institution = form.institution ? undefined : 'Elige la institución donde trabajas';
    errors.work_area = form.work_area ? undefined : 'Elige tu área de trabajo';
  }
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
    occupation: (form.occupation || 'estudiante') as Occupation,
    institution: form.institution,
    // Cada perfil envía solo sus datos.
    ...(form.occupation === 'trabajador'
      ? { work_area: form.work_area }
      : { career: form.career, semester: form.semester }),
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

export const IdentityFields: React.FC<Props> = ({ form, errors, onChange, accent = theme.colors.primary, emailLocked = false }) => {
  // Listas del servidor; mientras llegan (o sin conexión) se usa la copia de la app.
  const [options, setOptions] = useState(FALLBACK_OPTIONS);
  useEffect(() => {
    let alive = true;
    void fetchRegistrationOptions().then((fresh) => {
      if (alive && fresh) setOptions(fresh);
    });
    return () => {
      alive = false;
    };
  }, []);

  const chooseOccupation = (occupation: Occupation) => {
    if (form.occupation === occupation) return;
    onChange('occupation', occupation);
    // Al cambiar de perfil se limpian los datos del otro. Por ahora los estudiantes son de una sola universidad.
    onChange('institution', occupation === 'estudiante' ? options.student.institutions[0] : '');
    onChange('career', '');
    onChange('semester', '');
    onChange('work_area', '');
  };
  const chooseWorkerInstitution = (institution: string) => {
    if (form.institution === institution) return;
    onChange('institution', institution);
    onChange('work_area', ''); // Las áreas cambian con la institución (el comedor es solo del IVIC).
  };
  const studentInstitution = form.institution || options.student.institutions[0];
  const careers = options.student.careers[studentInstitution] ?? [];
  const areas = options.worker.areas[form.institution] ?? [];

  const choiceButton = (key: string, text: string, selected: boolean, onPress: () => void, hasError: boolean) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      style={[styles.choice, selected && { backgroundColor: accent, borderColor: accent }, hasError ? styles.chipError : null]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.choiceText, selected && styles.chipTextSelected]}>{text}</Text>
    </TouchableOpacity>
  );

  return (
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

    <View style={styles.choiceGroup}>
      <Text style={fieldStyles.label}>
        ¿Qué eres en el campus?<Text style={{ color: theme.colors.secondary }}> *</Text>
      </Text>
      <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel="Estudiante o trabajador">
        {choiceButton('estudiante', 'Estudiante', form.occupation === 'estudiante', () => chooseOccupation('estudiante'), !!errors.occupation)}
        {choiceButton('trabajador', 'Trabajador', form.occupation === 'trabajador', () => chooseOccupation('trabajador'), !!errors.occupation)}
      </View>
      {errors.occupation ? <Text style={styles.error}>{errors.occupation}</Text> : null}
    </View>

    {form.occupation === 'estudiante' ? (
      <>
        {options.student.institutions.length > 1 ? (
          <SelectField
            accent={accent}
            label="Universidad"
            required
            value={studentInstitution}
            options={options.student.institutions}
            onSelect={(v) => {
              if (v === form.institution) return;
              onChange('institution', v);
              onChange('career', '');
            }}
            placeholder="Elige tu universidad"
            error={errors.institution}
          />
        ) : null}

        <SelectField
          accent={accent}
          label={`Carrera (${studentInstitution})`}
          required
          value={form.career}
          options={careers}
          onSelect={(v) => onChange('career', v)}
          placeholder="Elige tu carrera"
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
            {options.student.semesters.map((option) => {
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
      </>
    ) : null}

    {form.occupation === 'trabajador' ? (
      <>
        <View style={styles.choiceGroup}>
          <Text style={fieldStyles.label}>
            Institución donde trabajas<Text style={{ color: theme.colors.secondary }}> *</Text>
          </Text>
          <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel="Institución">
            {options.worker.institutions.map((institution) =>
              choiceButton(institution, institution, form.institution === institution, () => chooseWorkerInstitution(institution), !!errors.institution)
            )}
          </View>
          {errors.institution ? <Text style={styles.error}>{errors.institution}</Text> : null}
        </View>

        {form.institution ? (
          <SelectField
            accent={accent}
            label={`Área (${form.institution})`}
            required
            value={form.work_area}
            options={areas}
            onSelect={(v) => onChange('work_area', v)}
            placeholder="Elige tu área de trabajo"
            error={errors.work_area}
          />
        ) : null}
      </>
    ) : null}

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
};

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
  choiceGroup: {
    marginBottom: 16,
  },
  // Botones iguales, lado a lado (Estudiante / Trabajador, UNC / IVIC).
  choiceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  choice: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBgStrong,
  },
  choiceText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textSecondary,
    fontSize: 16,
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
