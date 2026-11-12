/**
 * FeStoreModal.tsx — Tienda de Fe (pestaña propia del pasajero, o ventana)
 *
 * COMBOS: paquetes de pases de viaje que se pagan con iones y se acreditan
 * al instante; cada pase es un viaje en rutas internas (dentro del IVIC).
 * Cupones de 25 % y 50 % para el próximo viaje y el vale «Pasar con 20»:
 * se envía la materia y una foto de la nota; el Fe queda retenido hasta
 * que el administrador lo revisa (si lo rechaza, se devuelve).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, TextInput, Image, Alert } from 'react-native';
import { Icon } from './ui/Icon';
import { theme, themed } from '../constants/theme';
import { PressableScale } from './brand/PressableScale';
import { ScreenTitle, SectionLabel } from './ui/Decor';
import { hapticSuccess } from '../services/haptics';
import { Reveal, SkeletonCard } from './ui/Motion';
import { apiService, FeCombo, FeStore, GradeVoucher } from '../services/api';
import { TAB_BAR_HEIGHT } from './nav/BottomTabBar';
import { photoFormValue, pickDocumentPhoto } from '../services/avatar';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPointsChanged: (points: number) => void;
  /** 'screen' = pestaña propia: ocupa la pantalla, sin fondo oscuro ni botón de cerrar. */
  variant?: 'modal' | 'screen';
  /** Al cambiar, la tienda se vuelve a cargar (viajes y billetera mueven pases y iones). */
  reloadKey?: number;
  /** Lleva a recargar iones cuando no alcanzan para un combo. */
  onRecharge?: () => void;
}

const VOUCHER_STATUS: Record<GradeVoucher['status'], { label: string; color: () => string }> = {
  pendiente: { label: 'En revisión', color: () => theme.colors.warning },
  aprobado: { label: 'Aprobado', color: () => theme.colors.success },
  rechazado: { label: 'Rechazado · Fe devuelto', color: () => theme.colors.error },
};

