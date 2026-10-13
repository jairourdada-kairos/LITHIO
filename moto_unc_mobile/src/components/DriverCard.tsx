import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { theme } from '../constants/theme';
import { Driver } from '../types';

interface DriverCardProps {
  driver: Driver;
  onSelectDriver: (driver: Driver) => void;
}

export const DriverCard: React.FC<DriverCardProps> = ({ driver, onSelectDriver }) => {
  return (
    <View style={[styles.card, !driver.is_available && styles.cardDisabled]}>
      <View style={styles.topRow}>
        {/* Avatar y Datos del Conductor */}
        <View style={styles.profileSection}>
          <Image
            source={{ uri: driver.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200' }}
            style={styles.avatar}
          />
          <View style={styles.driverInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.driverName}>{driver.name}</Text>
              {driver.name.includes("Jairo") && (
                <View style={styles.starBadge}>
                  <Text style={styles.starBadgeText}>⭐ TÚ</Text>
                </View>
              )}
            </View>
            <Text style={styles.xpText}>{driver.xp_level}</Text>
          </View>
        </View>

        {/* Estado: Disponible / Ocupado */}
        <View style={[styles.statusPill, driver.is_available ? styles.statusAvailable : styles.statusBusy]}>
          <View style={[styles.statusDot, driver.is_available ? styles.dotAvailable : styles.dotBusy]} />
          <Text style={[styles.statusText, driver.is_available ? styles.statusTextAvail : styles.statusTextBusy]}>
            {driver.is_available ? 'Disponible' : 'En Ruta'}
          </Text>
        </View>
      </View>

      {/* Información de la Moto */}
      <View style={styles.motoInfoBox}>
        <View style={styles.motoDetail}>
          <Text style={styles.motoLabel}>🏍️ Moto:</Text>
          <Text style={styles.motoValue}>{driver.moto_brand_model} ({driver.moto_color})</Text>
        </View>
        <View style={styles.motoDetail}>
          <Text style={styles.motoLabel}>🔢 Placa:</Text>
          <Text style={styles.motoPlate}>{driver.plate}</Text>
        </View>
      </View>

      {/* Badges de Seguridad & Ubicación */}
      <View style={styles.badgesRow}>
        <View style={styles.miniBadge}>
          <Text style={styles.miniBadgeText}>🪖 Casco adicional limpio</Text>
        </View>
        <View style={styles.miniBadge}>
          <Text style={styles.miniBadgeText}>📍 {driver.current_location_tag}</Text>
        </View>
      </View>

      {/* Botón de Selección Directa */}
      <TouchableOpacity
        style={[styles.selectBtn, !driver.is_available && styles.selectBtnDisabled]}
        onPress={() => onSelectDriver(driver)}
        disabled={!driver.is_available}
        activeOpacity={0.8}
      >
        <Text style={styles.selectBtnText}>
          {driver.is_available 
            ? `Elegir a ${driver.name.split(' ')[0]} en LITHIO 🚀`
            : 'Conductor ocupado en este momento'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.cardBorder,
  },
  cardDisabled: {
    opacity: 0.65,
    borderColor: '#1E293B',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  driverInfo: {
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  starBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  starBadgeText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  xpText: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  tripsText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    gap: 5,
  },
  statusAvailable: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  statusBusy: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotAvailable: {
    backgroundColor: theme.colors.success,
  },
  dotBusy: {
    backgroundColor: theme.colors.error,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextAvail: {
    color: theme.colors.success,
  },
  statusTextBusy: {
    color: theme.colors.error,
  },
  motoInfoBox: {
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.radius.sm,
    padding: 10,
    gap: 4,
    marginBottom: 10,
  },
  motoDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  motoLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  motoValue: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  motoPlate: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  miniBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniBadgeText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  selectBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  selectBtnDisabled: {
    backgroundColor: '#334155',
  },
  selectBtnText: {
    color: '#0B0F19',
    fontSize: 13,
    fontWeight: '800',
  }
});
