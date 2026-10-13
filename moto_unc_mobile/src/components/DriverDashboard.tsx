import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Switch } from 'react-native';
import { theme } from '../constants/theme';
import { Ride, RideStatus } from '../types';

interface DriverDashboardProps {
  isAvailable: boolean;
  onToggleAvailability: (value: boolean) => void;
  activeRide: Ride | null;
  onUpdateRideStatus: (status: RideStatus) => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  isAvailable,
  onToggleAvailability,
  activeRide,
  onUpdateRideStatus,
}) => {
  return (
    <View style={styles.container}>
      {/* Tarjeta de Disponibilidad */}
      <View style={styles.availabilityCard}>
        <View style={styles.availTextGroup}>
          <Text style={styles.availTitle}>
            {isAvailable ? '🟢 Estás Disponible' : '🔴 Fuera de Servicio'}
          </Text>
          <Text style={styles.availSubtitle}>
            {isAvailable 
              ? 'Los estudiantes de la UNC y el IVIC pueden seleccionarte en la lista.' 
              : 'No aparecerás disponible para nuevos viajes.'}
          </Text>
        </View>
        <Switch
          value={isAvailable}
          onValueChange={onToggleAvailability}
          trackColor={{ false: '#334155', true: 'rgba(16, 185, 129, 0.4)' }}
          thumbColor={isAvailable ? theme.colors.success : '#94A3B8'}
        />
      </View>

      {/* Métricas del Conductor */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>142</Text>
          <Text style={styles.statLabel}>Carreras</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumberGold}>⭐ 4.95</Text>
          <Text style={styles.statLabel}>Reputación</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumberCyan}>100%</Text>
          <Text style={styles.statLabel}>Casco Seguro</Text>
        </View>
      </View>

      {/* Alerta si no hay viajes activos */}
      {!activeRide && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingIcon}>📡</Text>
          <Text style={styles.waitingTitle}>Radar de Solicitudes Activo</Text>
          <Text style={styles.waitingDesc}>
            Cuando un estudiante en la UNC, IVIC o San Antonio te elija para su viaje, recibirás la notificación sonora y la tarjeta aquí de inmediato.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
  },
  availabilityCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.radius.md,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: theme.colors.cardBorder,
  },
  availTextGroup: {
    flex: 1,
    paddingRight: 10,
    gap: 3,
  },
  availTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  availSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    gap: 2,
  },
  statNumber: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  statNumberGold: {
    color: theme.colors.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  statNumberCyan: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  waitingCard: {
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.radius.md,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  waitingIcon: {
    fontSize: 36,
  },
  waitingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  waitingDesc: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  }
});
