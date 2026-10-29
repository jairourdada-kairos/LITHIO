/**
 * RideDetailScreen.tsx — Detalle de un viaje del historial
 *
 * Para pasajero y conductor: ruta, fecha, línea de tiempo de estados, monto
 * (USD y Bs, con cupón si hubo), método y referencia de pago, comprobante,
 * calificación y la otra persona del viaje. El pasajero de un viaje pagado
 * por Pago Móvil, o su conductor, pueden adjuntar o cambiar la captura del comprobante.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, ImageURISource, ActivityIndicator, Alert, Pressable } from 'react-native';
import { Icon } from '../../components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Avatar } from '../../components/ui/Avatar';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import { apiService, RideDetail } from '../../services/api';
import { photoFormValue, pickDocumentPhoto } from '../../services/avatar';
import { formatBs, useBcvRate } from '../../services/rates';
import { statusInfo } from './RidesListScreen';
import { ReviewModal } from '../../components/ReviewModal';
import type { ReviewSubmission } from '../../types';

interface Props {
  rideId: number;
  accent: string;
  onBack: () => void;
}

const PAYMENT_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  diamantes: 'Diamantes ◆',
  puntos: 'Fe',
};

/** El servidor guarda la hora en UTC sin zona: se interpreta como UTC. */
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value: string | null): string {
  const date = toDate(value);
  return date
    ? date.toLocaleString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
}

