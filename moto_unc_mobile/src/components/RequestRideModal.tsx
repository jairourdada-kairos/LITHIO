import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { theme } from '../constants/theme';
import { Driver, PaymentMethod } from '../types';

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
  onConfirm: (paymentMethod: PaymentMethod, reference?: string) => void;
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
                <Text style={styles.driverMoto}>{driver.moto_brand_model} • {driver.plate}</Text>
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
                    <Text style={styles.mobilePaymentLabel}>Titular: </Text>{driver.name}
                  </Text>
                  <Text style={styles.mobilePaymentRow}>
                    <Text style={styles.mobilePaymentLabel}>Teléfono: </Text>{driver.phone || 'No registrado'}
                  </Text>
                  <Text style={styles.mobilePaymentRow}>
                    <Text style={styles.mobilePaymentLabel}>Banco: </Text>{driver.mobile_payment_bank || 'No registrado'}
                  </Text>
                  <Text style={styles.mobilePaymentRow}>
                    <Text style={styles.mobilePaymentLabel}>Número Pago Móvil: </Text>{driver.mobile_payment_number || 'No registrado'}
                  </Text>
                  <Text style={styles.mobilePaymentRow}>
                    <Text style={styles.mobilePaymentLabel}>Cédula: </Text>{driver.mobile_payment_id || 'No registrada'}
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
              onPress={() => onConfirm(paymentMethod, reference)}
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

const styles = StyleSheet.create({
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
    fontSize: 18,
    fontWeight: '800',
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
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
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
    fontSize: 32,
  },
  driverDetails: {
    gap: 2,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  driverMoto: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  driverRating: {
    fontSize: 11,
    color: theme.colors.gold,
    fontWeight: '700',
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
    fontSize: 14,
  },
  routeLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  routeVal: {
    fontSize: 13,
    fontWeight: '700',
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
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 18,
  },
  paymentText: {
    fontSize: 11,
    fontWeight: '700',
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
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  mobilePaymentRow: {
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  mobilePaymentLabel: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  referenceLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  referenceInput: {
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
    fontSize: 18,
  },
  rewardText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  rewardBold: {
    color: theme.colors.gold,
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '900',
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
    color: '#0B0F19',
    fontSize: 14,
    fontWeight: '900',
  }
});
