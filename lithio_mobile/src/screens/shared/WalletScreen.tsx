/**
 * WalletScreen.tsx — Billetera: saldo en iones, Fe y movimientos
 *
 * Pasajero: Recargar · A un enlace · Donar al Fondo Solidario.
 * Conductor: Retirar · Taller aliado · A un enlace.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Icon, IconName } from '../../components/ui/Icon';
import { theme, themed } from '../../constants/theme';
import { PressableScale } from '../../components/brand/PressableScale';
import { EmptyState, IconChip, OrbitDecor, ScreenTitle, SectionLabel } from '../../components/ui/Decor';
import { CountUp, Reveal, Sheen, SkeletonCard } from '../../components/ui/Motion';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import { apiService, TopupMethod, WalletInfo, WalletTransaction } from '../../services/api';
import { WalletActionSheet } from '../../components/WalletActionSheet';
import { formatBs, useBcvRate } from '../../services/rates';
import { photoFormValue, pickDocumentPhoto } from '../../services/avatar';
import type { SessionRole } from '../../services/session';
import { personName, plural } from '../../utils/text';

export type WalletAction = 'recargar' | 'enviar' | 'donar' | 'retirar' | 'taller';

interface Props {
  role: SessionRole;
  reloadKey: number;
  /** Abre la recarga con ese método; `nonce` cambia en cada petición. */
  recharge?: { method: TopupMethod; nonce: number } | null;
}

const KIND_ICONS: Record<string, IconName> = {
  recarga: 'arrow-circle-down-outline',
  recepcion: 'arrow-circle-down-outline',
  cobro_viaje: 'motorbike',
  envio: 'paper-plane-outline',
  donacion: 'heart-outline',
  donacion_pm: 'heart-outline',
  pago_viaje: 'motorbike',
  retiro: 'arrow-circle-up-outline',
  taller: 'settings-2-outline',
  bono_bienvenida: 'gift-outline',
  combo: 'shopping-bag-outline',
};

const STATUS_TEXT: Record<string, string> = { pendiente: 'En revisión', aprobado: '', rechazado: 'Rechazado' };
// Se pagan por Pago Móvil y llevan la captura del pago.
const RECEIPT_KINDS = new Set(['recarga', 'donacion_pm']);

