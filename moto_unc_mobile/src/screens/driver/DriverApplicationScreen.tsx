/**
 * DriverApplicationScreen.tsx — Estado de la postulación del conductor
 *
 * Registro enviado → revisión de datos → inspección de la moto → luz verde.
 * Se actualiza en vivo (DRIVER_APPLICATION_UPDATED); al aprobarse, la app
 * del conductor se abre sola.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { TopBar } from '../../components/home/TopBar';
import { PressableScale } from '../../components/brand/PressableScale';
import { apiService, DriverApplication, VerificationStatus } from '../../services/api';
import { wsService } from '../../services/websocket';
import type { AuthUser } from '../../services/auth';

interface Props {
  user: AuthUser;
  onApproved: () => void;
  onOpenTutorial: () => void;
  onSignOut: () => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const STEPS: { key: VerificationStatus; title: string; body: string; icon: IconName }[] = [
  { key: 'pendiente', title: 'Postulación enviada', body: 'Recibimos tus datos y los de tu moto.', icon: 'file-document-outline' },
  { key: 'en_revision', title: 'Revisión de datos', body: 'Verificamos tu identidad, licencia y métodos de pago.', icon: 'account-search-outline' },
  { key: 'inspeccion', title: 'Inspección de la moto', body: 'Te contactaremos para revisar tu moto en persona.', icon: 'motorbike' },
  { key: 'aprobado', title: 'Luz verde', body: 'Tu cuenta de conductor queda activa.', icon: 'check-decagram-outline' },
];

export const DriverApplicationScreen: React.FC<Props> = ({ user, onApproved, onOpenTutorial, onSignOut }) => {
  const insets = useSafeAreaInsets();
  const [application, setApplication] = useState<DriverApplication | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await apiService.getDriverApplication();
      setApplication(data);
      if (data.status === 'aprobado') onApproved();
    } catch (error) {
      Alert.alert('No se pudo cargar tu postulación', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setRefreshing(false);
    }
  }, [onApproved]);

  useEffect(() => {
    void load();
    wsService.connect();
    return wsService.subscribe((msg) => {
      if (msg.type === 'DRIVER_APPLICATION_UPDATED' && msg.application) {
        setApplication(msg.application);
        if (msg.application.status === 'aprobado') {
          Alert.alert('¡Luz verde!', 'Tu cuenta de conductor está activa. Bienvenido a LITHIO.', [{ text: 'Empezar', onPress: onApproved }]);
        }
      }
    });
  }, [load, onApproved]);

  const rejected = application?.status === 'rechazado';
  const reached = application ? application.steps.filter((s) => s.done).length : 1;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.colors.secondary} />}
    >
      <TopBar name={user.name} avatarUrl={user.avatar_url} accent={theme.colors.secondary} onPressAvatar={() => {}} />

      <View>
        <Text style={styles.kicker}>p⁺ Postulación de conductor</Text>
        <Text style={styles.title}>{rejected ? 'Postulación no aprobada' : 'Tu cuenta está en revisión'}</Text>
        <Text style={styles.lead}>
          {application?.message || 'Estamos revisando tu postulación. Desliza hacia abajo para actualizar.'}
        </Text>
      </View>

      {application?.notes ? (
        <View style={[styles.note, rejected && { borderColor: theme.colors.error }]}>
          <MaterialCommunityIcons name="message-text-outline" size={20} color={rejected ? theme.colors.error : theme.colors.secondary} />
          <View style={styles.flex}>
            <Text style={styles.noteTitle}>Mensaje del administrador</Text>
            <Text style={styles.noteBody}>{application.notes}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        {STEPS.map((step, index) => {
          const done = !rejected && index < reached;
          const current = !rejected && index === reached;
          const color = done ? theme.colors.success : current ? theme.colors.secondary : theme.colors.textMuted;
          return (
            <View key={step.key} style={styles.step}>
              <View style={styles.rail}>
                <View style={[styles.stepIcon, { borderColor: color, backgroundColor: done ? `${theme.colors.success}1F` : 'transparent' }]}>
                  <MaterialCommunityIcons name={done ? 'check' : step.icon} size={18} color={color} />
                </View>
                {index < STEPS.length - 1 ? (
                  <View style={[styles.railLine, done && { backgroundColor: theme.colors.success }]} />
                ) : null}
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepTitle, !done && !current && { color: theme.colors.textMuted }]}>{step.title}</Text>
                <Text style={styles.stepBody}>
                  {step.key === 'inspeccion' && application?.inspection_date
                    ? `Cita: ${application.inspection_date}`
                    : step.body}
                </Text>
                {current ? <Text style={styles.current}>En curso</Text> : null}
              </View>
            </View>
          );
        })}
      </View>

      {application ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tu moto</Text>
          <Text style={styles.moto}>
            {application.moto.brand_model} · {application.moto.color}
            {application.moto.year ? ` · ${application.moto.year}` : ''}
          </Text>
          <Text style={styles.plate}>{application.moto.plate}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PressableScale style={styles.secondary} onPress={onOpenTutorial}>
          <MaterialCommunityIcons name="school-outline" size={20} color={theme.colors.textPrimary} />
          <Text style={styles.secondaryText}>Cómo funciona LITHIO</Text>
        </PressableScale>
        <PressableScale style={styles.secondary} onPress={onSignOut}>
          <MaterialCommunityIcons name="logout" size={20} color={theme.colors.error} />
          <Text style={[styles.secondaryText, { color: theme.colors.error }]}>Cerrar sesión</Text>
        </PressableScale>
      </View>
    </ScrollView>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 20,
  },
  flex: {
    flex: 1,
  },
  kicker: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.secondary,
    marginBottom: 6,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 26,
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  lead: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  note: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.secondaryLine,
    backgroundColor: theme.colors.secondarySoft,
  },
  noteTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  noteBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  card: {
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  step: {
    flexDirection: 'row',
    gap: 14,
  },
  rail: {
    alignItems: 'center',
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    marginVertical: 4,
    backgroundColor: theme.colors.cardBorder,
  },
  stepText: {
    flex: 1,
    paddingBottom: 18,
    paddingTop: 6,
  },
  stepTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  stepBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  current: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.secondary,
    marginTop: 6,
  },
  cardTitle: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  moto: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  plate: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 14,
    color: theme.colors.secondary,
    marginTop: 4,
  },
  actions: {
    gap: 10,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  secondaryText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
}));
