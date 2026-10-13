import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { theme } from '../constants/theme';
import { UserRole } from '../types';

interface HeaderProps {
  currentRole: UserRole;
  onToggleRole: () => void;
  points: number;
  xpLevel: string;
  onOpenRewards: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onToggleRole,
  points,
  xpLevel,
  onOpenRewards,
}) => {
  const isDriver = currentRole === 'conductor';

  return (
    <View style={styles.container}>
      {/* Barra superior: Título y Puntos */}
      <View style={styles.topRow}>
        <View style={styles.branding}>
          <View>
            <Text style={styles.title}>LITHIO</Text>
            <Text style={styles.subtitle}>Transporte inteligente</Text>
          </View>
        </View>

        {/* Balance de Puntos Gamificados */}
        <TouchableOpacity 
          style={styles.pointsPill}
          onPress={onOpenRewards}
          activeOpacity={0.8}
        >
          <Text style={styles.coinIcon}>Fe</Text>
          <Text style={styles.pointsText}>{points} Fe</Text>
        </TouchableOpacity>
      </View>

      {/* Barra inferior: Nivel del Usuario y Switch de Rol */}
      <View style={styles.bottomRow}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeLabel}>RANGO:</Text>
          <Text style={styles.badgeValue}>{xpLevel}</Text>
        </View>

        {/* Selector de Modo (Pasajero vs Conductor) */}
        <TouchableOpacity
          style={[styles.roleButton, isDriver ? styles.roleButtonDriver : styles.roleButtonPassenger]}
          onPress={onToggleRole}
          activeOpacity={0.85}
        >
          <Text style={styles.roleButtonIcon}>{isDriver ? '🛵' : '🎒'}</Text>
          <Text style={styles.roleButtonText}>
            {isDriver ? 'Modo: Conductor' : 'Modo: Pasajero'}
          </Text>
          <Text style={styles.roleSwitchHint}>↺</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cardBg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    fontSize: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 200, 87, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.48)',
    gap: 6,
  },
  coinIcon: {
    fontSize: 16,
  },
  pointsText: {
    color: theme.colors.gold,
    fontWeight: '800',
    fontSize: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    gap: 5,
  },
  badgeLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  badgeValue: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    gap: 6,
  },
  roleButtonPassenger: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  roleButtonDriver: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  roleButtonIcon: {
    fontSize: 14,
  },
  roleButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  roleSwitchHint: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  }
});