export const FeStoreModal: React.FC<Props> = ({ visible, onClose, onPointsChanged, variant = 'modal', reloadKey, onRecharge }) => {
  const [store, setStore] = useState<FeStore | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // En una ref para que `load` no cambie en cada render del padre.
  const pointsChanged = useRef(onPointsChanged);
  pointsChanged.current = onPointsChanged;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await apiService.getFeStore();
      if (!mountedRef.current) return;
      setStore(data);
      setErrorMessage(null);
      pointsChanged.current(data.points);
    } catch (error) {
      if (!mountedRef.current) return;
      const msg = error instanceof Error ? error.message : 'Intenta de nuevo.';
      setErrorMessage(msg);
      Alert.alert('No se pudo abrir la tienda', msg);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load, reloadKey]);

  const points = store?.points ?? 0;
  const activeCoupons = store?.coupons.filter((c) => c.status === 'activo') ?? [];
  const pendingVoucher = store?.vouchers.some((v) => v.status === 'pendiente') ?? false;

  const buy = (percent: number, cost: number) => {
    if (busy !== null) return;
    Alert.alert(`Cupón −${percent}%`, `Usarás ${cost} Fe. Podrás aplicarlo al confirmar tu próximo viaje.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Canjear',
        onPress: async () => {
          if (busy !== null) return;
          setBusy(`c${percent}`);
          setErrorMessage(null);
          try {
            await apiService.buyCoupon(percent);
            await load();
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Intenta de nuevo.';
            setErrorMessage(msg);
            void load();
            Alert.alert('No se pudo canjear', msg);
          } finally {
            if (mountedRef.current) setBusy(null);
          }
        },
      },
    ]);
  };

  const diamonds = store?.diamonds ?? 0;
  const buyCombo = (combo: FeCombo) => {
    if (busy !== null) return;
    if (diamonds < combo.price) {
      Alert.alert(
        'Te faltan iones',
        `Este combo cuesta Li⁺ ${combo.price.toFixed(2)} y tienes Li⁺ ${diamonds.toFixed(2)}. Recarga tu billetera y vuelve.`,
        onRecharge ? [{ text: 'Cancelar', style: 'cancel' }, { text: 'Recargar', onPress: onRecharge }] : undefined,
      );
      return;
    }
    Alert.alert(
      combo.title,
      `Pagarás Li⁺ ${combo.price.toFixed(2)} de tu billetera y recibirás ${combo.passes} pases al instante. Cada pase es un viaje en rutas internas (dentro del IVIC).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comprar',
          onPress: async () => {
            if (busy !== null) return;
            setBusy(combo.id);
            setErrorMessage(null);
            try {
              const result = await apiService.buyCombo(combo.id);
              await load();
              hapticSuccess();
              Alert.alert('¡Combo listo!', `Ya tienes ${result.ride_passes} pases. Úsalos al confirmar un viaje en rutas internas.`);
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Intenta de nuevo.';
              setErrorMessage(msg);
              void load();
              Alert.alert('No se pudo comprar', msg);
            } finally {
              if (mountedRef.current) setBusy(null);
            }
          },
        },
      ],
    );
  };

  const sendVoucher = async () => {
    if (busy !== null) return;
    if (subject.trim().length < 3 || !photo) {
      setErrorMessage('Escribe la materia y adjunta la foto de tu nota.');
      Alert.alert('Faltan datos', 'Escribe la materia y adjunta la foto de tu nota.');
      return;
    }
    setBusy('voucher');
    setErrorMessage(null);
    try {
      await apiService.requestGradeVoucher(subject.trim(), note.trim(), await photoFormValue(photo, 'nota.jpg'));
      if (!mountedRef.current) return;
      setVoucherOpen(false);
      setSubject('');
      setNote('');
      setPhoto(null);
      await load();
      Alert.alert('Vale enviado', 'El administrador revisará tu evidencia. Si no se aprueba, te devolvemos el Fe.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Intenta de nuevo.';
      if (mountedRef.current) setErrorMessage(msg);
      void load();
      Alert.alert('No se pudo enviar', msg);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const isScreen = variant === 'screen';
  const body = (
    <>
          <View style={styles.header}>
            <View style={styles.flex}>
              {isScreen ? <ScreenTitle>Tienda de Fe</ScreenTitle> : <Text style={styles.title}>Tienda de Fe</Text>}
              <Text style={styles.muted}>Canjear no te baja de nivel: tu nivel cuenta todo el Fe que ganaste.</Text>
            </View>
            {!isScreen ? (
              <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Icon name="close-outline" size={20} color={theme.colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {!store ? (
            <View style={styles.skeletons}>
              <SkeletonCard lines={1} />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.list, isScreen && { paddingBottom: TAB_BAR_HEIGHT + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Tres saldos iguales: Fe, iones y pases de combo. Suben con el contenido. */}
              <View style={styles.tiles}>
                <View style={styles.tile} accessibilityLabel={`${points} Fe disponibles`}>
                  <Text style={[styles.tileValue, { color: theme.colors.gold }]}>{points}</Text>
                  <Text style={styles.tileLabel}>Fe</Text>
                </View>
                <View style={styles.tile} accessibilityLabel={`${diamonds.toFixed(2)} iones`}>
                  <Text style={[styles.tileValue, { color: theme.colors.diamond }]}>Li⁺ {diamonds.toFixed(2)}</Text>
                  <Text style={styles.tileLabel}>Iones</Text>
                </View>
                <View style={styles.tile} accessibilityLabel={`${store?.ride_passes ?? 0} pases de viaje`}>
                  <Text style={[styles.tileValue, { color: theme.colors.primary }]}>{store?.ride_passes ?? 0}</Text>
                  <Text style={styles.tileLabel}>Pases</Text>
                </View>
              </View>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              {(store.combos ?? []).length > 0 ? (
                <>
                  <SectionLabel color={theme.colors.gold} style={styles.section}>COMBOS de viajes</SectionLabel>
                  <Text style={styles.muted}>
                    Paga con iones y recibe tus pases al instante. Cada pase es un viaje en rutas internas (dentro del IVIC).
                  </Text>
                  <View style={styles.comboRow}>
                    {(store.combos ?? []).map((combo, index) => (
                      <Reveal key={combo.id} index={index} style={styles.comboCell}>
                      <PressableScale
                        variant="glass"
                        style={[styles.combo, diamonds < combo.price && styles.dim]}
                        onPress={() => buyCombo(combo)}
                        disabled={busy !== null}
                        accessibilityLabel={`${combo.title} por ${combo.price.toFixed(2)} iones`}
                      >
                        {combo.id === 'combo-20' ? (
                          <View style={styles.comboBadge}>
                            <Text style={styles.comboBadgeText}>Más popular</Text>
                          </View>
                        ) : null}
                        <View style={styles.comboGem}>
                          <Text style={styles.comboGemText}>{combo.passes}</Text>
                        </View>
                        <Text style={styles.comboTitle}>{combo.passes} viajes</Text>
                        <Text style={styles.comboPrice}>{busy === combo.id ? 'Comprando…' : `Li⁺ ${combo.price.toFixed(2)}`}</Text>
                        <Text style={[styles.comboUnit, diamonds < combo.price && { color: theme.colors.gold }]}>
                          {diamonds < combo.price
                            ? `Te faltan Li⁺ ${(combo.price - diamonds).toFixed(2)}`
                            : `Li⁺ ${(combo.price / combo.passes).toFixed(2)} por viaje`}
                        </Text>
                      </PressableScale>
                      </Reveal>
                    ))}
                  </View>
                </>
              ) : null}
              {store.store_discount ? (
                <Text style={[styles.muted, { color: theme.colors.gold }]}>Precios con 10 % de descuento por tu nivel.</Text>
              ) : null}
              <SectionLabel color={theme.colors.gold} style={styles.section}>Cupones para tu próximo viaje</SectionLabel>
              <View style={styles.row}>
                {store.coupon_prices.map(({ percent, cost }) => {
                  const affordable = points >= cost;
                  return (
                    <PressableScale variant="glass"
                      key={percent}
                      containerStyle={styles.flex}
                      style={[styles.coupon, !affordable && styles.dim]}
                      onPress={() => buy(percent, cost)}
                      disabled={!affordable || busy !== null}
                      accessibilityLabel={`Cupón de ${percent} por ciento por ${cost} Fe`}
                    >
                      <Text style={styles.couponPercent}>−{percent}%</Text>
                      <Text style={styles.couponCost}>
                        {busy === `c${percent}` ? 'Canjeando…' : affordable ? `${cost} Fe` : `Faltan ${cost - points} Fe`}
                      </Text>
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

              <SectionLabel color={theme.colors.gold} style={styles.section}>Pasar con 20</SectionLabel>
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Icon name="book-open-outline" size={26} color={theme.colors.gold} />
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
                          <Icon name="image-outline" size={22} color={theme.colors.textSecondary} />
                          <Text style={styles.muted}>Adjuntar foto de la nota</Text>
                        </>
                      )}
                    </Pressable>
                    <PressableScale variant="solid" accent={theme.colors.gold} style={styles.primary} onPress={sendVoucher} disabled={busy !== null}>
                      <Text style={styles.primaryText}>{busy === 'voucher' ? 'Enviando…' : `Enviar · ${store.voucher_cost} Fe`}</Text>
                    </PressableScale>
                  </View>
                ) : (
                  <PressableScale variant="solid" accent={theme.colors.gold}
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
    </>
  );

  if (isScreen) return <View style={styles.screen}>{body}</View>;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>{body}</View>
      </View>
    </Modal>
  );
};

const styles = themed(() => ({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: theme.colors.bgDark,
    backgroundImage: theme.fx.aurora,
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  tile: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  tileValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.bold,
    fontSize: 18,
  },
  tileLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  skeletons: {
    gap: 10,
    marginTop: 8,
  },
  comboRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  comboCell: {
    flexGrow: 1,
    flexBasis: '45%',
  },
  comboBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: `${theme.colors.gold}26`,
    borderWidth: 1,
    borderColor: `${theme.colors.gold}59`,
  },
  comboBadgeText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
    color: theme.colors.gold,
  },
  combo: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.diamond,
    backgroundColor: theme.colors.glassBg,
  },
  // Rombo: un cuadrado girado 45°, con el número de pases derecho en el centro.
  comboGem: {
    width: 52,
    height: 52,
    marginVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.diamond,
    transform: [{ rotate: '45deg' }],
  },
  comboGemText: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.diamond,
    transform: [{ rotate: '-45deg' }],
  },
  comboTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  comboPrice: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.diamond,
  },
  comboUnit: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
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
    fontSize: 13,
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
    boxShadow: theme.glass.shadow,
    backgroundImage: theme.fx.sheen,
  },
  balance: {
    fontVariant: ['tabular-nums'],
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
    boxShadow: theme.glass.shadow,
    backgroundImage: theme.fx.sheen,
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
    opacity: 0.75,
  },
  card: {
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    backgroundImage: theme.fx.sheen,
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
    minHeight: 52,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gold,
  },
  primaryText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
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
  errorText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.error,
  },
}));
