/**
 * TermsGateScreen.tsx — Aceptar los Términos vigentes antes de usar la app
 *
 * Aparece al entrar si la cuenta se creó antes de los Términos o si cambiaron
 * desde la última vez que los aceptó. Sin aceptarlos el servidor tampoco deja
 * pedir viajes, conectarse como conductor ni mover diamantes.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/ui/Icon';
import { theme, themed } from '../constants/theme';
import { PrimaryButton } from '../components/brand/PrimaryButton';
import { openPrivacy, openTerms } from '../components/LegalNotice';
import { acceptCurrentTerms } from '../services/auth';

interface Props {
  accent: string;
  firstTime: boolean;
  onAccepted: () => void;
  onSignOut: () => void;
}

export const TermsGateScreen: React.FC<Props> = ({ accent, firstTime, onAccepted, onSignOut }) => {
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    setSaving(true);
    try {
      await acceptCurrentTerms();
      onAccepted();
    } catch (error) {
      Alert.alert('No se pudo guardar tu aceptación', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
    >
      <Icon name="shield-outline" size={56} color={accent} />
      <Text style={styles.title} accessibilityRole="header">
        {firstTime ? 'Términos y Condiciones' : 'Actualizamos los Términos'}
      </Text>
      <Text style={styles.body}>
        Para seguir usando LITHIO necesitamos que leas y aceptes los Términos y Condiciones y la Política de
        privacidad. Explican qué puedes esperar de la app, tus responsabilidades como pasajero o conductor, cómo
        funcionan los pagos y los diamantes, y qué hacemos con tus datos.
      </Text>

      <View style={styles.links}>
        <DocLink label="Leer los Términos y Condiciones" accent={accent} onPress={openTerms} />
        <DocLink label="Leer la Política de privacidad" accent={accent} onPress={openPrivacy} />
      </View>

      <PrimaryButton label="Acepto los Términos y la Política" onPress={accept} loading={saving} accent={accent} style={styles.button} />
      <Pressable onPress={onSignOut} style={styles.signOut} accessibilityRole="button" hitSlop={8}>
        <Icon name="log-out-outline" size={18} color={theme.colors.textSecondary} />
        <Text style={styles.signOutText}>No acepto · Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
};

const DocLink: React.FC<{ label: string; accent: string; onPress: () => void }> = ({ label, accent, onPress }) => (
  <Pressable onPress={onPress} style={styles.docLink} accessibilityRole="link">
    <Icon name="file-text-outline" size={22} color={accent} />
    <Text style={[styles.docLinkText, { color: accent }]}>{label}</Text>
    <Icon name="external-link-outline" size={18} color={theme.colors.textSecondary} />
  </Pressable>
);

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  links: {
    alignSelf: 'stretch',
    gap: 10,
  },
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  docLinkText: {
    flex: 1,
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  signOutText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
}));
