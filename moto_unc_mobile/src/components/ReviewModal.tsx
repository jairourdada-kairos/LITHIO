import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View, Modal, TouchableOpacity, TextInput } from 'react-native';
import { theme } from '../constants/theme';
import { ReviewSubmission } from '../types';

interface ReviewModalProps {
  visible: boolean;
  rideId: number;
  driverName: string;
  onClose: () => void;
  onSubmit: (review: ReviewSubmission) => void;
}

const AVAILABLE_BADGES = [
  "Manejo Seguro 🛡️",
  "Casco Limpio 🪖",
  "Muy Puntual ⏱️",
  "Buena Vibra 🎵",
  "Moto Impecable ✨",
  "Ruta Ágil ⚡"
];

export const ReviewModal: React.FC<ReviewModalProps> = ({
  visible,
  rideId,
  driverName,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState(5);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([
    "Manejo Seguro 🛡️",
    "Casco Limpio 🪖"
  ]);
  const [comment, setComment] = useState('');

  const toggleBadge = (badge: string) => {
    if (selectedBadges.includes(badge)) {
      setSelectedBadges(selectedBadges.filter(b => b !== badge));
    } else {
      setSelectedBadges([...selectedBadges, badge]);
    }
  };

  const handleSend = () => {
    const trimmedComment = comment.trim();
    const words = trimmedComment.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const describesTrip = /\b(viaje|viajar|conductor|conductora|moto|ruta|trayecto|casco|manejo|puntual|recorrido|servicio|pasajero|destino|origen|experiencia|seguridad|amable)\b/i.test(trimmedComment);
    if (trimmedComment.length < 25 || new Set(words).size < 4 || !describesTrip) {
      Alert.alert('Cuéntanos cómo fue', 'Escribe al menos 25 caracteres, cuatro palabras distintas y un detalle relacionado con el viaje para recibir Fe.');
      return;
    }
    onSubmit({
      ride_id: rideId,
      rating,
      badges: selectedBadges,
      comment: trimmedComment
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>⭐ Califica a tu Conductor</Text>
          <Text style={styles.subtitle}>¿Qué tal fue tu viaje con {driverName}?</Text>

          {/* Selector de Estrellas */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                <Text style={[styles.starIcon, star <= rating && styles.starSelected]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingScore}>{rating} de 5 Estrellas</Text>

          {/* Etiquetas Gamificadas */}
          <Text style={styles.badgesTitle}>Insignias para el Conductor:</Text>
          <View style={styles.badgesContainer}>
            {AVAILABLE_BADGES.map((b) => {
              const isSelected = selectedBadges.includes(b);
              return (
                <TouchableOpacity
                  key={b}
                  style={[styles.badgeBtn, isSelected && styles.badgeBtnSelected]}
                  onPress={() => toggleBadge(b)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                    {b}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.commentTitle}>¿Cómo fue la experiencia? (obligatorio)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Ej. Muy atento y manejo responsable en la Panamericana."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={3}
            value={comment}
            onChangeText={setComment}
            maxLength={500}
          />
          <Text style={styles.commentTitle}>{comment.trim().length}/500 · mínimo 25 caracteres</Text>

          {/* Recompensa Instantánea */}
          <View style={styles.rewardNotice}>
            <Text style={styles.rewardIcon}>🪙</Text>
            <Text style={styles.rewardNoticeText}>
              ¡Recibirás <Text style={styles.boldText}>+20 Fe</Text> si tu reseña aporta detalles útiles!
            </Text>
          </View>

          {/* Botones */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Omitir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSend}>
              <Text style={styles.submitBtnText}>Enviar reseña y ganar Fe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.cardBorder,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  starIcon: {
    fontSize: 38,
    color: '#334155',
  },
  starSelected: {
    color: theme.colors.gold,
  },
  ratingScore: {
    textAlign: 'center',
    color: theme.colors.gold,
    fontWeight: '800',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 16,
  },
  badgesTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  badgeBtn: {
    backgroundColor: theme.colors.cardElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  badgeBtnSelected: {
    borderColor: theme.colors.gold,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextSelected: {
    color: theme.colors.gold,
    fontWeight: '700',
  },
  commentTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  commentInput: {
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    color: theme.colors.textPrimary,
    padding: 10,
    fontSize: 12,
    textAlignVertical: 'top',
    height: 60,
    marginBottom: 14,
  },
  rewardNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: 10,
    borderRadius: theme.radius.sm,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  rewardIcon: {
    fontSize: 18,
  },
  rewardNoticeText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  boldText: {
    color: theme.colors.gold,
    fontWeight: '800',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: theme.colors.cardElevated,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: theme.colors.gold,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#0B0F19',
    fontSize: 13,
    fontWeight: '900',
  }
});
