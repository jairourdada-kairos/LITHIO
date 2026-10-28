/**
 * WalletScreen.tsx — Billetera: saldo en diamantes, Fe y movimientos
 *
 * Pasajero: Recargar · A un enlace · Donar al Fondo Solidario.
 * Conductor: Retirar · Taller aliado · A un enlace.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Icon, IconName } from '../../components/ui/Icon';
import { theme, themed } from '../../constants/theme';
import { PressableScale } from '../../components/brand/PressableScale';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import { apiService, WalletInfo, WalletTransaction } from '../../services/api';
import { WalletActionSheet } from '../../components/WalletActionSheet';
import { formatBs, useBcvRate } from '../../services/rates';
import type { SessionRole } from '../../services/session';

export type WalletAction = 'recargar' | 'enviar' | 'donar' | 'retirar' | 'taller';

interface Props {
  role: SessionRole;
  reloadKey: number;
}

const KIND_ICONS: Record<string, IconName> = {
  recarga: 'arrow-circle-down-outline',
  recepcion: 'arrow-circle-down-outline',
  cobro_viaje: 'motorbike',
  envio: 'paper-plane-outline',
  donacion: 'heart-outline',
  pago_viaje: 'motorbike',
  retiro: 'arrow-circle-up-outline',
  taller: 'settings-2-outline',
};

const STATUS_TEXT: Record<string, string> = { pendiente: 'En revisión', aprobado: '', rechazado: 'Rechazado' };

export const WalletScreen: React.FC<Props> = ({ role, reloadKey }) => {
  const [action, setAction] = useState<WalletAction | null>(null);
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
      <Text style={styles.title}>Billetera</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.muted}>{role === 'conductor' ? 'Ganancias disponibles' : 'Saldo disponible'}</Text>
        <Text style={styles.balance}>◆ {(wallet?.balance ?? 0).toFixed(2)}</Text>
        <Text style={styles.muted}>
          {bcv ? `≈ ${formatBs(wallet?.balance ?? 0, bcv)} · ` : ''}1 ◆ = 1 USD · Fe {wallet?.points ?? 0}
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
              <View style={[styles.actionIcon, action.primary ? { backgroundColor: theme.colors.diamond } : null]}>
                <Icon
                  name={action.icon}
                  size={22}
                  color={action.primary ? theme.colors.bgDark : theme.colors.textPrimary}
                />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </PressableScale>
          ))}
        </View>
      </View>

      {role === 'pasajero' ? (
        <View style={styles.fund}>
          <Icon name="heart-outline" size={26} color={theme.colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.fundTitle}>Fondo Solidario LITHIO</Text>
            <Text style={styles.fundBody}>Tus donaciones pagan viajes a estudiantes que lo necesitan.</Text>
            <View style={styles.fundStats}>
              <Text style={styles.fundValue}>◆ {(wallet?.fund.donated ?? 0).toFixed(2)}</Text>
              <Text style={styles.muted}> donados · {wallet?.fund.donors ?? 0} donantes</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View>
        <Text style={styles.sectionTitle}>Movimientos</Text>
        {error ? <Text style={styles.muted}>{error}</Text> : null}
        {wallet && wallet.transactions.length === 0 ? (
          <Text style={styles.empty}>Aún no tienes movimientos. Tus recargas, viajes y envíos aparecerán aquí.</Text>
        ) : (
          <View style={styles.list}>
            {wallet?.transactions.map((tx, index) => (
              <Movement key={tx.id} tx={tx} divider={index > 0} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
    <WalletActionSheet action={action} balance={wallet?.balance ?? 0} onClose={() => setAction(null)} onDone={load} />
    </>
  );
};

const Movement: React.FC<{ tx: WalletTransaction; divider: boolean }> = ({ tx, divider }) => {
  const incoming = tx.amount > 0;
  const pending = tx.status === 'pendiente';
  const color = tx.status === 'rechazado' ? theme.colors.textMuted : pending ? theme.colors.gold : incoming ? theme.colors.success : theme.colors.textPrimary;
  const detail = [tx.counterpart_name, tx.note, STATUS_TEXT[tx.status]].filter(Boolean).join(' · ');
  return (
    <View style={[styles.movement, divider && styles.divider]}>
      <View style={styles.movementIcon}>
        <Icon name={KIND_ICONS[tx.kind] || 'swap-outline'} size={18} color={theme.colors.textSecondary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.movementLabel}>{tx.label}</Text>
        {detail ? <Text style={styles.movementDetail} numberOfLines={1}>{detail}</Text> : null}
      </View>
      <Text style={[styles.amount, { color }, tx.status === 'rechazado' && styles.struck]}>
        {incoming ? '+' : '−'}
        {Math.abs(tx.amount).toFixed(2)}
      </Text>
    </View>
  );
};

const styles = themed(() => ({
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
  },
  balance: {
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
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.textPrimary,
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
    fontSize: 14.5,
    color: theme.colors.textPrimary,
  },
  movementDetail: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  amount: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
}));
