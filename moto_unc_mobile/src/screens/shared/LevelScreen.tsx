/**
 * LevelScreen.tsx — "Tu nivel": qué significa tu elemento y qué sigue
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { OrbitingElement } from '../../components/brand/OrbitingElement';
import { ElementTile } from '../../components/brand/ElementTile';
import { PressableScale } from '../../components/brand/PressableScale';
import { electronConfiguration, Level, levelProgress } from '../../utils/elements';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  level: Level;
  accent: string;
  onBack: () => void;
  onOpenTable: () => void;
}

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const enter = (index: number) =>
  FadeInDown.duration(320).delay(100 + index * 60).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

const REASONS: { icon: IconName; color: 'primary' | 'gold' | 'secondary'; text: string }[] = [
  { icon: 'atom-variant', color: 'primary', text: 'Cada viaje completado, reseña útil y Reacción del día te da Fe. Con tu Fe subes por la tabla periódica.' },
  { icon: 'gift-outline', color: 'gold', text: 'Algunos elementos desbloquean beneficios: cupones, insignias y ventajas dentro de LITHIO.' },
  { icon: 'shield-check-outline', color: 'secondary', text: 'Tu elemento muestra a la comunidad tu experiencia y compromiso viajando con LITHIO.' },
];

export const LevelScreen: React.FC<Props> = ({ level, accent, onBack, onOpenTable }) => {
  const insets = useSafeAreaInsets();
  const progress = levelProgress(level);
  const missing = level.next_threshold ? level.next_threshold - level.fe_lifetime : 0;
  const nextPerk = level.next_perk;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Tu nivel" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <OrbitingElement z={level.z} symbol={level.symbol} name={level.name} size={230} accent={accent} />
          <Text style={styles.levelName}>{level.name}</Text>
          <Text style={[styles.config, { color: accent }]}>
            {electronConfiguration(level.z)} · {level.fe_lifetime} Fe
          </Text>
        </View>

        <Animated.View entering={enter(0)} style={styles.card}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {level.next_name ? `${missing} Fe para ${level.next_name}` : 'Nivel máximo alcanzado'}
            </Text>
            <Text style={styles.progressPct}>{Math.round(progress * 100)} %</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: accent }]} />
          </View>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.card}>
          <Text style={styles.cardTitle}>¿Para qué sirven los niveles?</Text>
          {REASONS.map((reason) => (
            <View key={reason.icon} style={styles.reason}>
              <MaterialCommunityIcons name={reason.icon} size={20} color={theme.colors[reason.color]} />
              <Text style={styles.reasonText}>{reason.text}</Text>
            </View>
          ))}
        </Animated.View>

        {nextPerk ? (
          <Animated.View entering={enter(2)} style={[styles.card, styles.perkCard]}>
            <ElementTile z={nextPerk.z} symbol={nextPerk.symbol} size={48} accent={theme.colors.gold} />
            <View style={styles.flex}>
              <Text style={styles.perkTitle}>Próximo beneficio: {nextPerk.name}</Text>
              <Text style={styles.perkBody}>{nextPerk.perk}</Text>
            </View>
            <Text style={styles.perkFe}>{nextPerk.threshold} Fe</Text>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter(3)}>
          <PressableScale style={[styles.button, { backgroundColor: accent }]} onPress={onOpenTable} accessibilityLabel="Ver la tabla de niveles">
            <MaterialCommunityIcons name="table-large" size={20} color={theme.colors.bgDark} />
            <Text style={styles.buttonText}>Ver la tabla de niveles</Text>
          </PressableScale>
        </Animated.View>
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
    gap: 16,
  },
  flex: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  levelName: {
    fontFamily: theme.fonts.bold,
    fontSize: 28,
    color: theme.colors.textPrimary,
    marginTop: 8,
  },
  config: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  progressPct: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  track: {
    height: 10,
    borderRadius: 5,
    marginTop: 10,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  cardTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 10,
  },
  reasonText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  perkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderColor: theme.colors.goldSoft,
  },
  perkTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 14.5,
    color: theme.colors.textPrimary,
  },
  perkBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  perkFe: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: theme.colors.gold,
  },
  button: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 54,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.bgDark,
  },
}));
