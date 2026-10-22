import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { UserRole } from '../types';

interface HeaderProps {
  currentRole: UserRole;
  onToggleRole: () => void;
  points: number;
  xpLevel: string;
  onOpenRewards: () => void;
  onOpenAbout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onToggleRole,
  points,
  xpLevel,
  onOpenRewards,
  onOpenAbout,
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
          <TouchableOpacity
            onPress={onOpenAbout}
            style={styles.aboutButton}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="¿Qué es LITHIO?"
          >
            <MaterialCommunityIcons name="atom" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
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
  aboutButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
  },
  logoIcon: {
    fontFamily: theme.fonts.regular,
    fontSize: 30,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    color: theme.colors.textSecondary,
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
    fontFamily: theme.fonts.regular,
    fontSize: 16,
  },
  pointsText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
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
    fontFamily: theme.fonts.bold,
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  badgeValue: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textPrimary,
    fontSize: 11,
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
    fontFamily: theme.fonts.regular,
    fontSize: 14,
  },
  roleButtonText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  roleSwitchHint: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textSecondary,
    fontSize: 14,
  }
});
