/**
 * ProfileScreen.tsx — Mis datos
 *
 * Nombre, apellido, correo y teléfono se pueden cambiar una vez cada 7 días
 * (el servidor lo hace cumplir). La foto se cambia cuando quieras desde la
 * cuenta. La cédula llega enmascarada y no se edita aquí.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Avatar } from '../../components/ui/Avatar';
import { roleColors } from '../../components/ui/RoleBadge';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/brand/PrimaryButton';
import { apiService, MyProfile } from '../../services/api';
import { normalizePhone, validateEmail, validatePersonName, validatePhone } from '../../utils/validation';
import type { AuthUser } from '../../services/auth';
import type { SessionRole } from '../../services/session';

interface Props {
  user: AuthUser;
  role: SessionRole;
  onBack: () => void;
  /** Refleja los datos nuevos en el resto de la app. */
  onUserChanged?: (changes: Partial<AuthUser>) => void;
}

type Draft = { name: string; last_name: string; email: string; phone: string };
type Errors = Partial<Record<keyof Draft, string>>;

function formatWhen(iso: string): string {
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  return date.toLocaleString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export const ProfileScreen: React.FC<Props> = ({ user, role, onBack, onUserChanged }) => {
  const insets = useSafeAreaInsets();
  const accent = roleColors(role).accent;
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({ name: '', last_name: '', email: '', phone: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiService.getMyProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  const current = {
    name: profile?.name ?? user.name,
    last_name: profile?.last_name ?? user.last_name ?? '',
    email: profile?.email ?? user.email,
    phone: profile?.phone ?? user.phone,
  };
  const fullName = [current.name, current.last_name].filter(Boolean).join(' ');
  const locked = Boolean(profile?.next_edit_at);

  const startEditing = () => {
    if (profile?.next_edit_at) {
      Alert.alert('Aún no puedes editar tus datos', `Solo se pueden cambiar una vez cada 7 días. Podrás hacerlo de nuevo el ${formatWhen(profile.next_edit_at)}.`);
      return;
    }
    setDraft(current);
    setErrors({});
    setEditing(true);
  };

  const save = () => {
    const nextErrors: Errors = {
      name: validatePersonName(draft.name, 'El nombre'),
      last_name: validatePersonName(draft.last_name, 'El apellido'),
      email: validateEmail(draft.email),
      phone: validatePhone(draft.phone),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const changes: Partial<Draft> = {};
    if (draft.name.trim() !== current.name) changes.name = draft.name.trim();
    if (draft.last_name.trim() !== current.last_name) changes.last_name = draft.last_name.trim();
    if (draft.email.trim().toLowerCase() !== current.email.toLowerCase()) changes.email = draft.email.trim();
    if (normalizePhone(draft.phone) !== current.phone) changes.phone = draft.phone;
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }

    Alert.alert(
      '¿Guardar tus datos?',
      'Después de guardar no podrás volver a cambiarlos durante 7 días. Tu foto sí la puedes cambiar cuando quieras.',
      [
        { text: 'Revisar', style: 'cancel' },
        {
          text: 'Guardar',
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await apiService.updateMyProfile(changes);
              setProfile(updated);
              setEditing(false);
              onUserChanged?.({
                name: updated.name,
                last_name: updated.last_name ?? undefined,
                email: updated.email,
                phone: updated.phone,
              });
              Alert.alert(
                'Datos guardados',
                changes.email ? `Desde ahora inicia sesión con ${updated.email}.` : 'Tus datos quedaron actualizados.'
              );
            } catch (error) {
              Alert.alert('No se pudieron guardar tus datos', error instanceof Error ? error.message : 'Intenta de nuevo.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const readOnly: [string, string | undefined][] = [
    ['Nombres', current.name],
    ['Apellidos', current.last_name],
    ['Correo electrónico', current.email],
    ['Teléfono', current.phone],
    ['Cédula', user.cedula],
    ['Carrera', user.career],
    ['Semestre', user.semester],
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Mis datos"
        onBack={editing ? () => setEditing(false) : onBack}
        right={
          !editing ? (
            <Pressable onPress={startEditing} hitSlop={10} accessibilityRole="button" accessibilityLabel="Editar mis datos">
              <Text style={[styles.edit, { color: locked ? theme.colors.textMuted : accent }]}>Editar</Text>
            </Pressable>
          ) : null
        }
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.avatar}>
            <Avatar name={fullName} uri={user.avatar_url} size={96} ringColor={accent} />
          </View>

          {editing ? (
            <View style={styles.form}>
              <FormField label="Nombres" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} error={errors.name} />
              <FormField label="Apellidos" value={draft.last_name} onChangeText={(last_name) => setDraft({ ...draft, last_name })} error={errors.last_name} />
              <FormField
                label="Correo electrónico"
                value={draft.email}
                onChangeText={(email) => setDraft({ ...draft, email })}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                hint="Si lo cambias, desde entonces inicias sesión con el nuevo."
              />
              <FormField
                label="Teléfono"
                value={draft.phone}
                onChangeText={(phone) => setDraft({ ...draft, phone })}
                error={errors.phone}
                keyboardType="phone-pad"
                placeholder="0414-1234567"
              />
              <PrimaryButton label="Guardar cambios" onPress={save} loading={saving} accent={accent} />
              <Text style={styles.note}>Puedes cambiar estos datos una vez cada 7 días. La cédula no se edita; para corregirla, escribe al administrador.</Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                {readOnly.map(([label, value], index) => (
                  <View key={label} style={[styles.row, index > 0 && styles.divider]}>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={[styles.value, !value && styles.missing]} numberOfLines={1}>
                      {value || 'Sin registrar'}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.note}>
                {profile?.next_edit_at
                  ? `Podrás editar tus datos de nuevo el ${formatWhen(profile.next_edit_at)}. Tu foto la puedes cambiar cuando quieras desde tu cuenta.`
                  : 'Puedes editar tu nombre, correo y teléfono una vez cada 7 días. Tu cédula, teléfono y datos de pago se guardan cifrados.'}
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 20,
  },
  avatar: {
    alignItems: 'center',
    marginTop: 8,
  },
  edit: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
  },
  form: {
    gap: 14,
  },
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  value: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  missing: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textMuted,
  },
  note: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
}));
