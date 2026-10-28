/**
 * NotificationPrimer.tsx — Invitación a activar las notificaciones
 *
 * Se muestra antes del aviso del sistema para explicar para qué sirven, según
 * el rol. "Ahora no" no vuelve a preguntar en 7 días; se pueden activar
 * siempre desde Cuenta → Notificaciones.
 */

import React, { useState } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, themed } from '../constants/theme';
import { PrimaryButton } from './brand/PrimaryButton';
import type { SessionRole } from '../services/session';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const BENEFITS: Record<SessionRole, { icon: IconName; text: string }[]> = {
  conductor: [
    { icon: 'bell-ring-outline', text: 'Nuevas solicitudes de viaje al instante, aunque tengas la app cerrada' },
    { icon: 'receipt-text-check-outline', text: 'Cuando un pasajero adjunta su comprobante de Pago Móvil' },
    { icon: 'wallet-outline', text: 'Retiros y canjes del taller aprobados' },
  ],
  pasajero: [
    { icon: 'motorbike', text: 'Cuando tu conductor acepta y va en camino' },
    { icon: 'map-marker-check-outline', text: 'Al llegar a tu destino, con el Fe que ganaste' },
    { icon: 'diamond-stone', text: 'Recargas aprobadas y diamantes que te envían tus enlaces' },
  ],
};

interface Props {
  visible: boolean;
  role: SessionRole;
  onActivate: () => Promise<void>;
  onLater: () => void;
}

export const NotificationPrimer: React.FC<Props> = ({ visible, role, onActivate, onLater }) => {
  const [busy, setBusy] = useState(false);
  if (!visible) return null;
  const accent = role === 'conductor' ? theme.colors.secondary : theme.colors.primary;

  const activate = async () => {
    setBusy(true);
    try {
      await onActivate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onLater} statusBarTranslucent>
      <View style={styles.scrim}>
        <Animated.View entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)} style={[styles.card, { borderColor: accent }]}>
          <View style={[styles.bell, { backgroundColor: theme.colors.surface }]}>
            <MaterialCommunityIcons name="bell-badge-outline" size={34} color={accent} />
          </View>
          <Text style={styles.title}>Activa tus avisos de LITHIO</Text>
          <Text style={styles.subtitle}>Te avisamos solo de lo importante:</Text>
          <View style={styles.list}>
            {BENEFITS[role].map((item) => (
              <View key={item.text} style={styles.item}>
                <MaterialCommunityIcons name={item.icon} size={22} color={accent} />
                <Text style={styles.itemText}>{item.text}</Text>
              </View>
            ))}
          </View>
          <PrimaryButton label="Activar notificaciones" onPress={activate} loading={busy} accent={accent} style={styles.button} />
          <Pressable onPress={onLater} hitSlop={10} accessibilityRole="button" style={styles.later}>
            <Text style={styles.laterText}>Ahora no</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = themed(() => ({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.scrim,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    padding: 24,
    gap: 10,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    backgroundColor: theme.colors.bgDark,
  },
  bell: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  list: {
    alignSelf: 'stretch',
    gap: 12,
    marginVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemText: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
  later: {
    paddingVertical: 8,
  },
  laterText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
}));
