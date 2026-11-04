/**
 * DemandHoursCard.tsx — Cuándo te necesitan
 *
 * Barras por hora con los pedidos de las últimas dos semanas: el conductor ve
 * a qué hora le conviene conectarse. Una sola serie, así que el título la
 * nombra y no hace falta leyenda; la barra de la hora actual va resaltada.
 * Con pocos datos no se muestra: un gráfico casi vacío no ayuda a decidir.
 */

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { theme, themed } from '../../constants/theme';
import type { DemandHours } from '../../services/api';

const MIN_TOTAL = 5;
const CHART_HEIGHT = 76;
const AXIS_HOURS = [6, 12, 18];

const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export const DemandHoursCard: React.FC<{ data: DemandHours | null }> = ({ data }) => {
  const [selected, setSelected] = useState<number | null>(null);
  if (!data || data.total < MIN_TOTAL) return null;

  const accent = theme.colors.secondary;
  const peak = data.hours.reduce((best, item) => (item.requests > best.requests ? item : best), data.hours[0]);
  const picked = data.hours.find((item) => item.hour === selected);

  return (
    <View
      style={styles.card}
      accessible={selected === null}
      accessibilityLabel={`Cuándo te necesitan. Más pedidos a las ${clock(peak.hour)}, con ${peak.requests} en dos semanas.`}
    >
      <Text style={styles.title}>Cuándo te necesitan</Text>
      <Text style={styles.caption}>
        {picked ? `${clock(picked.hour)}: ${picked.requests} ${picked.requests === 1 ? 'pedido' : 'pedidos'} en dos semanas` : `Más pedidos a las ${clock(peak.hour)}`}
      </Text>
      <View style={styles.chart}>
        {data.hours.map((item) => {
          const isNow = item.hour === data.current_hour;
          const isPicked = item.hour === selected;
          return (
            <Pressable
              key={item.hour}
              style={styles.column}
              onPress={() => setSelected(isPicked ? null : item.hour)}
              accessibilityRole="button"
              accessibilityLabel={`${clock(item.hour)}: ${item.requests} pedidos`}
            >
              <View
                style={[
                  styles.bar,
                  { height: Math.max(3, (item.requests / Math.max(peak.requests, 1)) * CHART_HEIGHT) },
                  isNow || isPicked
                    ? { backgroundColor: accent, boxShadow: `0 0 10px ${accent}80` }
                    : { backgroundColor: `${accent}59` },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {AXIS_HOURS.map((hour) => (
          <Text key={hour} style={styles.axisLabel}>{clock(hour)}</Text>
        ))}
      </View>
    </View>
  );
};

const styles = themed(() => ({
  card: {
    padding: 16,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.surface,
    backgroundImage: theme.fx.sheen,
    boxShadow: theme.glass.shadow,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  caption: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: CHART_HEIGHT,
  },
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 6,
  },
  axisLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
}));
