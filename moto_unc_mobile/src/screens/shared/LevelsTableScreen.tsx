/**
 * LevelsTableScreen.tsx — Tabla periódica de niveles (H → Kr)
 *
 * Al abrirla, los elementos alcanzados se encienden uno por uno hasta el
 * tuyo, que queda con un pulso. Los dorados dan beneficios. Toca un
 * elemento para ver cuánto Fe necesita y qué desbloquea.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Icon } from '../../components/ui/Icon';
import Animated, { Easing, FadeIn, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ElementTile } from '../../components/brand/ElementTile';
import { apiService } from '../../services/api';
import type { LevelElement } from '../../utils/elements';

interface Props {
  accent: string;
  onBack: () => void;
}

// Bloques principales (grupos 1, 2 y 13–18) de los períodos 1 a 4, en 8 columnas.
const MAIN_GRID: (number | null)[][] = [
  [1, null, null, null, null, null, null, 2],
  [3, 4, 5, 6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15, 16, 17, 18],
  [19, 20, 31, 32, 33, 34, 35, 36],
];
const TRANSITION_ROW = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export const LevelsTableScreen: React.FC<Props> = ({ accent, onBack }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [elements, setElements] = useState<LevelElement[] | null>(null);
  const [selectedZ, setSelectedZ] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiService
      .getLevels()
      .then((data) => {
        setElements(data.elements);
        setSelectedZ(data.current.z);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la tabla.'));
  }, []);

  const byZ = useMemo(() => new Map((elements || []).map((e) => [e.z, e])), [elements]);
  const contentWidth = Math.min(width, 560) - 40;
  const gap = 4;
  const mainCell = (contentWidth - gap * 7) / 8;
  const transitionCell = (contentWidth - gap * 9) / 10;
  const selected = selectedZ ? byZ.get(selectedZ) : undefined;
  const reached = elements?.filter((e) => e.unlocked).length ?? 0;

  const renderCell = (z: number, size: number) => {
    const element = byZ.get(z);
    if (!element) return <View key={z} style={{ width: size, height: size }} />;
    const isSelected = z === selectedZ;
    const hasPerk = Boolean(element.perk);
    return (
      <Animated.View
        key={z}
        // Los alcanzados se encienden en orden de número atómico.
        entering={(element.unlocked ? ZoomIn.delay(150 + z * 45) : FadeIn.delay(80))
          .duration(260)
          .easing(EASE_OUT)
          .reduceMotion(ReduceMotion.System)}
      >
        <Pressable
          onPress={() => setSelectedZ(z)}
          accessibilityRole="button"
          accessibilityLabel={`${element.name}, ${element.unlocked ? 'alcanzado' : 'bloqueado'}`}
          style={[
            styles.cell,
            { width: size, height: size },
            element.unlocked ? { backgroundColor: `${accent}33` } : styles.locked,
            element.current && { backgroundColor: accent },
            hasPerk && !element.current && styles.perk,
            isSelected && { borderColor: theme.colors.textPrimary, borderWidth: 2 },
          ]}
        >
          <Text style={[styles.cellZ, element.current && styles.onAccent]}>{z}</Text>
          <Text
            style={[
              styles.cellSymbol,
              { fontSize: size * 0.36 },
              !element.unlocked && styles.lockedText,
              element.current && styles.onAccent,
            ]}
          >
            {element.symbol}
          </Text>
          {element.current ? <PulseRing size={size} color={accent} /> : null}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Tabla de niveles" onBack={onBack} />
      {!elements ? (
        error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={styles.loading} color={accent} />
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.summary}>
            Has alcanzado <Text style={{ color: accent }}>{reached}</Text> de 36 elementos
          </Text>
          <View style={styles.legend}>
            <Legend color={`${accent}33`} label="Alcanzado" />
            <Legend color={accent} label="Actual" />
            <Legend color={theme.colors.surface} border={theme.colors.gold} label="Con beneficio" />
          </View>

          <View style={[styles.grid, { gap }]}>
            {MAIN_GRID.map((row, r) => (
              <View key={r} style={[styles.row, { gap }]}>
                {row.map((z, c) => (z ? renderCell(z, mainCell) : <View key={`gap-${r}-${c}`} style={{ width: mainCell, height: mainCell }} />))}
              </View>
            ))}
          </View>

          <Text style={styles.subTitle}>Metales de transición (período 4)</Text>
          <View style={[styles.row, { gap }]}>{TRANSITION_ROW.map((z) => renderCell(z, transitionCell))}</View>

          {selected ? (
            <Animated.View key={selected.z} entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={styles.detail}>
              <ElementTile z={selected.z} symbol={selected.symbol} size={58} accent={selected.perk ? theme.colors.gold : accent} />
              <View style={styles.flex}>
                <Text style={styles.detailName}>{selected.name}</Text>
                <Text style={styles.detailFe}>
                  {selected.unlocked ? 'Alcanzado' : `Necesitas ${selected.threshold} Fe acumulado`}
                </Text>
                <View style={styles.detailPerk}>
                  <Icon
                    name={selected.perk ? (selected.unlocked ? 'gift-outline' : 'lock-outline') : 'atom'}
                    size={16}
                    color={selected.perk ? theme.colors.gold : theme.colors.textMuted}
                  />
                  <Text style={styles.detailPerkText}>{selected.perk || 'Sin beneficio especial: sigue subiendo.'}</Text>
                </View>
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
};

const Legend: React.FC<{ color: string; label: string; border?: string }> = ({ color, label, border }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }, border ? { borderWidth: 1.5, borderColor: border } : null]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

/** Pulso del elemento actual: anillo que crece y se desvanece en bucle. */
const PulseRing: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Animated.View
    pointerEvents="none"
    style={[
      styles.pulse,
      {
        width: size,
        height: size,
        borderColor: color,
        animationName: { from: { transform: [{ scale: 1 }], opacity: 0.9 }, to: { transform: [{ scale: 1.45 }], opacity: 0 } },
        animationDuration: '1600ms',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-out',
      },
    ]}
  />
);

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  loading: {
    marginTop: 48,
  },
  error: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 48,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 14,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
  },
  flex: {
    flex: 1,
  },
  summary: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  grid: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  locked: {
    backgroundColor: theme.colors.surface,
  },
  perk: {
    borderWidth: 1.5,
    borderColor: theme.colors.gold,
  },
  cellZ: {
    position: 'absolute',
    top: 2,
    left: 4,
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    color: theme.colors.textMuted,
  },
  cellSymbol: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  lockedText: {
    color: theme.colors.textMuted,
  },
  onAccent: {
    color: theme.colors.bgDark,
  },
  pulse: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 2,
  },
  subTitle: {
    fontFamily: theme.fonts.medium,
    fontSize: 12.5,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  detail: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    padding: 16,
    marginTop: 6,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  detailName: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  detailFe: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  detailPerk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  detailPerkText: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textPrimary,
  },
}));
