import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { theme, themed } from '../constants/theme';
import { Driver, PaymentMethod } from '../types';
import { apiService, FeCoupon } from '../services/api';

interface RequestRideModalProps {
  visible: boolean;
  driver: Driver | null;
  origin: string;
  destination: string;
  fareAmount: number;
  isScheduled: boolean;
  scheduledTime: string;
  userPoints: number;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, reference?: string, couponId?: number) => void;
}

export const RequestRideModal: React.FC<RequestRideModalProps> = ({
  visible,
  driver,
  origin,
  destination,
  fareAmount,
  isScheduled,
  scheduledTime,
  userPoints,
  onClose,
  onConfirm,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [reference, setReference] = useState('');
  const [coupons, setCoupons] = useState<FeCoupon[]>([]);
  const [couponId, setCouponId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!visible) return;
    setCouponId(undefined);
    apiService
      .getFeStore()
      .then((store) => setCoupons(store.coupons.filter((c) => c.status === 'activo')))
      .catch(() => setCoupons([]));
  }, [visible]);

  const coupon = coupons.find((c) => c.id === couponId);
  const finalFare = coupon ? Math.round(fareAmount * (100 - coupon.percent)) / 100 : fareAmount;

  if (!driver) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Encabezado */}
          <View style={styles.header}>
            <Text style={styles.title}>Confirmar Viaje</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Tarjeta del Conductor Seleccionado */}
            <View style={styles.driverSummary}>
              <Text style={styles.driverAvatar}>🏍️</Text>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{driver.name}</Text>
                <Text style={styles.driverMoto}>{driver.moto_brand_model} • {driver.moto_color}</Text>
                <Text style={styles.driverRating}>⭐ {driver.rating_avg.toFixed(2)} ({driver.trips_count} carreras)</Text>
              </View>
            </View>

            {/* Resumen de Ruta */}
            <View style={styles.routeBox}>
              <View style={styles.routePoint}>
                <Text style={styles.routeDot}>🟢</Text>
                <View>
                  <Text style={styles.routeLabel}>Origen:</Text>
                  <Text style={styles.routeVal}>{origin || 'Campus UNC'}</Text>
                </View>
              </View>
              <View style={styles.routeDivider} />
              <View style={styles.routePoint}>
                <Text style={styles.routeDot}>🏁</Text>
                <View>
                  <Text style={styles.routeLabel}>Destino:</Text>
                  <Text style={styles.routeVal}>{destination || 'San Antonio de los Altos'}</Text>
                </View>
              </View>
              {isScheduled && (
                <View style={styles.scheduledNotice}>
                  <Text style={styles.scheduledNoticeText}>📅 Programado para: {scheduledTime || 'Hora acordada'}</Text>
                </View>
              )}
            </View>

            {/* Métodos de Pago Locales */}
            <Text style={styles.sectionHeading}>💳 Método de Pago:</Text>
            <View style={styles.paymentOptions}>
              {/* Efectivo */}
              <TouchableOpacity
                style={[styles.paymentBtn, paymentMethod === 'efectivo' && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod('efectivo')}
              >
                <Text style={styles.paymentIcon}>💵</Text>
                <Text style={[styles.paymentText, paymentMethod === 'efectivo' && styles.paymentTextActive]}>
                  Efectivo
                </Text>
              </TouchableOpacity>

              {/* Pago Móvil */}
              <TouchableOpacity
                style={[styles.paymentBtn, paymentMethod === 'pago_movil' && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod('pago_movil')}
              >
                <Text style={styles.paymentIcon}>📲</Text>
                <Text style={[styles.paymentText, paymentMethod === 'pago_movil' && styles.paymentTextActive]}>
                  Pago Móvil
                </Text>
              </TouchableOpacity>

            </View>

            {/* Campo para Referencia de Pago Móvil */}
            {paymentMethod === 'pago_movil' && (
              <View style={styles.referenceContainer}>
                <View style={styles.mobilePaymentCard}>
                  <Text style={styles.mobilePaymentTitle}>📲 Datos para Pago Móvil</Text>
                  <Text style={styles.mobilePaymentRow}>
                    Los datos se mostrarán de forma privada dentro del viaje solicitado.
                  </Text>
                </View>
                <Text style={styles.referenceLabel}>Número o Últimos 4 Dígitos de Referencia:</Text>
                <TextInput
                  style={styles.referenceInput}
                  placeholder="Ej. REF-849201"
                  placeholderTextColor={theme.colors.textMuted}
                  value={reference}
                  onChangeText={setReference}
                />
                <Text style={styles.referenceHint}>
                  💡 Podrás transferirle al conductor al finalizar la carrera.
                </Text>
              </View>
            )}

            {coupons.length > 0 ? (
              <View style={styles.couponBox}>
                <Text style={styles.referenceLabel}>Cupón de Fe</Text>
                <View style={styles.couponRow}>
                  {coupons.map((c) => {
                    const selected = c.id === couponId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.couponChip, selected && styles.couponChipActive]}
                        onPress={() => setCouponId(selected ? undefined : c.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                      >
                        <Text style={[styles.couponChipText, selected && styles.couponChipTextActive]}>−{c.percent}%</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {coupon ? (
                  <Text style={styles.referenceHint}>
                    Pagas ${finalFare.toFixed(2)} en lugar de ${fareAmount.toFixed(2)}.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Recompensa Gamificada */}
            <View style={styles.rewardBanner}>
              <Text style={styles.rewardIcon}>🎁</Text>
              <Text style={styles.rewardText}>
                ¡Ganarás <Text style={styles.rewardBold}>+35 Fe</Text> al completar este viaje!
              </Text>
            </View>

            {/* Total y Botón */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tarifa Estimada:</Text>
              <Text style={styles.totalAmount}>${fareAmount.toFixed(2)} USD</Text>
            </View>

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => onConfirm(paymentMethod, reference, couponId)}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>
                🚀 Notificar y Solicitar a {driver.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = themed(() => ({
  couponBox: {
    marginBottom: 16,
  },
  couponRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  couponChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.gold,
  },
  couponChipActive: {
    backgroundColor: theme.colors.gold,
  },
  couponChipText: {
    fontFamily: theme.fonts.monoBold,
    color: theme.colors.gold,
    fontSize: 13,
  },
  couponChipTextActive: {
    color: theme.colors.bgDark,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: theme.colors.cardBg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  closeBtn: {
    backgroundColor: theme.colors.cardElevated,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  driverSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardElevated,
    padding: 12,
    borderRadius: theme.radius.md,
    gap: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  driverAvatar: {
    fontFamily: theme.fonts.regular,
    fontSize: 32,
  },
  driverDetails: {
    gap: 2,
  },
  driverName: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  driverMoto: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  driverRating: {
    fontFamily: theme.fonts.bold,
    fontSize: 11,
    color: theme.colors.gold,
  },
  routeBox: {
    backgroundColor: theme.colors.cardElevated,
    padding: 14,
    borderRadius: theme.radius.md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
  },
  routeLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  routeVal: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  routeDivider: {
    height: 1,
    backgroundColor: theme.colors.cardBorder,
    marginVertical: 10,
    marginLeft: 24,
  },
  scheduledNotice: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBorder,
  },
  scheduledNoticeText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
    fontSize: 12,
  },
  sectionHeading: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paymentBtn: {
    flex: 1,
    backgroundColor: theme.colors.cardElevated,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    gap: 4,
  },
  paymentBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  paymentBtnDisabled: {
    opacity: 0.4,
  },
  paymentIcon: {
    fontFamily: theme.fonts.regular,
    fontSize: 18,
  },
  paymentText: {
    fontFamily: theme.fonts.bold,
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  paymentTextActive: {
    color: theme.colors.primary,
  },
  referenceContainer: {
    marginBottom: 14,
    gap: 4,
  },
  mobilePaymentCard: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: theme.radius.sm,
    padding: 12,
    marginBottom: 10,
    gap: 5,
  },
  mobilePaymentTitle: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    fontSize: 13,
    marginBottom: 3,
  },
  mobilePaymentRow: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  mobilePaymentLabel: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textSecondary,
  },
  referenceLabel: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  referenceInput: {
    fontFamily: theme.fonts.regular,
    backgroundColor: theme.colors.cardElevated,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.sm,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  referenceHint: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: 12,
    borderRadius: theme.radius.sm,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  rewardIcon: {
    fontFamily: theme.fonts.regular,
    fontSize: 18,
  },
  rewardText: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  rewardBold: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  totalAmount: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    color: theme.colors.primary,
  },
  confirmBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnText: {
    fontFamily: theme.fonts.bold,
    color: '#0B0F19',
    fontSize: 14,
  }
}));
