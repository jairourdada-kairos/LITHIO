/**
 * AdminScreen.tsx — Administración dentro de la app (solo administradores)
 *
 * Conductores: revisar datos → citar inspección → dar luz verde, o rechazar.
 * Billetera: aprobar o rechazar recargas, retiros y canjes del taller.
 * Vales: revisar la evidencia del vale «Pasar con 20».
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Alert, Image, ImageURISource } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Avatar } from '../../components/ui/Avatar';
import { PressableScale } from '../../components/brand/PressableScale';
import { PromptConfig, PromptSheet } from '../../components/ui/PromptSheet';
import { AdminApplication, AdminVoucher, AdminWalletItem, apiService, VerificationStatus } from '../../services/api';

type Section = 'drivers' | 'wallet' | 'vouchers';

const SECTION_LABEL: Record<Section, string> = { drivers: 'Postulaciones', wallet: 'Billetera', vouchers: 'Vales' };

const STATUS_LABEL: Record<VerificationStatus, string> = {
  pendiente: 'Nueva',
  en_revision: 'En revisión',
  inspeccion: 'Inspección',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
};

// Siguiente paso de cada estado: texto del botón y estado al que avanza.
const NEXT_STEP: Partial<Record<VerificationStatus, { label: string; status: VerificationStatus }>> = {
  pendiente: { label: 'Iniciar revisión', status: 'en_revision' },
  en_revision: { label: 'Citar inspección', status: 'inspeccion' },
  inspeccion: { label: 'Dar luz verde', status: 'aprobado' },
  rechazado: { label: 'Reabrir revisión', status: 'en_revision' },
};

const KIND_ICON = { recarga: 'arrow-bottom-left', retiro: 'bank-transfer-out', taller: 'wrench-outline' } as const;

export const AdminScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('drivers');
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [walletItems, setWalletItems] = useState<AdminWalletItem[]>([]);
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptConfig | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [apps, wallet, pendingVouchers] = await Promise.all([
        apiService.getDriverApplications(),
        apiService.getPendingWallet(),
        apiService.getPendingVouchers(),
      ]);
      setApplications(apps);
      setWalletItems(wallet);
      setVouchers(pendingVouchers);
    } catch (error) {
      Alert.alert('No se pudo cargar la administración', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusyId(key);
    try {
      await action();
      await load();
    } catch (error) {
      Alert.alert('No se pudo completar la acción', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setBusyId(null);
    }
  };

  const advance = (app: AdminApplication) => {
    const next = NEXT_STEP[app.status];
    if (!next) return;
    if (next.status === 'inspeccion') {
      setPrompt({
        title: 'Citar inspección',
        message: `Indica cuándo y dónde revisarás la moto de ${app.name}. Lo verá en su postulación.`,
        label: 'Fecha y lugar',
        placeholder: 'Lunes 9:00 am, estacionamiento UNC',
        confirm: 'Citar inspección',
        accent: theme.colors.secondary,
        required: true,
        onSubmit: (value) => apiService.reviewDriverApplication(app.user_id, { status: 'inspeccion', inspection_date: value }).then(load),
      });
      return;
    }
    if (next.status === 'aprobado') {
      Alert.alert('Dar luz verde', `La cuenta de ${app.name} quedará activa como conductor.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprobar', onPress: () => void run(`a${app.user_id}`, () => apiService.reviewDriverApplication(app.user_id, { status: 'aprobado' })) },
      ]);
      return;
    }
    void run(`a${app.user_id}`, () => apiService.reviewDriverApplication(app.user_id, { status: next.status }));
  };

  const reject = (app: AdminApplication) =>
    setPrompt({
      title: 'Rechazar postulación',
      message: `Explica a ${app.name} por qué no fue aprobada o qué debe corregir.`,
      label: 'Nota para el conductor',
      placeholder: 'La licencia está vencida. Renuévala y vuelve a escribirnos.',
      confirm: 'Rechazar postulación',
      accent: theme.colors.error,
      required: true,
      onSubmit: (value) => apiService.reviewDriverApplication(app.user_id, { status: 'rechazado', notes: value }).then(load),
    });

  const reviewWallet = (item: AdminWalletItem, action: 'aprobar' | 'rechazar') => {
    if (action === 'rechazar') {
      setPrompt({
        title: `Rechazar ${item.label.toLowerCase()}`,
        message: `Se devolverá lo retenido a ${item.user_name} si corresponde.`,
        label: 'Motivo',
        placeholder: 'No encontramos el pago con esa referencia.',
        confirm: 'Rechazar',
        accent: theme.colors.error,
        onSubmit: (value) => apiService.reviewWalletTransaction(item.id, 'rechazar', value || undefined).then(load),
      });
      return;
    }
    void run(`w${item.id}`, () => apiService.reviewWalletTransaction(item.id, 'aprobar'));
  };

  const reviewVoucher = (voucher: AdminVoucher, action: 'aprobar' | 'rechazar') => {
    if (action === 'rechazar') {
      setPrompt({
        title: 'Rechazar vale',
        message: `Se devolverá el Fe a ${voucher.user_name}.`,
        label: 'Motivo',
        placeholder: 'La foto no muestra la nota con claridad.',
        confirm: 'Rechazar',
        accent: theme.colors.error,
        required: true,
        onSubmit: (value) => apiService.reviewVoucher(voucher.id, 'rechazar', value).then(load),
      });
      return;
    }
    void run(`v${voucher.id}`, () => apiService.reviewVoucher(voucher.id, 'aprobar'));
  };

  const counts = {
    drivers: applications.filter((a) => a.status !== 'rechazado').length,
    topups: walletItems.filter((w) => w.kind === 'recarga').length,
    payouts: walletItems.filter((w) => w.kind !== 'recarga').length,
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Administración" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.colors.secondary} />}
      >
        <View style={styles.counters}>
          <Counter value={counts.drivers} label="Conductores" color={theme.colors.secondary} />
          <Counter value={counts.topups} label="Recargas" color={theme.colors.diamond} />
          <Counter value={counts.payouts} label="Retiros y taller" color={theme.colors.gold} />
        </View>

        <View style={styles.segment}>
          {(['drivers', 'wallet', 'vouchers'] as Section[]).map((value) => {
            const selected = section === value;
            return (
              <Pressable
                key={value}
                onPress={() => setSection(value)}
                style={[styles.segmentItem, selected && styles.segmentActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                  {SECTION_LABEL[value]}{value === 'vouchers' && vouchers.length ? ` · ${vouchers.length}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {section === 'drivers' ? (
          applications.length === 0 ? (
            <Empty icon="account-check-outline" text="No hay postulaciones pendientes." />
          ) : (
            applications.map((app) => {
              const next = NEXT_STEP[app.status];
              const busy = busyId === `a${app.user_id}`;
              return (
                <View key={app.user_id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Avatar name={app.name} size={40} ringColor={theme.colors.secondary} />
                    <View style={styles.flex}>
                      <Text style={styles.name}>{[app.name, app.last_name].filter(Boolean).join(' ')}</Text>
                      <Text style={styles.muted}>{app.moto.brand_model} · {app.moto.plate}</Text>
                    </View>
                    <Text style={[styles.badge, app.status === 'rechazado' && styles.badgeDanger]}>{STATUS_LABEL[app.status]}</Text>
                  </View>
                  <View style={styles.facts}>
                    <Fact label="Cédula" value={app.cedula} />
                    <Fact label="Licencia" value={app.license_number} />
                    <Fact label="Teléfono" value={app.phone} />
                    <Fact label="Carrera" value={[app.career, app.semester && `${app.semester}°`].filter(Boolean).join(' · ')} />
                    <Fact label="Moto" value={`${app.moto.color}${app.moto.year ? ` · ${app.moto.year}` : ''} · casco extra: ${app.moto.helmet_provided ? 'sí' : 'no'}`} />
                    {app.inspection_date ? <Fact label="Inspección" value={app.inspection_date} /> : null}
                    {app.notes ? <Fact label="Nota" value={app.notes} /> : null}
                  </View>
                  <View style={styles.actions}>
                    {app.status !== 'rechazado' ? (
                      <PressableScale containerStyle={styles.flex} style={styles.secondaryBtn} onPress={() => reject(app)} disabled={busy}>
                        <Text style={styles.secondaryText}>Rechazar</Text>
                      </PressableScale>
                    ) : null}
                    {next ? (
                      <PressableScale containerStyle={styles.flex2} style={[styles.primaryBtn, { backgroundColor: theme.colors.secondary }]} onPress={() => advance(app)} disabled={busy}>
                        <Text style={[styles.primaryText, { color: theme.colors.onSecondary }]}>{busy ? 'Guardando…' : next.label}</Text>
                      </PressableScale>
                    ) : null}
                  </View>
                </View>
              );
            })
          )
        ) : section === 'vouchers' ? (
          vouchers.length === 0 ? (
            <Empty icon="school-outline" text="No hay vales «Pasar con 20» por revisar." />
          ) : (
            vouchers.map((voucher) => {
              const busy = busyId === `v${voucher.id}`;
              return (
                <View key={voucher.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.kindIcon}>
                      <MaterialCommunityIcons name="school-outline" size={20} color={theme.colors.gold} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.name}>{voucher.subject}</Text>
                      <Text style={styles.muted}>{voucher.user_name}</Text>
                    </View>
                  </View>
                  <VoucherEvidence id={voucher.id} />
                  {voucher.note ? <Fact label="Comentario" value={voucher.note} /> : null}
                  <View style={styles.actions}>
                    <PressableScale containerStyle={styles.flex} style={styles.secondaryBtn} onPress={() => reviewVoucher(voucher, 'rechazar')} disabled={busy}>
                      <Text style={styles.secondaryText}>Rechazar</Text>
                    </PressableScale>
                    <PressableScale containerStyle={styles.flex2} style={[styles.primaryBtn, { backgroundColor: theme.colors.gold }]} onPress={() => reviewVoucher(voucher, 'aprobar')} disabled={busy}>
                      <Text style={[styles.primaryText, { color: theme.colors.bgDark }]}>{busy ? 'Guardando…' : 'Aprobar vale'}</Text>
                    </PressableScale>
                  </View>
                </View>
              );
            })
          )
        ) : walletItems.length === 0 ? (
          <Empty icon="wallet-outline" text="No hay movimientos esperando revisión." />
        ) : (
          walletItems.map((item) => {
            const busy = busyId === `w${item.id}`;
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.kindIcon}>
                    <MaterialCommunityIcons name={KIND_ICON[item.kind]} size={20} color={theme.colors.diamond} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{item.label} · ◆ {Math.abs(item.amount).toFixed(2)}</Text>
                    <Text style={styles.muted}>{item.user_name} · {item.user_email}</Text>
                  </View>
                </View>
                <View style={styles.facts}>
                  {item.reference ? <Fact label={item.kind === 'recarga' ? 'Referencia' : 'Pagar a'} value={item.reference} /> : null}
                  {item.note ? <Fact label="Detalle" value={item.note} /> : null}
                  <Fact label="Fecha" value={new Date(item.created_at).toLocaleString('es-VE')} />
                </View>
                <View style={styles.actions}>
                  <PressableScale containerStyle={styles.flex} style={styles.secondaryBtn} onPress={() => reviewWallet(item, 'rechazar')} disabled={busy}>
                    <Text style={styles.secondaryText}>Rechazar</Text>
                  </PressableScale>
                  <PressableScale containerStyle={styles.flex2} style={[styles.primaryBtn, { backgroundColor: theme.colors.diamond }]} onPress={() => reviewWallet(item, 'aprobar')} disabled={busy}>
                    <Text style={[styles.primaryText, { color: theme.colors.bgDark }]}>{busy ? 'Guardando…' : 'Aprobar'}</Text>
                  </PressableScale>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      <PromptSheet config={prompt} onClose={() => setPrompt(null)} />
    </View>
  );
};

/** La evidencia es privada: la imagen se pide con el token del administrador. */
const VoucherEvidence: React.FC<{ id: number }> = ({ id }) => {
  const [source, setSource] = useState<ImageURISource | null>(null);
  useEffect(() => {
    apiService.voucherEvidenceSource(id).then(setSource).catch(() => setSource(null));
  }, [id]);
  return source ? (
    <Image source={source} style={styles.evidence} resizeMode="contain" accessibilityLabel="Foto de la nota" />
  ) : null;
};

