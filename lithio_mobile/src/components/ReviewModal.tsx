/**
 * ReviewModal.tsx — Calificar el viaje al terminar (o desde el historial)
 *
 * Estrellas, insignias opcionales y un comentario libre: puede hablar de
 * cualquier cosa del viaje y tener el largo que la persona quiera. El
 * conductor lo lee en "Mis reseñas" y el administrador en el panel.
 */

import React, { useEffect, useState } from 'react';
import { Text, View, Modal, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { theme, themed } from '../constants/theme';
import { ReviewSubmission } from '../types';

interface ReviewModalProps {
  visible: boolean;
  rideId: number;
  driverName: string;
  onClose: () => void;
  onSubmit: (review: ReviewSubmission) => Promise<void> | void;
}

const AVAILABLE_BADGES = [
  'Manejo Seguro 🛡️',
  'Casco Limpio 🪖',
  'Muy Puntual ⏱️',
  'Buena Vibra 🎵',
  'Moto Impecable ✨',
  'Ruta Ágil ⚡',
];

const RATING_LABEL = ['', 'Muy malo', 'Malo', 'Normal', 'Bueno', 'Excelente'];

/** El servidor guarda hasta 10 000 caracteres: unas cuatro páginas. */
const MAX_COMMENT = 10000;

export const ReviewModal: React.FC<ReviewModalProps> = ({ visible, rideId, driverName, onClose, onSubmit }) => {
  const [rating, setRating] = useState(5);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  // Cada viaje empieza con la reseña en blanco.
  useEffect(() => {
    if (!visible) return;
    setRating(5);
    setSelectedBadges([]);
    setComment('');
    setSending(false);
  }, [visible, rideId]);

  const toggleBadge = (badge: string) =>
    setSelectedBadges((prev) => (prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]));

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await onSubmit({ ride_id: rideId, rating, badges: selectedBadges, comment: comment.trim() });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>⭐ Califica tu viaje</Text>
            <Text style={styles.subtitle}>¿Qué tal fue tu viaje con {driverName}?</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  activeOpacity={0.7}
                  hitSlop={6}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: star === rating }}
                  accessibilityLabel={`${star} de 5 estrellas`}
                >
                  <Text style={[styles.starIcon, star <= rating && styles.starSelected]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingScore}>{rating} de 5 · {RATING_LABEL[rating]}</Text>

            <Text style={styles.sectionTitle}>Insignias (opcional)</Text>
            <View style={styles.badgesContainer}>
              {AVAILABLE_BADGES.map((b) => {
                const isSelected = selectedBadges.includes(b);
                return (
                  <TouchableOpacity
                    key={b}
                    style={[styles.badgeBtn, isSelected && styles.badgeBtnSelected]}
                    onPress={() => toggleBadge(b)}
                    activeOpacity={0.75}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>{b}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Comentario (opcional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Escribe lo que quieras: el trato, la moto, la ruta, la música, algo que mejorar…"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              value={comment}
              onChangeText={setComment}
              maxLength={MAX_COMMENT}
              textAlignVertical="top"
              accessibilityLabel="Comentario sobre el viaje"
            />
            <Text style={styles.hint}>
              {comment.trim().length ? `${comment.trim().length} caracteres · ` : ''}Lo leen el conductor y el administrador.
            </Text>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
                <Text style={styles.cancelBtnText}>Ahora no</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSend} disabled={sending} accessibilityRole="button">
                {sending ? <ActivityIndicator color="#0B0F19" /> : <Text style={styles.submitBtnText}>Enviar reseña</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = themed(() => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    maxHeight: '92%',
    backgroundColor: theme.colors.surfaceSolid,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    boxShadow: theme.glass.floating,
    overflow: 'hidden',
  },
  scroll: {
    padding: 20,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 19,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  starIcon: {
    fontFamily: theme.fonts.regular,
    fontSize: 40,
    color: theme.colors.cardElevated,
  },
  starSelected: {
    color: theme.colors.gold,
  },
  ratingScore: {
    fontFamily: theme.fonts.bold,
    textAlign: 'center',
    color: theme.colors.gold,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    fontSize: 13,
    marginBottom: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  badgeBtn: {
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: theme.colors.cardElevated,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  badgeBtnSelected: {
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldSoft,
  },
  badgeText: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  badgeTextSelected: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
  },
  commentInput: {
    fontFamily: theme.fonts.regular,
    backgroundColor: theme.colors.bgDark,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    color: theme.colors.textPrimary,
    padding: 12,
    fontSize: 16, // 16 o más: iOS no hace zoom al escribir
    lineHeight: 22,
    minHeight: 120,
    maxHeight: 260,
  },
  hint: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 18,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 50,
    justifyContent: 'center',
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  submitBtn: {
    flex: 2,
    minHeight: 50,
    justifyContent: 'center',
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: theme.fonts.bold,
    color: '#0B0F19',
    fontSize: 15,
  },
}));
