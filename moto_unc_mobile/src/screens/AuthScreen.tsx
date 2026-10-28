/**
 * AuthScreen.tsx — Pantalla de Bienvenida
 *
 * Primera pantalla que ve el usuario. Identidad "química" de LITHIO: el
 * átomo de litio animado, la retícula cristalina de fondo y tarjetas de
 * vidrio para elegir rol. Pasajero = electrón (turquesa, en movimiento);
 * conductor = protón (coral, la energía del núcleo).
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Icon, IconName } from '../components/ui/Icon';
import Animated, { Easing, FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VersionTag } from '../components/ui/VersionTag';
import { theme, themed } from '../constants/theme';
import { LithiumAtom } from '../components/brand/LithiumAtom';
import { LatticeBackground } from '../components/brand/LatticeBackground';
import { PressableScale } from '../components/brand/PressableScale';

interface Props {
  onSelectPassenger: () => void;
  onSelectDriver: () => void;
  onSelectSignIn: () => void;
  onOpenAbout: () => void;
}

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// Entrada escalonada: cada bloque 50 ms después del anterior, todo listo en < 0.6 s.
const enter = (index: number) =>
  FadeInDown.duration(380)
    .delay(120 + index * 50)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);

const COMMUNITY = ['UNC', 'IVIC', 'San Antonio', 'Caracas'];

export const AuthScreen: React.FC<Props> = ({ onSelectPassenger, onSelectDriver, onSelectSignIn, onOpenAbout }) => {
  const insets = useSafeAreaInsets();
  return (
  <View style={styles.root}>
    <LatticeBackground />

    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(500).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}>
          <LithiumAtom size={176} />
        </Animated.View>

        <Animated.View entering={enter(0)} style={styles.brand}>
          <Text style={styles.wordmark} accessibilityRole="header">
            <Text style={styles.wordmarkAccent}>LI</Text>THIO
          </Text>
          <Text style={styles.acronym}>
            Linked Intelligent Transport for Higher Innovative Opportunities
          </Text>
          <Text style={styles.tagline}>Energía universitaria en movimiento.</Text>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.community}>
          {COMMUNITY.map((place, index) => (
            <React.Fragment key={place}>
              {index > 0 ? <View style={styles.communityDot} /> : null}
              <Text style={styles.communityText}>{place}</Text>
            </React.Fragment>
          ))}
        </Animated.View>

        <Animated.Text entering={enter(2)} style={styles.sectionLabel}>
          ELIGE TU ROL
        </Animated.Text>

        <Animated.View entering={enter(3)} style={styles.fullWidth}>
          <RoleCard
            title="Soy Pasajero"
            description="Pide tu viaje a conductores de confianza de la comunidad"
            icon="book-open-outline"
            particle="e⁻"
            accent={theme.colors.primary}
            soft={theme.colors.primarySoft}
            line={theme.colors.primaryLine}
            onPress={onSelectPassenger}
          />
        </Animated.View>

        <Animated.View entering={enter(4)} style={styles.fullWidth}>
          <RoleCard
            title="Soy Conductor"
            description="Recibe solicitudes, gestiona tus viajes y tus ganancias"
            icon="motorbike"
            particle="p⁺"
            accent={theme.colors.secondary}
            soft={theme.colors.secondarySoft}
            line={theme.colors.secondaryLine}
            onPress={onSelectDriver}
          />
        </Animated.View>

        <Animated.View entering={enter(5)} style={styles.fullWidth}>
          <PressableScale variant="glass" style={styles.signInButton} onPress={onSelectSignIn}>
            <Text style={styles.signInText}>Ya tengo una cuenta · Iniciar sesión</Text>
          </PressableScale>

          <Pressable
            onPress={onOpenAbout}
            style={styles.aboutLink}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Icon name="atom" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.aboutText}>¿Qué es LITHIO?</Text>
          </Pressable>

          <Text style={styles.footerNote}>
            Al registrarte aceptas los Términos de Servicio de la comunidad LITHIO
          </Text>
          <VersionTag />
        </Animated.View>
      </View>
    </ScrollView>
  </View>
  );
};

interface RoleCardProps {
  title: string;
  description: string;
  icon: IconName;
  particle: string;
  accent: string;
  soft: string;
  line: string;
  onPress: () => void;
}

const RoleCard: React.FC<RoleCardProps> = ({ title, description, icon, particle, accent, soft, line, onPress }) => (
  <PressableScale variant="glass" accent={line} style={[styles.roleCard, { borderColor: line }]} onPress={onPress} accessibilityLabel={title}>
    <View style={[styles.roleIcon, { backgroundColor: soft, borderColor: line }]}>
      <Icon name={icon} size={26} color={accent} />
    </View>
    <View style={styles.roleTextGroup}>
      <View style={styles.roleTitleRow}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={[styles.particle, { color: accent, borderColor: line }]}>{particle}</Text>
      </View>
      <Text style={styles.roleDesc}>{description}</Text>
    </View>
    <Icon name="chevron-right-outline" size={22} color={accent} />
  </PressableScale>
);

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  brand: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  wordmark: {
    fontFamily: theme.fonts.bold,
    fontSize: 40,
    color: theme.colors.textPrimary,
    letterSpacing: 8,
    // Compensa el espaciado final para que la palabra quede centrada.
    marginRight: -8,
  },
  wordmarkAccent: {
    color: theme.colors.primary,
  },
  acronym: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 0.4,
    maxWidth: 300,
    lineHeight: 15,
  },
  tagline: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },
  community: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
    marginBottom: 28,
  },
  communityText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    fontSize: 12,
  },
  communityDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.textMuted,
  },
  sectionLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 2,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.glassBg,
    boxShadow: theme.glow.soft,
  },
  roleIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTextGroup: {
    flex: 1,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  roleTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  particle: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 11,
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  roleDesc: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 4,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
    backgroundColor: theme.colors.primarySoft,
  },
  signInText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    fontSize: 15,
  },
  aboutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    minHeight: 44,
    marginTop: 8,
  },
  aboutText: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  footerNote: {
    fontFamily: theme.fonts.regular,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 16,
  },
}));
