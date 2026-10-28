/**
 * RecoverySheet.tsx — Recuperar la cuenta
 *
 * - Olvidé mi contraseña: con el correo, Firebase envía un enlace para crear
 *   una contraseña nueva.
 * - Olvidé mi correo: con la cédula o con el número de teléfono, el servidor
 *   muestra el correo de la cuenta parcialmente oculto y le envía el mismo enlace.
 */

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Icon } from './ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../constants/theme';
import { FormField } from './FormField';
import { PrimaryButton } from './brand/PrimaryButton';
import { friendlyMessage } from './ui/Feedback';
import { recoverAccount, sendPasswordReset } from '../services/auth';
import { validateEmail } from '../utils/validation';

type Mode = 'password' | 'email';
type Lookup = 'cedula' | 'phone';

interface Props {
  visible: boolean;
  accent: string;
  /** Correo ya escrito en el formulario de inicio de sesión. */
  initialEmail?: string;
  onClose: () => void;
}

export const RecoverySheet: React.FC<Props> = ({ visible, accent, initialEmail, onClose }) => {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [cedula, setCedula] = useState('');
  const [lookup, setLookup] = useState<Lookup>('cedula');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode('password');
    setEmail(initialEmail ?? '');
    setCedula('');
    setPhone('');
    setLookup('cedula');
    setError(undefined);
    setDone(null);
  }, [visible, initialEmail]);

  if (!visible) return null;

  const submit = async () => {
    setError(undefined);
    if (mode === 'password') {
      const invalid = validateEmail(email);
      if (invalid) {
        setError(invalid);
        return;
      }
    } else if (lookup === 'cedula' && cedula.replace(/\D/g, '').length < 6) {
      setError('Escribe tu cédula, por ejemplo V-12345678.');
      return;
    } else if (lookup === 'phone' && phone.replace(/\D/g, '').length < 10) {
      setError('Escribe tu celular, por ejemplo 0412-1234567 o +58 412 1234567.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'password') {
        await sendPasswordReset(email.trim());
        setDone(`Si ${email.trim()} tiene una cuenta en LITHIO, te llegará un correo con un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.`);
      } else {
        const masked = await recoverAccount(lookup === 'cedula' ? { cedula: cedula.trim() } : { phone: phone.trim() });
        setDone(
          masked.length > 1
            ? `Ese teléfono está en ${masked.length} cuentas: ${masked.join(', ')}. Enviamos a cada correo un enlace para crear una contraseña nueva; entra con el tuyo.`
            : `Tu correo de LITHIO es ${masked[0]}. Te enviamos ahí un enlace para crear una contraseña nueva; después entra con ese correo.`
        );
      }
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>Recuperar tu cuenta</Text>

            {done ? (
              <>
                <View style={styles.doneRow}>
                  <Icon name="email-outline" size={28} color={theme.colors.success} />
                  <Text style={[styles.message, styles.flex]}>{done}</Text>
                </View>
                <PrimaryButton label="Volver a iniciar sesión" onPress={onClose} accent={accent} />
              </>
            ) : (
              <>
                <View style={styles.segment} accessibilityRole="tablist">
                  {(['password', 'email'] as Mode[]).map((value) => {
                    const selected = mode === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => {
                          setMode(value);
                          setError(undefined);
                        }}
                        style={[styles.segmentItem, selected && { backgroundColor: accent }]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                          {value === 'password' ? 'Olvidé mi contraseña' : 'Olvidé mi correo'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {mode === 'password' ? (
                  <>
                    <Text style={styles.message}>Escribe el correo con el que te registraste y te enviamos un enlace para crear una contraseña nueva.</Text>
                    <FormField
                      label="Correo electrónico"
                      placeholder="tu@correo.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      value={email}
                      onChangeText={setEmail}
                      error={error}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.message}>Identifícate con tu cédula o con el celular de tu cuenta. Te mostraremos tu correo (parcialmente oculto, por seguridad) y te enviaremos ahí el enlace para cambiar la contraseña.</Text>
                    <View style={styles.lookupRow} accessibilityRole="radiogroup">
                      {([
                        { value: 'cedula', label: 'Con mi cédula', icon: 'credit-card-outline' },
                        { value: 'phone', label: 'Con mi teléfono', icon: 'phone-outline' },
                      ] as const).map((option) => {
                        const selected = lookup === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              setLookup(option.value);
                              setError(undefined);
                            }}
                            style={[styles.lookupChip, selected && { borderColor: accent, backgroundColor: `${accent}1F` }]}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                          >
                            <Icon name={option.icon} size={16} color={selected ? accent : theme.colors.textSecondary} />
                            <Text style={[styles.lookupText, selected && { color: accent }]}>{option.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {lookup === 'cedula' ? (
                      <FormField
                        label="Cédula"
                        placeholder="V-12345678"
                        autoCapitalize="characters"
                        value={cedula}
                        onChangeText={setCedula}
                        error={error}
                        maxLength={14}
                        accent={accent}
                      />
                    ) : (
                      <FormField
                        label="Celular de tu cuenta"
                        placeholder="0412-1234567 o +58 412 1234567"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                        value={phone}
                        onChangeText={setPhone}
                        error={error}
                        maxLength={17}
                        accent={accent}
                      />
                    )}
                  </>
                )}
                <PrimaryButton label="Enviar enlace" onPress={submit} loading={loading} accent={accent} />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = themed(() => ({
  flex: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: theme.colors.bgDark,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.cardBorder,
    marginBottom: 12,
  },
  content: {
    gap: 14,
    paddingBottom: 8,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  message: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  segment: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
  },
  segmentText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: theme.colors.bgDark,
  },
  lookupRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lookupChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  lookupText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  doneRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
}));
