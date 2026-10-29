/**
 * DriverReviewsScreen.tsx — Mis reseñas (conductor)
 *
 * Promedio de estrellas y cada reseña que dejaron los pasajeros al terminar un
 * viaje: estrellas, insignias y el comentario completo, con la ruta y la fecha.
 * Se actualiza al deslizar hacia abajo; cada reseña nueva también llega como aviso.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TAB_BAR_HEIGHT } from '../../components/nav/BottomTabBar';
import { apiService, DriverReviews } from '../../services/api';

interface Props {
  accent: string;
  onBack: () => void;
}

/** El servidor guarda la hora en UTC sin zona: se interpreta como UTC. */
function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' });
}

const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

export const DriverReviewsScreen: React.FC<Props> = ({ accent, onBack }) => {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DriverReviews | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await apiService.getMyDriverReviews());
    } catch (error) {
      Alert.alert('No se pudieron cargar tus reseñas', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Mis reseñas" onBack={onBack} />
      {!data ? (
        <ActivityIndicator color={accent} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 32 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={accent} />}
        >
          <View style={styles.summary}>
            <Text style={styles.average}>{data.average !== null ? data.average.toFixed(1) : '—'}</Text>
            <View style={styles.summaryText}>
              <Text style={styles.summaryStars}>{data.average !== null ? stars(Math.round(data.average)) : '☆☆☆☆☆'}</Text>
              <Text style={styles.muted}>
                {data.count === 0 ? 'Aún no tienes reseñas' : `${data.count} ${data.count === 1 ? 'reseña' : 'reseñas'} de tus pasajeros`}
              </Text>
            </View>
          </View>

          {data.count === 0 ? (
            <Text style={styles.empty}>Cuando un pasajero califique un viaje contigo, su reseña aparecerá aquí.</Text>
          ) : (
            data.reviews.map((review) => (
              <View key={review.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardStars}>{stars(review.rating)}</Text>
                  <Text style={styles.muted}>{formatDate(review.created_at)}</Text>
                </View>
                {review.origin ? (
                  <Text style={styles.route} numberOfLines={1}>
                    {review.origin} → {review.destination}
                    {review.passenger_name ? ` · ${review.passenger_name.split(' ')[0]}` : ''}
                  </Text>
                ) : null}
                {review.badges.length ? (
                  <View style={styles.badges}>
                    {review.badges.map((badge) => (
                      <Text key={badge} style={styles.badge}>{badge}</Text>
                    ))}
                  </View>
                ) : null}
                {review.comment ? (
                  <Text style={styles.comment} selectable>“{review.comment}”</Text>
                ) : (
                  <Text style={styles.muted}>Sin comentario.</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
  },
  average: {
    fontFamily: theme.fonts.bold,
    fontSize: 44,
    color: theme.colors.gold,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryStars: {
    fontSize: 22,
    letterSpacing: 2,
    color: theme.colors.gold,
  },
  card: {
    padding: 16,
    gap: 8,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardStars: {
    fontSize: 18,
    letterSpacing: 1,
    color: theme.colors.gold,
  },
  route: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
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
  comment: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  muted: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
}));
