import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { theme, themed } from '../constants/theme';
import { Reward } from '../types';

interface RewardsStoreModalProps {
  visible: boolean;
  userPoints: number;
  rewards: Reward[];
  onClose: () => void;
  onRedeem: (reward: Reward) => Promise<{ discount_code: string }>;
}

export const RewardsStoreModal: React.FC<RewardsStoreModalProps> = ({
  visible,
  userPoints,
  rewards,
  onClose,
  onRedeem,
}) => {
  const [claimedCode, setClaimedCode] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);

  const handleClaim = async (reward: Reward) => {
    if (userPoints < reward.points_cost || redeemingId !== null) return;
    setRedeemingId(reward.id);
    try {
      const result = await onRedeem(reward);
      setClaimedCode(result.discount_code);
    } catch (error) {
      Alert.alert('No se pudo canjear', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Encabezado */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Recompensas Fe</Text>
              <Text style={styles.subtitle}>Canjea el hierro que ganas viajando</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Saldo actual */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Tu Saldo Disponible:</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceCoin}>Fe</Text>
              <Text style={styles.balancePoints}>{userPoints} Fe</Text>
            </View>
            <Text style={styles.balanceHint}>Gana +35 Fe por viaje y +20 Fe por una reseña útil.</Text>
          </View>

          {/* Notificación de Código Canjeado */}
          {claimedCode && (
            <View style={styles.codeSuccessBox}>
              <Text style={styles.codeSuccessTitle}>🎉 ¡Cupón Canjeado Exitosamente!</Text>
              <Text style={styles.codeSuccessSubtitle}>Muestra este código a tu conductor:</Text>
              <Text style={styles.couponCode}>{claimedCode}</Text>
            </View>
          )}

          {/* Catálogo de Recompensas */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {rewards.map((reward) => {
              const canAfford = userPoints >= reward.points_cost;
              return (
                <View key={reward.id} style={styles.rewardCard}>
                  <View style={styles.rewardTop}>
                    <Text style={styles.rewardIcon}>🎁</Text>
                    <View style={styles.rewardInfo}>
                      <Text style={styles.rewardTitle}>{reward.title}</Text>
                      <Text style={styles.rewardDesc}>{reward.description}</Text>
                    </View>
                  </View>

                  <View style={styles.rewardBottom}>
                    <View style={styles.costBadge}>
                      <Text style={styles.costCoin}>Fe</Text>
                      <Text style={styles.costText}>{reward.points_cost} Fe</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.redeemBtn, (!canAfford || redeemingId !== null) && styles.redeemBtnDisabled]}
                      onPress={() => handleClaim(reward)}
                      disabled={!canAfford || redeemingId !== null}
                    >
                      <Text style={[styles.redeemBtnText, (!canAfford || redeemingId !== null) && styles.redeemBtnTextDisabled]}>
                        {redeemingId === reward.id ? 'Procesando...' : canAfford ? 'Canjear ahora' : 'Fe insuficiente'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = themed(() => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.cardBg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: 20,
    maxHeight: '85%',
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
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
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
  balanceCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  balanceCoin: {
    fontFamily: theme.fonts.regular,
    fontSize: 22,
  },
  balancePoints: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
    fontSize: 24,
  },
  balanceHint: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  codeSuccessBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.success,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeSuccessTitle: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.success,
    fontSize: 13,
  },
  codeSuccessSubtitle: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  couponCode: {
    fontFamily: theme.fonts.bold,
    color: '#FFFFFF',
    backgroundColor: '#0F172A',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    letterSpacing: 2,
    marginTop: 6,
  },
  list: {
    gap: 12,
    paddingBottom: 20,
  },
  rewardCard: {
    backgroundColor: theme.colors.cardElevated,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  rewardTop: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  rewardIcon: {
    fontFamily: theme.fonts.regular,
    fontSize: 24,
  },
  rewardInfo: {
    flex: 1,
    gap: 2,
  },
  rewardTitle: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  rewardDesc: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  rewardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    gap: 5,
  },
  costCoin: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
  },
  costText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
    fontSize: 12,
  },
  redeemBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  redeemBtnDisabled: {
    backgroundColor: '#334155',
  },
  redeemBtnText: {
    fontFamily: theme.fonts.bold,
    color: '#0B0F19',
    fontSize: 12,
  },
  redeemBtnTextDisabled: {
    color: '#94A3B8',
  }
}));
