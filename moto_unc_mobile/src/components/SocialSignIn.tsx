/**
 * SocialSignIn.tsx — Botones "Google" y "Facebook" de las pantallas de inicio
 *
 * Si el usuario ya tiene perfil entra directo (onUser); si es nuevo, pasa al
 * registro con su correo y nombre ya escritos (onNeedsProfile).
 */

import { isEmailVerificationPending } from '../services/emailGate';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { Icon } from './ui/Icon';
import { theme, themed } from '../constants/theme';
import { AuthUser } from '../services/auth';
import {
  PROVIDER_LABEL,
  SocialPrefill,
  SocialProvider,
  signInWithSocial,
  socialUnavailableReason,
} from '../services/socialAuth';
import { PressableScale } from './brand/PressableScale';

interface Props {
  onUser: (user: AuthUser) => void;
  onNeedsProfile: (prefill: SocialPrefill) => void;
  /** Texto bajo los botones antes del formulario de correo. */
  dividerLabel?: string;
}

const ICON: Record<SocialProvider, 'google' | 'facebook'> = { google: 'google', facebook: 'facebook' };

export const SocialSignIn: React.FC<Props> = ({ onUser, onNeedsProfile, dividerLabel = 'o continúa con tu correo' }) => {
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const handlePress = async (provider: SocialProvider) => {
    if (busy) return;
    const reason = socialUnavailableReason(provider);
    if (reason) {
      Alert.alert(`Entrar con ${PROVIDER_LABEL[provider]}`, reason, [{ text: 'Entendido' }]);
      return;
    }
    setBusy(provider);
    try {
      const result = await signInWithSocial(provider);
      if ('user' in result) onUser(result.user);
      else if ('prefill' in result) onNeedsProfile(result.prefill);
    } catch (error) {
      if (isEmailVerificationPending(error)) return;
      Alert.alert('No se pudo entrar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <View style={styles.row}>
        {(['google', 'facebook'] as SocialProvider[]).map((provider) => {
          const pending = socialUnavailableReason(provider) !== null;
          return (
            <PressableScale variant="glass"
              key={provider}
              containerStyle={styles.cell}
              style={styles.button}
              onPress={() => void handlePress(provider)}
              accessibilityRole="button"
              accessibilityLabel={`Entrar con ${PROVIDER_LABEL[provider]}`}
            >
              {busy === provider ? (
                <ActivityIndicator size="small" color={theme.colors.textPrimary} />
              ) : (
                <Icon name={ICON[provider]} size={18} color={theme.colors.textPrimary} />
              )}
              <Text style={styles.label}>{PROVIDER_LABEL[provider]}</Text>
              {pending ? <Text style={styles.soon}>pronto</Text> : null}
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>{dividerLabel}</Text>
        <View style={styles.orLine} />
      </View>
    </>
  );
};

const styles = themed(() => ({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  cell: {
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  label: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  soon: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.glassBorder,
  },
  orText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
}));