export const WalletScreen: React.FC<Props> = ({ role, reloadKey, recharge }) => {
  const [action, setAction] = useState<WalletAction | null>(null);
  const [topupMethod, setTopupMethod] = useState<TopupMethod>('pago_movil');
  const rechargeNonce = recharge?.nonce;
  const rechargeMethod = recharge?.method;
  useEffect(() => {
    if (!rechargeNonce) return;
    setTopupMethod(rechargeMethod ?? 'pago_movil');
    setAction('recargar');
  }, [rechargeNonce, rechargeMethod]);
  const bcv = useBcvRate();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setWallet(await apiService.getWallet());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la billetera.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const actions: { key: WalletAction; label: string; icon: IconName; primary?: boolean }[] =
    role === 'conductor'
      ? [
          { key: 'retirar', label: 'Retirar', icon: 'arrow-circle-up-outline', primary: true },
          { key: 'taller', label: 'Taller', icon: 'settings-2-outline' },
          { key: 'enviar', label: 'A un enlace', icon: 'paper-plane-outline' },
        ]
      : [
          { key: 'recargar', label: 'Recargar', icon: 'plus-outline', primary: true },
          { key: 'enviar', label: 'A un enlace', icon: 'paper-plane-outline' },
          { key: 'donar', label: 'Donar', icon: 'heart-outline' },
        ];

  return (
    <>
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + 56 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.colors.diamond} />}
    >
      <ScreenTitle>Billetera</ScreenTitle>

      <Reveal index={1} style={styles.balanceCard}>
        <OrbitDecor color={theme.colors.diamond} />
        <Sheen />
        <Text style={styles.muted}>{role === 'conductor' ? 'Ganancias disponibles' : 'Saldo disponible'}</Text>
        <View style={styles.balanceRow}>
          <Text style={[styles.balance, styles.balanceUnit]}>Li⁺</Text>
          <CountUp value={wallet?.balance ?? 0} decimals={2} style={styles.balance} />
        </View>
        <Text style={styles.muted}>
          {bcv ? `≈ ${formatBs(wallet?.balance ?? 0, bcv)} · ` : ''}1 Li⁺ = 1 USD · Fe {wallet?.points ?? 0}
        </Text>
        {bcv ? (
          <Text style={styles.muted}>
            Tasa BCV {bcv.is_current ? 'de hoy' : `del ${bcv.date}`}: Bs {bcv.rate.toFixed(2)}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {actions.map((action) => (
            <PressableScale variant="glass"
              key={action.key}
              containerStyle={styles.flex}
              style={styles.action}
              onPress={() => setAction(action.key)}
              accessibilityLabel={action.label}
            >
              {/* Recargar se destaca solo con borde e ícono turquesa: los tres botones siguen iguales. */}
              <View
                style={[
                  styles.actionIcon,
                  action.primary
                    ? { backgroundColor: `${theme.colors.primary}1F`, borderWidth: 1, borderColor: `${theme.colors.primary}66` }
                    : null,
                ]}
              >
                <Icon
                  name={action.icon}
                  size={22}
                  color={action.primary ? theme.colors.primary : theme.colors.textPrimary}
                />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </PressableScale>
          ))}
        </View>
      </Reveal>

      {role === 'pasajero' ? (
        <View style={styles.fund}>
          <Icon name="heart-outline" size={26} color={theme.colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.fundTitle}>Fondo Solidario LITHIO</Text>
            <Text style={styles.fundBody}>Tus donaciones pagan viajes a estudiantes que lo necesitan.</Text>
            <View style={styles.fundStats}>
              <Text style={styles.fundValue}>Li⁺ {(wallet?.fund.donated ?? 0).toFixed(2)}</Text>
              <Text style={styles.muted}> donados · {plural(wallet?.fund.donors ?? 0, 'donante')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View>
        <SectionLabel style={styles.sectionTitle}>Movimientos</SectionLabel>
        {error ? <Text style={styles.muted}>{error}</Text> : null}
        {!wallet && !error ? (
          <View style={styles.skeletons}>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </View>
        ) : wallet && wallet.transactions.length === 0 ? (
          <EmptyState text="Aún no tienes movimientos. Tus recargas, viajes y envíos aparecerán aquí." />
        ) : (
          <View style={styles.list}>
            {wallet?.transactions.map((tx, index) => (
              <Reveal key={tx.id} index={Math.min(index, 8)}>
                <Movement tx={tx} divider={index > 0} onReceiptSaved={load} />
              </Reveal>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
    <WalletActionSheet
      action={action}
      balance={wallet?.balance ?? 0}
      pagoMovil={wallet?.pago_movil ?? null}
      binancePay={wallet?.binance_pay ?? null}
      initialTopupMethod={topupMethod}
      onClose={() => {
        setAction(null);
        setTopupMethod('pago_movil');
      }}
      onDone={load}
    />
    </>
  );
};

const Movement: React.FC<{ tx: WalletTransaction; divider: boolean; onReceiptSaved: () => void }> = ({ tx, divider, onReceiptSaved }) => {
  // La donación por Pago Móvil se guarda en positivo, pero no entra al saldo.
  const incoming = tx.amount > 0 && tx.kind !== 'donacion_pm';
  const pending = tx.status === 'pendiente';
  const [uploading, setUploading] = useState(false);
  const canAttach = pending && RECEIPT_KINDS.has(tx.kind);

  const attach = async () => {
    const uri = await pickDocumentPhoto();
    if (!uri) return;
    setUploading(true);
    try {
      await apiService.uploadWalletReceipt(tx.id, await photoFormValue(uri, 'comprobante.jpg'));
      onReceiptSaved();
      Alert.alert('Comprobante enviado', 'El administrador lo revisará para confirmar tu pago.');
    } catch (e) {
      Alert.alert('No se pudo enviar el comprobante', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };
  const color = tx.status === 'rechazado' ? theme.colors.textMuted : pending ? theme.colors.gold : incoming ? theme.colors.success : theme.colors.textPrimary;
  // Verde si entra, coral si sale, dorado si está en revisión
  const chipColor = tx.status === 'rechazado' ? theme.colors.textMuted : pending ? theme.colors.gold : incoming ? theme.colors.success : theme.colors.secondary;
  const detail = [personName(tx.counterpart_name), tx.note, STATUS_TEXT[tx.status]].filter(Boolean).join(' · ');
  return (
    <View style={[styles.movement, divider && styles.divider]}>
      <IconChip name={KIND_ICONS[tx.kind] || 'swap-outline'} size={36} color={chipColor} />
      <View style={styles.flex}>
        <Text style={styles.movementLabel}>{tx.label}</Text>
        {detail ? <Text style={styles.movementDetail} numberOfLines={1}>{detail}</Text> : null}
        {canAttach ? (
          <Pressable onPress={attach} disabled={uploading} accessibilityRole="button" hitSlop={8} style={styles.attach}>
            {uploading ? (
              <ActivityIndicator size="small" color={theme.colors.diamond} />
            ) : (
              <Text style={styles.attachText}>{tx.has_receipt ? '✓ Captura enviada · cambiar' : 'Adjuntar captura del pago'}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.amount, { color }, tx.status === 'rechazado' && styles.struck]}>
        {incoming ? '+' : '−'}
        {Math.abs(tx.amount).toFixed(2)}
      </Text>
    </View>
  );
};

const styles = themed(() => ({
  attach: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  attachText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.diamond,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
  },
  flex: {
    flex: 1,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 26,
    color: theme.colors.textPrimary,
  },
  muted: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  balanceCard: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    boxShadow: theme.glow.soft,
    backgroundImage: theme.fx.sheen,
    overflow: 'hidden',
  },
  balance: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.bold,
    fontSize: 38,
    color: theme.colors.diamond,
    marginVertical: 6,
    letterSpacing: -0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  action: {
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  skeletons: {
    gap: 10,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceUnit: {
    fontSize: 24, // el símbolo Li⁺ más pequeño que la cifra, como una unidad
    opacity: 0.85,
  },
  actionLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  fund: {
    flexDirection: 'row',
    gap: 14,
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
  },
  fundTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  fundBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  fundStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
  },
  fundValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.primary,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  list: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    backgroundImage: theme.fx.sheen,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    overflow: 'hidden',
  },
  movement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
  },
  movementIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  movementLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  movementDetail: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  amount: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.bold,
    fontSize: 15,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
}));
