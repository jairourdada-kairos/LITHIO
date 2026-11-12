import React, { useEffect, useRef, useState } from 'react';
import { Text, View, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { theme, themed } from '../constants/theme';
import { Driver, PaymentMethod } from '../types';
import { apiService, FeCoupon, TopupMethod } from '../services/api';
import { formatBs, useBcvRate } from '../services/rates';

/** Mínimo para pagar un viaje con iones (igual que en el servidor). */
export const MIN_DIAMOND_PAYMENT = 0.5;

/** Lo que se elige en pantalla: Binance Pay no paga el viaje, lleva a recargar iones. */
type PaymentChoice = PaymentMethod | 'binance_pay';

// Orden fijo de los métodos: Iones, Efectivo, Pago Móvil y Binance Pay.
const PAYMENT_OPTIONS: { key: PaymentChoice; label: string; icon: string; sub: string }[] = [
  { key: 'diamantes', label: 'Diamantes', icon: 'Li⁺', sub: '' },
  { key: 'efectivo', label: 'Efectivo', icon: '💵', sub: 'Al conductor' },
  { key: 'pago_movil', label: 'Pago Móvil', icon: '📲', sub: 'Al conductor' },
  { key: 'binance_pay', label: 'Binance Pay', icon: '🔶', sub: 'Recarga Li⁺' },
];

interface RequestRideModalProps {
  visible: boolean;
  driver: Driver | null;
  origin: string;
  destination: string;
  fareAmount: number;
  isScheduled: boolean;
  scheduledTime: string;
  /** Tipo de la ruta: los pases de combo solo valen en rutas internas. */
  routeScope?: 'interna' | 'externa';
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, couponId?: number) => Promise<void> | void;
  /** Cierra la confirmación y abre la recarga de iones con ese método. */
  onRecharge?: (method: TopupMethod) => void;
}

