/**
 * RequestSheet.tsx — Solicitud entrante del conductor como hoja inferior
 *
 * Sube desde abajo sobre el inicio atenuado, con 25 s para responder. Si el
 * tiempo se acaba la hoja se cierra, pero la solicitud sigue en la bandeja.
 */

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Icon } from '../ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { Avatar } from '../ui/Avatar';
import { PressableScale } from '../brand/PressableScale';
import type { Ride } from '../../types';

const RESPONSE_SECONDS = 25;
const PAYMENT_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  diamantes: 'Diamantes',
};

interface Props {
  ride: Ride | null;
  busy: boolean;
  onAccept: (ride: Ride) => void;
  onReject: (ride: Ride) => void;
  onDismiss: () => void;
}

export const RequestSheet: React.FC<Props> = ({ ride, busy, onAccept, onReject, onDismiss }) => {
  const insets = useSafeAreaInsets();
  const [seconds, setSeconds] = useState(RESPONSE_SECONDS);

  useEffect(() => {
    if (!ride) return;
    setSeconds(RESPONSE_SECONDS);
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [ride?.id]);

  useEffect(() => {
    if (ride && seconds <= 0) onDismiss();
  }, [seconds, ride, onDismiss]);

  if (!ride) return null;
  const diamonds = ride.payment_method === 'diamantes';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityLabel="Cerrar solicitud" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.kicker}>Nueva solicitud</Text>
            <Text style={styles.muted}>Responde en {Math.max(seconds, 0)} s</Text>
          </View>
          <View style={styles.timer} accessibilityLabel={`${seconds} segundos para responder`}>
            <Text style={styles.timerText}>{Math.max(seconds, 0)}</Text>
          </View>
        </View>

        <View style={styles.passenger}>
          <Avatar name={ride.passenger_name || 'Pasajero'} size={44} ringColor={theme.colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.passengerName} numberOfLines={1}>{ride.passenger_name || 'Pasajero'}</Text>
            <Text style={styles.muted}>{ride.is_scheduled ? `Programado · ${ride.scheduled_time}` : 'Para ahora'}</Text>
          </View>
        </View>

        <View style={styles.route}>
          <View style={styles.stops}>
            <View style={[styles.stopDot, { backgroundColor: theme.colors.primary }]} />
            <View style={styles.stopLine} />
            <View style={[styles.stopDot, { backgroundColor: theme.colors.secondary }]} />
          </View>
          <View style={styles.places}>
            <Text style={styles.place} numberOfLines={1}>{ride.origin}</Text>
            <Text style={styles.place} numberOfLines={1}>{ride.destination}</Text>
          </View>
        </View>

        <View style={styles.fareRow}>
          <View style={styles.paymentTag}>
            <Icon
              name={diamonds ? 'award-outline' : ride.payment_method === 'pago_movil' ? 'smartphone-outline' : 'pricetags-outline'}
              size={16}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.paymentText}>{PAYMENT_LABEL[ride.payment_method] || ride.payment_method}</Text>
          </View>
          <Text style={[styles.fare, diamonds && { color: theme.colors.diamond }]}>
            {diamonds ? '◆' : '$'} {ride.fare_amount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.actions}>
          <PressableScale variant="glass"
            containerStyle={styles.flex}
            style={styles.reject}
            disabled={busy}
            onPress={() => onReject(ride)}
            accessibilityLabel="Rechazar solicitud"
          >
            <Text style={styles.rejectText}>Rechazar</Text>
          </PressableScale>
          <PressableScale variant="solid" accent={theme.colors.secondary}
            containerStyle={styles.acceptCell}
            style={styles.accept}
            disabled={busy}
            onPress={() => onAccept(ride)}
            accessibilityLabel="Aceptar viaje"
          >
            {busy ? <ActivityIndicator color={theme.colors.onSecondary} /> : <Text style={styles.acceptText}>Aceptar viaje</Text>}
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
};

const styles = themed(() => ({
  flex: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kicker: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.secondary,
  },
  muted: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  timer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  passenger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passengerName: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  route: {
    flexDirection: 'row',
    gap: 12,
  },
  stops: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stopLine: {
    width: 2,
    height: 18,
    backgroundColor: theme.colors.cardBorder,
  },
  places: {
    flex: 1,
    gap: 10,
  },
  place: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  paymentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  fare: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    color: theme.colors.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptCell: {
    flex: 1.6,
  },
  reject: {
    height: 54,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  rejectText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  accept: {
    height: 54,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
  },
  acceptText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.onSecondary,
  },
}));