export const RideDetailScreen: React.FC<Props> = ({ rideId, accent, onBack }) => {
  const insets = useSafeAreaInsets();
  const bcv = useBcvRate();
  const [ride, setRide] = useState<RideDetail | null>(null);
  const [receipt, setReceipt] = useState<ImageURISource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    try {
      const detail = await apiService.getRideDetail(rideId);
      setRide(detail);
      setReceipt(detail.has_receipt ? await apiService.rideReceiptSource(rideId) : null);
    } catch (error) {
      Alert.alert('No se pudo abrir el viaje', error instanceof Error ? error.message : 'Intenta de nuevo.');
    }
  }, [rideId]);

  useEffect(() => {
    void load();
  }, [load]);

  const attachReceipt = async () => {
    const uri = await pickDocumentPhoto();
    if (!uri) return;
    setUploading(true);
    try {
      await apiService.uploadRideReceipt(rideId, await photoFormValue(uri, 'comprobante.jpg'));
      await load();
      const other = ride?.viewer_role === 'conductor' ? 'el pasajero' : 'el conductor';
      Alert.alert('Comprobante guardado', `Quedó adjunto a este viaje; ${other} y el administrador pueden verlo.`);
    } catch (error) {
      Alert.alert('No se pudo guardar el comprobante', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const submitReview = async (review: ReviewSubmission) => {
    try {
      await apiService.submitReview(ride!.passenger.id, review);
      setReviewing(false);
      await load();
      setTimeout(() => Alert.alert('¡Gracias por tu reseña!', 'El conductor ya puede leerla.'), 350);
    } catch (error) {
      Alert.alert('No se pudo enviar la reseña', error instanceof Error ? error.message : 'Intenta de nuevo.');
    }
  };

  if (!ride) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Detalle del viaje" onBack={onBack} />
        <ActivityIndicator color={accent} style={{ marginTop: 48 }} />
      </View>
    );
  }

  const status = statusInfo()[ride.status] || { label: ride.status, color: theme.colors.textMuted };
  const other = ride.viewer_role === 'conductor' ? ride.passenger : ride.driver;
  const fullFare = ride.coupon_percent ? ride.fare_amount / (1 - ride.coupon_percent / 100) : null;

  return (
    <View style={styles.root}>
      <ScreenHeader title={`Viaje #${ride.id}`} onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 32 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.date}>{ride.is_scheduled && ride.scheduled_time ? ride.scheduled_time : formatDateTime(ride.created_at)}</Text>
          <Text style={[styles.chip, { color: status.color, borderColor: status.color }]}>{status.label}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.route}>
            <View style={styles.stops}>
              <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
              <View style={styles.line} />
              <View style={[styles.dot, { backgroundColor: theme.colors.secondary }]} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.place}>{ride.origin}</Text>
              <Text style={[styles.place, { marginTop: 18 }]}>{ride.destination}</Text>
            </View>
          </View>
        </View>

        <Section title={ride.viewer_role === 'conductor' ? 'Pasajero' : 'Conductor'}>
          <View style={styles.personRow}>
            <Avatar name={other.name} uri={other.avatar_url} size={44} ringColor={accent} />
            <View style={styles.flex}>
              <Text style={styles.strong}>{[other.name, other.last_name].filter(Boolean).join(' ')}</Text>
              {ride.viewer_role !== 'conductor' && ride.driver.moto ? (
                <Text style={styles.muted}>
                  {ride.driver.moto}
                  {ride.driver.moto_color ? ` · ${ride.driver.moto_color}` : ''}
                  {ride.driver.plate ? ` · ${ride.driver.plate}` : ''}
                </Text>
              ) : null}
            </View>
          </View>
        </Section>

        <Section title="Pago">
          <Row label="Monto" value={`$${ride.fare_amount.toFixed(2)}${bcv ? ` · ${formatBs(ride.fare_amount, bcv)}` : ''}`} strong />
          {ride.coupon_percent ? (
            <Row label="Cupón" value={`−${ride.coupon_percent}%${fullFare ? ` (antes $${fullFare.toFixed(2)})` : ''}`} />
          ) : null}
          <Row label="Método" value={PAYMENT_LABEL[ride.payment_method] ?? ride.payment_method} />
          {ride.payment_reference ? <Row label="Referencia" value={ride.payment_reference} mono /> : null}
          {ride.fe_rewarded ? <Row label="Hierro ganado" value={`+${ride.fe_rewarded} Fe`} /> : null}
        </Section>

        {ride.payment_method === 'pago_movil' ? (
          <Section title="Comprobante">
            {receipt ? (
              <>
                <Image source={receipt} style={styles.receipt} resizeMode="contain" accessibilityLabel="Captura del comprobante de pago" />
                <Text style={styles.muted}>Subido {formatDateTime(ride.receipt_uploaded_at)}</Text>
              </>
            ) : (
              <Text style={styles.muted}>
                {ride.viewer_role === 'conductor'
                  ? 'Aún no hay captura. Si el pasajero te la mandó por otro lado, adjúntala tú.'
                  : 'Aún no adjuntaste la captura del pago.'}
              </Text>
            )}
            {ride.can_upload_receipt ? (
              <Pressable
                onPress={attachReceipt}
                disabled={uploading}
                style={({ pressed }) => [styles.attach, { borderColor: accent }, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                {uploading ? (
                  <ActivityIndicator color={accent} />
                ) : (
                  <>
                    <Icon name="image-outline" size={20} color={accent} />
                    <Text style={[styles.attachText, { color: accent }]}>{receipt ? 'Cambiar comprobante' : 'Adjuntar comprobante'}</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </Section>
        ) : null}

        <Section title="Línea de tiempo">
          {ride.timeline.map((entry, index) => {
            const info = statusInfo()[entry.status] || { label: entry.status, color: theme.colors.textMuted };
            return (
              <View key={`${entry.status}-${index}`} style={styles.step}>
                <View style={[styles.stepDot, { backgroundColor: info.color }]} />
                <Text style={[styles.strong, styles.flex]}>{info.label}</Text>
                <Text style={styles.muted}>{entry.at ? formatDateTime(entry.at) : ''}</Text>
              </View>
            );
          })}
        </Section>

        {ride.review ? (
          <Section title={ride.viewer_role === 'conductor' ? 'Reseña del pasajero' : 'Tu reseña'}>
            <Text style={[styles.stars, { color: theme.colors.gold }]}>
              {'★'.repeat(ride.review.rating)}
              {'☆'.repeat(5 - ride.review.rating)}
            </Text>
            {ride.review.badges.length ? (
              <View style={styles.badges}>
                {ride.review.badges.map((badge) => (
                  <Text key={badge} style={styles.badge}>{badge}</Text>
                ))}
              </View>
            ) : null}
            {ride.review.comment ? (
              <Text style={styles.body} selectable>“{ride.review.comment}”</Text>
            ) : (
              <Text style={styles.muted}>Sin comentario.</Text>
            )}
          </Section>
        ) : ride.can_review ? (
          <Section title="Calificación">
            <Text style={styles.muted}>Aún no calificas este viaje. Tu opinión le ayuda al conductor a mejorar.</Text>
            <Pressable
              onPress={() => setReviewing(true)}
              style={({ pressed }) => [styles.attach, { borderColor: theme.colors.gold }, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Icon name="star-outline" size={20} color={theme.colors.gold} />
              <Text style={[styles.attachText, { color: theme.colors.gold }]}>Calificar viaje</Text>
            </Pressable>
          </Section>
        ) : null}
      </ScrollView>

      <ReviewModal
        visible={reviewing}
        rideId={ride.id}
        driverName={ride.driver.name}
        onClose={() => setReviewing(false)}
        onSubmit={submitReview}
      />
    </View>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.card}>{children}</View>
  </View>
);

const Row: React.FC<{ label: string; value: string; strong?: boolean; mono?: boolean }> = ({ label, value, strong, mono }) => (
  <View style={styles.row}>
    <Text style={styles.muted}>{label}</Text>
    <Text style={[styles.value, strong && styles.strong, mono && styles.mono]}>{value}</Text>
  </View>
);

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  date: {
    flex: 1,
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  chip: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  card: {
    padding: 16,
    gap: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
  },
  route: {
    flexDirection: 'row',
    gap: 14,
  },
  stops: {
    alignItems: 'center',
    paddingTop: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    width: 2,
    height: 26,
    backgroundColor: theme.colors.cardBorder,
    marginVertical: 3,
  },
  place: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  strong: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  mono: {
    fontFamily: theme.fonts.mono,
  },
  muted: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  body: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  receipt: {
    width: '100%',
    height: 280,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgDark,
  },
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  attachText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.75,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stars: {
    fontSize: 22,
    letterSpacing: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.gold,
    backgroundColor: theme.colors.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
}));
