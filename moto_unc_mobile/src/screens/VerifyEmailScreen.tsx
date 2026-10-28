/**
 * VerifyEmailScreen.tsx — Verifica tu correo de Gmail
 *
 * LITHIO solo deja entrar cuentas reales: el usuario abre el enlace que le
 * llegó a Gmail y vuelve a la app. Se comprueba al tocar "Ya lo verifiqué" y
 * también solo, cada vez que la app vuelve al frente.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { theme, themed } from '../constants/theme';
import { Icon } from '../components/ui/Icon';
import { GlassSurface } from '../components/ui/GlassSurface';
import { PrimaryButton } from '../components/brand/PrimaryButton';
import { PressableScale } from '../components/brand/PressableScale';
import {
  currentAccountEmail,
  refreshEmailVerified,
  sendVerificationEmail,
  verificationCooldownSeconds,
} from '../services/auth';

interface Props {
  accent?: string;
  onVerified: () => void;
  onUseOtherAccount: () => void;
}

export const VerifyEmailScreen: React.FC<Props> = ({ accent = theme.colors.primary, onVerified, onUseOtherAccount }) => {
  const email = currentAccountEmail();
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Al abrir la pantalla se envía el enlace (si no se envió hace menos de 1 min).
  useEffect(() => {
    void sendVerificationEmail().then(() => setCooldown(verificationCooldownSeconds()));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(verificationCooldownSeconds()), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const check = useCallback(
    async (silent = false) => {
      setChecking(true);
      try {
        if (await refreshEmailVerified()) {
          onVerified();
          return;
        }
        if (!silent) setNote('Todavía no vemos tu correo verificado. Abre el enlace del mensaje y vuelve a intentarlo.');
      } catch {
        if (!silent) setNote('No pudimos comprobarlo. Revisa tu conexión e inténtalo de nuevo.');
      } finally {
        setChecking(false);
      }
    },
    [onVerified]
  );

  // Al volver de Gmail, se comprueba solo.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check(true);
    });
    return () => sub.remove();
  }, [check]);

  const resend = async () => {
    const sent = await sendVerificationEmail(true);
    setCooldown(verificationCooldownSeconds());
    setNote(sent ? 'Te enviamos un enlace nuevo. Puede tardar un minuto en llegar.' : 'Espera un momento antes de pedir otro enlace.');
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)} style={styles.content}>
        <View style={[styles.badge, { backgroundColor: `${accent}1F`, borderColor: `${accent}55` }]}>
          <Icon name="email-outline" size={40} color={accent} />
        </View>
        <Text style={styles.title} accessibilityRole="header">Verifica tu correo</Text>
        <Text style={styles.body}>
          LITHIO solo admite cuentas reales de Gmail. Te enviamos un enlace a{' '}
          <Text style={styles.email}>{email ?? 'tu correo'}</Text>. Ábrelo y vuelve aquí.
        </Text>

        <GlassSurface style={styles.steps} radius={theme.radius.lg}>
          {[
            'Abre Gmail y busca el mensaje de LITHIO (mira también en Spam o Promociones).',
            'Toca el enlace para verificar tu correo.',
            'Regresa a LITHIO: entrarás automáticamente.',
          ].map((text, index) => (
            <View key={text} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: accent }]}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </GlassSurface>

        {note ? <Text style={styles.note} accessibilityLiveRegion="polite">{note}</Text> : null}

        <PrimaryButton label="Ya lo verifiqué" onPress={() => void check()} loading={checking} accent={accent} />
        {/* En Android e iOS el enlace abre la app de Gmail si está instalada. */}
        <PressableScale
          variant="glass"
          accent={accent}
          style={styles.secondary}
          onPress={() => void Linking.openURL('https://mail.google.com/mail/').catch(() => undefined)}
        >
          <Icon name="external-link-outline" size={18} color={theme.colors.textPrimary} />
          <Text style={styles.secondaryText}>Abrir Gmail</Text>
        </PressableScale>
        <PressableScale variant="glass" accent={accent} style={styles.secondary} onPress={() => void resend()} disabled={cooldown > 0}>
          <Icon name="refresh-outline" size={18} color={theme.colors.textPrimary} />
          <Text style={styles.secondaryText}>{cooldown > 0 ? `Reenviar en ${cooldown} s` : 'Reenviar el enlace'}</Text>
        </PressableScale>
        <PressableScale style={styles.link} onPress={onUseOtherAccount}>
          <Text style={styles.linkText}>Usar otra cuenta</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.bgDark,
    padding: 24,
  },
  content: {
    gap: 14,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  badge: {
    alignSelf: 'center',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 24,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  body: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  email: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textPrimary,
  },
  steps: {
    gap: 12,
    padding: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 12,
    color: theme.colors.bgDark,
  },
  stepText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  note: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: theme.colors.warning,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  secondaryText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  link: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
}));