const Counter: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => (
  <View style={[styles.counter, value > 0 && { borderColor: color }]}>
    <Text style={[styles.counterValue, { color }]}>{value}</Text>
    <Text style={styles.counterLabel}>{label}</Text>
  </View>
);

const Fact: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <View style={styles.fact}>
    <Text style={styles.factLabel}>{label}</Text>
    <Text style={styles.factValue}>{value || '—'}</Text>
  </View>
);

const Empty: React.FC<{ icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }> = ({ icon, text }) => (
  <View style={styles.empty}>
    <MaterialCommunityIcons name={icon} size={40} color={theme.colors.textMuted} />
    <Text style={styles.muted}>{text}</Text>
  </View>
);

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  flex: {
    flex: 1,
  },
  evidence: {
    width: '100%',
    height: 220,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  flex2: {
    flex: 1.6,
  },
  counters: {
    flexDirection: 'row',
    gap: 8,
  },
  counter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  counterValue: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
  },
  counterLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: 11.5,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
  segmentActive: {
    backgroundColor: theme.colors.secondary,
  },
  segmentText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: theme.colors.onSecondary,
  },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    fontFamily: theme.fonts.bold,
    fontSize: 15.5,
    color: theme.colors.textPrimary,
  },
  muted: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  badge: {
    fontFamily: theme.fonts.semibold,
    fontSize: 11.5,
    color: theme.colors.gold,
    backgroundColor: theme.colors.goldSoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  badgeDanger: {
    color: theme.colors.error,
    backgroundColor: `${theme.colors.error}1A`,
  },
  facts: {
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
  },
  fact: {
    flexDirection: 'row',
    gap: 10,
  },
  factLabel: {
    width: 82,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  factValue: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  secondaryText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  primaryBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: theme.fonts.bold,
    fontSize: 14.5,
  },
  kindIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.diamondSoft,
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
  },
}));
