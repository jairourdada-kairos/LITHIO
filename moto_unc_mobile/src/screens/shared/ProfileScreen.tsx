/**
 * ProfileScreen.tsx — Mis datos
 *
 * Solo lectura por ahora. La cédula llega enmascarada desde el backend.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Avatar } from '../../components/ui/Avatar';
import { roleColors } from '../../components/ui/RoleBadge';
import type { AuthUser } from '../../services/auth';
import type { SessionRole } from '../../services/session';

interface Props {
  user: AuthUser;
  role: SessionRole;
  onBack: () => void;
}

export const ProfileScreen: React.FC<Props> = ({ user, role, onBack }) => {
  const insets = useSafeAreaInsets();
  const fullName = [user.name, user.last_name].filter(Boolean).join(' ');
  const fields: [string, string | undefined][] = [
    ['Nombres', user.name],
    ['Apellidos', user.last_name],
    ['Correo electrónico', user.email],
    ['Teléfono', user.phone],
    ['Cédula', user.cedula],
    ['Carrera', user.career],
    ['Semestre', user.semester],
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Mis datos" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.avatar}>
          <Avatar name={fullName} uri={user.avatar_url} size={96} ringColor={roleColors(role).accent} />
        </View>
        <View style={styles.card}>
          {fields.map(([label, value], index) => (
            <View key={label} style={[styles.row, index > 0 && styles.divider]}>
              <Text style={styles.label}>{label}</Text>
              <Text style={[styles.value, !value && styles.missing]} numberOfLines={1}>
                {value || 'Sin registrar'}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Tu cédula, teléfono y datos de pago se guardan cifrados. Para corregir un dato, contacta al administrador de LITHIO.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 20,
  },
  avatar: {
    alignItems: 'center',
    marginTop: 8,
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
