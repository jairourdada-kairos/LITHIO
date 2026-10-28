/**
 * TripsScreen.tsx — Viajes: historial y agendados en una sola pestaña
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, BackHandler } from 'react-native';
import { theme, themed } from '../../constants/theme';
import { RidesListScreen } from './RidesListScreen';
import { RideDetailScreen } from './RideDetailScreen';
import type { SessionRole } from '../../services/session';

interface Props {
  role: SessionRole;
  reloadKey: number;
  accent: string;
  onScheduleTrip?: () => void;
}

export const TripsScreen: React.FC<Props> = ({ role, reloadKey, accent, onScheduleTrip }) => {
  const [scope, setScope] = useState<'history' | 'scheduled'>('history');
  const [openRideId, setOpenRideId] = useState<number | null>(null);

  // El botón atrás de Android cierra el detalle antes que la pestaña.
  useEffect(() => {
    if (openRideId === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpenRideId(null);
      return true;
    });
    return () => sub.remove();
  }, [openRideId]);

  if (openRideId !== null) {
    return <RideDetailScreen rideId={openRideId} accent={accent} onBack={() => setOpenRideId(null)} />;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Viajes</Text>
      <View style={styles.segment} accessibilityRole="tablist">
        {(['history', 'scheduled'] as const).map((value) => {
          const selected = scope === value;
          return (
            <Pressable
              key={value}
              onPress={() => setScope(value)}
              style={[styles.segmentItem, selected && { backgroundColor: accent }]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                {value === 'history' ? 'Historial' : 'Agendados'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <RidesListScreen
        key={scope}
        scope={scope}
        role={role}
        reloadKey={reloadKey}
        onPrimaryAction={onScheduleTrip}
        onOpenRide={setOpenRideId}
        hideHeader
      />
    </View>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    paddingTop: 12,
    gap: 14,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 26,
    color: theme.colors.textPrimary,
    paddingHorizontal: 20,
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: theme.colors.onPrimary,
  },
}));
