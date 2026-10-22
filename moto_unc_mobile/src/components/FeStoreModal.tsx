/**
 * FeStoreModal.tsx — Tienda de Fe
 *
 * Cupones de 25 % y 50 % para el próximo viaje y el vale «Pasar con 20»:
 * se envía la materia y una foto de la nota; el Fe queda retenido hasta
 * que el administrador lo revisa (si lo rechaza, se devuelve).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, themed } from '../constants/theme';
import { PressableScale } from './brand/PressableScale';
import { apiService, FeStore, GradeVoucher } from '../services/api';
import { photoFormValue, pickDocumentPhoto } from '../services/avatar';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPointsChanged: (points: number) => void;
}

const VOUCHER_STATUS: Record<GradeVoucher['status'], { label: string; color: () => string }> = {
  pendiente: { label: 'En revisión', color: () => theme.colors.warning },
  aprobado: { label: 'Aprobado', color: () => theme.colors.success },
  rechazado: { label: 'Rechazado · Fe devuelto', color: () => theme.colors.error },
};

export const FeStoreModal: React.FC<Props> = ({ visible, onClose, onPointsChanged }) => {
  const [store, setStore] = useState<FeStore | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  // En una ref para que `load` no cambie en cada render del padre.
  const pointsChanged = useRef(onPointsChanged);
  pointsChanged.current = onPointsChanged;

  const load = useCallback(async () => {
    try {
      const data = await apiService.getFeStore();
      setStore(data);
      pointsChanged.current(data.points);
    } catch (error) {
      Alert.alert('No se pudo abrir la tienda', error instanceof Error ? error.message : 'Intenta de nuevo.');
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const points = store?.points ?? 0;
  const activeCoupons = store?.coupons.filter((c) => c.status === 'activo') ?? [];
  const pendingVoucher = store?.vouchers.some((v) => v.status === 'pendiente') ?? false;

  const buy = (percent: number, cost: number) =>
    Alert.alert(`Cupón −${percent}%`, `Usarás ${cost} Fe. Podrás aplicarlo al confirmar tu próximo viaje.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Canjear',
        onPress: async () => {
          setBusy(`c${percent}`);
          try {
            await apiService.buyCoupon(percent);
            await load();
          } catch (error) {
            Alert.alert('No se pudo canjear', error instanceof Error ? error.message : 'Intenta de nuevo.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  const sendVoucher = async () => {
    if (subject.trim().length < 3 || !photo) {
      Alert.alert('Faltan datos', 'Escribe la materia y adjunta la foto de tu nota.');
      return;
    }
    setBusy('voucher');
    try {
      await apiService.requestGradeVoucher(subject.trim(), note.trim(), await photoFormValue(photo, 'nota.jpg'));
      setVoucherOpen(false);
      setSubject('');
      setNote('');
      setPhoto(null);
      await load();
      Alert.alert('Vale enviado', 'El administrador revisará tu evidencia. Si no se aprueba, te devolvemos el Fe.');
    } catch (error) {
      Alert.alert('No se pudo enviar', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.title}>Tienda de Fe</Text>
              <Text style={styles.muted}>Canjear no te baja de nivel: tu nivel cuenta todo el Fe que ganaste.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Cerrar">
              <MaterialCommunityIcons name="close" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.balance}>
            <Text style={styles.balanceValue}>Fe {points}</Text>
            <Text style={styles.muted}>disponibles</Text>
          </View>

          {!store ? (
            <ActivityIndicator color={theme.colors.gold} style={{ marginVertical: 32 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {store.store_discount ? (
                <Text style={[styles.muted, { color: theme.colors.gold }]}>Precios con 10 % de descuento por tu nivel.</Text>
              ) : null}
              <Text style={styles.section}>Cupones para tu próximo viaje</Text>
              <View style={styles.row}>
                {store.coupon_prices.map(({ percent, cost }) => {
                  const affordable = points >= cost;
                  return (
                    <PressableScale
                      key={percent}
                      containerStyle={styles.flex}
                      style={[styles.coupon, !affordable && styles.dim]}
                      onPress={() => buy(percent, cost)}
                      disabled={!affordable || busy !== null}
                      accessibilityLabel={`Cupón de ${percent} por ciento por ${cost} Fe`}
                    >
                      <Text style={styles.couponPercent}>−{percent}%</Text>
                      <Text style={styles.couponCost}>{busy === `c${percent}` ? 'Canjeando…' : `${cost} Fe`}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              {activeCoupons.length > 0 ? (
                <Text style={styles.muted}>
                  Tienes {activeCoupons.map((c) => (c.percent === 100 ? 'un viaje gratis' : `−${c.percent}%`)).join(', ')} listo
                  para usar al confirmar un viaje. Los niveles C, Al y Cu te regalan cupones.
                </Text>
              ) : null}

              <Text style={styles.section}>Pasar con 20</Text>
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <MaterialCommunityIcons name="school-outline" size={26} color={theme.colors.gold} />
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>Vale académico · {store.voucher_cost} Fe</Text>
                    <Text style={styles.muted}>
                      ¿Sacaste 20? Sube la foto de la nota y el administrador la verifica para entregarte tu vale.
                    </Text>
                  </View>
                </View>

                {voucherOpen ? (
                  <View style={styles.form}>
                    <TextInput
                      style={styles.input}
                      placeholder="Materia (ej. Cálculo II)"
                      placeholderTextColor={theme.colors.textMuted}
                      value={subject}
                      onChangeText={setSubject}
                      maxLength={80}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Comentario opcional"
                      placeholderTextColor={theme.colors.textMuted}
                      value={note}
                      onChangeText={setNote}
                      maxLength={200}
                    />
                    <Pressable style={styles.photoPick} onPress={async () => setPhoto(await pickDocumentPhoto())}>
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="image-plus" size={22} color={theme.colors.textSecondary} />
                          <Text style={styles.muted}>Adjuntar foto de la nota</Text>
                        </>
                      )}
                    </Pressable>
                    <PressableScale style={styles.primary} onPress={sendVoucher} disabled={busy !== null}>
                      <Text style={styles.primaryText}>{busy === 'voucher' ? 'Enviando…' : `Enviar · ${store.voucher_cost} Fe`}</Text>
                    </PressableScale>
                  </View>
                ) : (
                  <PressableScale
                    style={[styles.primary, (points < store.voucher_cost || pendingVoucher) && styles.dim]}
                    onPress={() => setVoucherOpen(true)}
                    disabled={points < store.voucher_cost || pendingVoucher}
                  >
                    <Text style={styles.primaryText}>
                      {pendingVoucher ? 'Tienes un vale en revisión' : points < store.voucher_cost ? `Necesitas ${store.voucher_cost} Fe` : 'Solicitar vale'}
                    </Text>
                  </PressableScale>
                )}
              </View>

              {store.vouchers.map((v) => {
                const status = VOUCHER_STATUS[v.status];
                return (
                  <View key={v.id} style={styles.voucherRow}>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle}>{v.subject}</Text>
                      {v.code ? <Text style={styles.code}>{v.code}</Text> : null}
                      {v.review_note ? <Text style={styles.muted}>{v.review_note}</Text> : null}
                    </View>
                    <Text style={[styles.status, { color: status.color() }]}>{status.label}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = themed(() => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.bgDark,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  muted: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginVertical: 16,
  },
  balanceValue: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 28,
    color: theme.colors.gold,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  section: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  coupon: {
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.surface,
  },
  couponPercent: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 26,
    color: theme.colors.gold,
  },
  couponCost: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  dim: {
    opacity: 0.45,
  },
  card: {
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    gap: 14,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  cardTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  form: {
    gap: 10,
  },
  input: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingHorizontal: 14,
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.textPrimary,
    minWidth: 0,
  },
  photoPick: {
    height: 120,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  primary: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gold,
  },
  primaryText: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.bgDark,
  },
  voucherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  code: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 14,
    color: theme.colors.gold,
  },
  status: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
  },
}));