export const RequestRideModal: React.FC<RequestRideModalProps> = ({
  visible,
  driver,
  origin,
  destination,
  fareAmount,
  isScheduled,
  scheduledTime,
  routeScope,
  onClose,
  onConfirm,
  onRecharge,
}) => {
  const bcv = useBcvRate();
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>('efectivo');
  const [passes, setPasses] = useState(0);
  const [binanceAvailable, setBinanceAvailable] = useState(false);
  // Mientras el usuario no elija, se propone el mejor método disponible.
  const picked = useRef(false);
  const [coupons, setCoupons] = useState<FeCoupon[]>([]);
  const [couponId, setCouponId] = useState<number | undefined>(undefined);
  const [diamonds, setDiamonds] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setCouponId(undefined);
    setDiamonds(null);
    setPasses(0);
    setSubmitting(false);
    setError(null);
    picked.current = false;
    apiService
      .getFeStore()
      .then((store) => {
        if (cancelled) return;
        setCoupons(store.coupons.filter((c) => c.status === 'activo'));
        setPasses(store.ride_passes ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCoupons([]);
      });
    apiService
      .getWallet()
      .then((wallet) => {
        if (cancelled) return;
        setDiamonds(wallet.balance);
        setBinanceAvailable(Boolean(wallet.binance_pay));
      })
      .catch(() => {
        if (!cancelled) setDiamonds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const coupon = coupons.find((c) => c.id === couponId);
  const finalFare = coupon ? Math.round(fareAmount * (100 - coupon.percent)) / 100 : fareAmount;

  // Iones: la tarifa debe ser de Li⁺ 0.50 o más y el saldo debe alcanzar.
  const diamondBlock =
    finalFare < MIN_DIAMOND_PAYMENT
      ? `Mínimo Li⁺ ${MIN_DIAMOND_PAYMENT.toFixed(2)}`
      : diamonds === null
        ? 'Saldo no disponible'
        : diamonds < finalFare
          ? 'Saldo insuficiente'
          : null;

  // Si un cupón deja la tarifa por debajo del mínimo, se vuelve a efectivo.
  useEffect(() => {
    if (paymentMethod === 'diamantes' && diamondBlock) setPaymentMethod('efectivo');
  }, [paymentMethod, diamondBlock]);

  const canUsePass = routeScope === 'interna' && passes > 0;
  // Propuesta inicial: pase de combo, luego iones y, si no alcanzan, efectivo.
  useEffect(() => {
    if (!visible || picked.current) return;
    setPaymentMethod(canUsePass ? 'pase' : diamondBlock ? 'efectivo' : 'diamantes');
  }, [visible, canUsePass, diamondBlock]);

  const pick = (choice: PaymentChoice) => {
    if (submitting) return;
    picked.current = true;
    setError(null);
    setPaymentMethod(choice);
    if (choice === 'pase') setCouponId(undefined); // Un pase no se combina con cupones.
  };

  const handleConfirm = async () => {
    if (submitting) return;
    setError(null);
    if (paymentMethod === 'binance_pay') {
      onRecharge?.('binance_pay');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(paymentMethod, paymentMethod === 'pase' ? undefined : couponId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo solicitar el viaje.');
      apiService
        .getFeStore()
        .then((store) => {
          const active = store.coupons.filter((c) => c.status === 'activo');
          setCoupons(active);
          setPasses(store.ride_passes ?? 0);
          if (couponId && !active.some((c) => c.id === couponId)) {
            setCouponId(undefined);
          }
        })
        .catch(() => {});
      apiService
        .getWallet()
        .then((wallet) => {
          setDiamonds(wallet.balance);
          setBinanceAvailable(Boolean(wallet.binance_pay));
        })
        .catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  if (!driver) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Encabezado */}
          <View style={styles.header}>
            <Text style={styles.title}>Confirmar Viaje</Text>
            <TouchableOpacity onPress={onClose} disabled={submitting} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Tarjeta del Conductor Seleccionado */}
            <View style={styles.driverSummary}>
              <Text style={styles.driverAvatar}>🏍️</Text>
              <View style={styles.driverDetails}>
                <View style={styles.driverNameRow}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  {driver.is_verified === true ? (
                    <View style={styles.verifiedPill}>
                      <Text style={styles.verifiedPillText}>Verificado</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.driverVehicleRow}>
                  <Text style={styles.driverMoto}>{driver.moto_brand_model} • {driver.moto_color}</Text>
                </View>
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

            {/* Métodos de pago, en orden: Iones, Efectivo, Pago Móvil y Binance Pay. */}
            <Text style={styles.sectionHeading}>💳 Método de Pago:</Text>
            {canUsePass ? (
              <TouchableOpacity
                style={[styles.passBtn, paymentMethod === 'pase' && styles.paymentBtnActive]}
                onPress={() => pick('pase')}
                accessibilityRole="radio"
                accessibilityState={{ selected: paymentMethod === 'pase' }}
              >
                <Text style={styles.paymentIcon}>🎟️</Text>
                <View style={styles.passText}>
                  <Text style={[styles.paymentText, styles.passTitle, paymentMethod === 'pase' && styles.paymentTextActive]}>
                    Usar un pase de combo
                  </Text>
                  <Text style={[styles.paymentSub, styles.passTitle]}>Te quedan {passes} · no gastas iones</Text>
                </View>
              </TouchableOpacity>
            ) : null}
            <View style={styles.paymentOptions} accessibilityRole="radiogroup">
              {PAYMENT_OPTIONS.map((option) => {
                const blocked =
                  option.key === 'diamantes' ? diamondBlock : option.key === 'binance_pay' && !binanceAvailable ? 'No disponible' : null;
                const selected = paymentMethod === option.key;
                const sub = option.key === 'diamantes' ? diamondBlock ?? `Li⁺ ${(diamonds ?? 0).toFixed(2)}` : blocked ?? option.sub;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.paymentBtn, selected && styles.paymentBtnActive, blocked ? styles.paymentBtnDisabled : null]}
                    onPress={() => pick(option.key)}
                    disabled={Boolean(blocked)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: Boolean(blocked) }}
                    accessibilityHint={blocked ?? undefined}
                  >
                    <Text style={[styles.paymentIcon, option.key === 'diamantes' && { color: theme.colors.diamond }]}>{option.icon}</Text>
                    <Text style={[styles.paymentText, selected && styles.paymentTextActive]}>{option.label}</Text>
                    <Text style={styles.paymentSub}>{sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {paymentMethod === 'diamantes' ? (
              <Text style={[styles.referenceHint, styles.diamondHint]}>
                Se retienen Li⁺ {finalFare.toFixed(2)} de tu billetera y pasan al conductor al terminar el viaje. Si se cancela, te los devolvemos.
              </Text>
            ) : null}
            {paymentMethod === 'pase' ? (
              <Text style={[styles.referenceHint, styles.diamondHint]}>
                Se aparta 1 pase y se gasta al terminar el viaje. Si se cancela, te lo devolvemos.
              </Text>
            ) : null}
            {paymentMethod === 'binance_pay' ? (
              <Text style={[styles.referenceHint, styles.diamondHint]}>
                Con Binance Pay recargas iones (1 Li⁺ = 1 USD) y pagas el viaje con ellos. La recarga se acredita cuando el administrador verifica tu pago.
              </Text>
            ) : null}

            {/* Pago Móvil: aún no hay nada que anotar; la referencia va después de transferir. */}
            {paymentMethod === 'pago_movil' && (
              <View style={styles.referenceContainer}>
                <View style={styles.mobilePaymentCard}>
                  <Text style={styles.mobilePaymentTitle}>📲 Cómo pagas con Pago Móvil</Text>
                  {[
                    'Pide el viaje: en «Mi viaje» verás el banco, teléfono y cédula del conductor.',
                    'Transfiere desde tu banco cuando quieras: antes, durante o al llegar.',
                    'Anota ahí la referencia que te da el banco (y la captura, si quieres).',
                  ].map((text, index) => (
                    <View key={text} style={styles.pmStep}>
                      <Text style={styles.pmStepNum}>{index + 1}</Text>
                      <Text style={styles.mobilePaymentRow}>{text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {coupons.length > 0 && paymentMethod !== 'pase' ? (
              <View style={styles.couponBox}>
                <Text style={styles.referenceLabel}>Cupón de Fe</Text>
                <View style={styles.couponRow}>
                  {coupons.map((c) => {
                    const selected = c.id === couponId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.couponChip, selected && styles.couponChipActive]}
                        onPress={() => {
                          if (submitting) return;
                          setError(null);
                          setCouponId(selected ? undefined : c.id);
                        }}
                        disabled={submitting}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected, disabled: submitting }}
                      >
                        <Text style={[styles.couponChipText, selected && styles.couponChipTextActive]}>
                          {c.percent === 100 ? 'Gratis' : `−${c.percent}%`}
                        </Text>
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
                ¡Ganarás <Text style={styles.rewardBold}>+15 Fe</Text> al completar este viaje!
              </Text>
            </View>

            {/* Total y Botón */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tarifa Estimada:</Text>
              <View style={styles.totalValues}>
                <Text style={styles.totalAmount}>
                  {paymentMethod === 'pase' ? '1 pase de combo' : `$${finalFare.toFixed(2)} USD`}
                </Text>
                {bcv && paymentMethod !== 'pase' ? <Text style={styles.totalBs}>{formatBs(finalFare, bcv)} · tasa BCV</Text> : null}
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.confirmBtn, submitting && styles.paymentBtnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ busy: submitting, disabled: submitting }}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>
                {submitting
                  ? 'Solicitando viaje…'
                  : paymentMethod === 'binance_pay'
                    ? 'Recargar con Binance Pay'
                    : `Solicitar a ${driver.name.split(' ')[0]}`}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = themed(() => ({
  totalValues: {
    alignItems: 'flex-end',
  },
  totalBs: {
    fontFamily: theme.fonts.medium,
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  pmStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pmStepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: theme.fonts.bold,
    fontSize: 12,
    color: theme.colors.onPrimary,
    backgroundColor: theme.colors.primary,
  },
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
    backgroundColor: theme.colors.scrim,
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
    flex: 1,
    gap: 3,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  driverName: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  verifiedPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
  },
  verifiedPillText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  driverVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  driverMoto: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  platePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bgDark,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  platePillText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 11,
    color: theme.colors.textPrimary,
    letterSpacing: 0.4,
  },
  driverRating: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
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
    fontSize: 12,
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
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  passBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.cardElevated,
  },
  passText: {
    flex: 1,
    gap: 2,
  },
  passTitle: {
    textAlign: 'left',
  },
  paymentBtn: {
    // Dos por fila, todos del mismo tamaño.
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 78,
    justifyContent: 'center',
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
    backgroundColor: theme.colors.primarySoft,
  },
  paymentBtnDisabled: {
    opacity: 0.6,
  },
  paymentIcon: {
    fontFamily: theme.fonts.regular,
    fontSize: 18,
  },
  paymentText: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  paymentTextActive: {
    color: theme.colors.primary,
  },
  paymentSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  diamondHint: {
    marginBottom: 14,
  },
  referenceContainer: {
    marginBottom: 14,
    gap: 4,
  },
  mobilePaymentCard: {
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
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
    flex: 1,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
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
    fontSize: 12,
  },
  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.goldSoft,
    padding: 12,
    borderRadius: theme.radius.sm,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${theme.colors.gold}4D`,
  },
  errorText: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.error,
    fontSize: 12,
    marginBottom: 10,
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
    color: theme.colors.onAccent,
    fontSize: 14,
  }
}));
