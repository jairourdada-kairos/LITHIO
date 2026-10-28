import React from 'react';
import { Text, View, TouchableOpacity, Linking } from 'react-native';
import { theme, themed } from '../constants/theme';
import { Icon } from './ui/Icon';
import { PressableScale } from './brand/PressableScale';
import { Ride, RideStatus, UserRole } from '../types';
import { formatBs, useBcvRate } from '../services/rates';

interface ActiveRideCardProps {
  ride: Ride;
  role: UserRole;
  onUpdateStatus: (status: RideStatus) => void;
  onOpenReview: () => void;
  onCancel: () => void;
}

export const ActiveRideCard: React.FC<ActiveRideCardProps> = ({
  ride,
  role,
  onUpdateStatus,
  onOpenReview,
  onCancel,
}) => {
  const bcv = useBcvRate();
  const isDriver = role === 'conductor';

  // Texto y estilo según estado
  const getStatusDetails = () => {
    switch (ride.status) {
      case 'solicitado':
        return {
          title: isDriver ? '🔔 ¡Nueva Solicitud de Viaje!' : '⏳ Notificando al Conductor...',
          desc: isDriver 
            ? 'Un pasajero te ha seleccionado directamente para esta carrera.' 
            : `Esperando que ${ride.driver_name || 'el conductor'} acepte tu viaje.`,
          badgeColor: theme.colors.warning,
          step: 1
        };
      case 'aceptado':
        return {
          title: '✅ ¡Viaje Aceptado!',
          desc: isDriver 
            ? 'Has aceptado la carrera. Procede a buscar al pasajero.' 
            : `${ride.driver_name} ha aceptado tu viaje y viene por ti.`,
          badgeColor: theme.colors.primary,
          step: 2
        };
      case 'en_camino':
        return {
          title: '🏍️ Conductor en Camino',
          desc: 'El conductor está llegando al punto de encuentro en la UNC / zona.',
          badgeColor: theme.colors.primary,
          step: 3
        };
      case 'en_curso':
        return {
          title: '🚀 Carrera en Curso',
          desc: 'Viajando de forma segura hacia el destino.',
          badgeColor: theme.colors.secondary,
          step: 4
        };
      case 'completado':
        return {
          title: '🎉 ¡Llegaron al Destino!',
          desc: isDriver 
            ? '¡Carrera completada con éxito! Has sumado experiencia.' 
            : '¡Viaje finalizado! Deja una reseña útil para ganar Fe.',
          badgeColor: theme.colors.success,
          step: 5
        };
      default:
        return {
          title: 'Viaje Cancelado',
          desc: 'Este servicio fue cancelado.',
          badgeColor: theme.colors.error,
          step: 0
        };
    }
  };

  const details = getStatusDetails();

  // Llamar: la app Teléfono se abre con el número ya escrito; solo falta tocar "Llamar".
  const counterpartName = (isDriver ? ride.passenger_name : ride.driver_name) || (isDriver ? 'el pasajero' : 'el conductor');
  const phone = ride.counterpart_phone;
  const canCall = Boolean(phone) && ['aceptado', 'en_camino', 'en_curso'].includes(ride.status);
  const callCounterpart = () => {
    if (!phone) return;
    void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => undefined);
  };

  // Cancelar: los dos antes de empezar; con el pasajero a bordo, solo el conductor.
  const canCancel = isDriver
    ? ['aceptado', 'en_camino', 'en_curso'].includes(ride.status)
    : ['solicitado', 'aceptado', 'en_camino'].includes(ride.status);

  return (
    <View style={styles.container}>
      {/* Banner de Estado */}
      <View style={[styles.headerBanner, { backgroundColor: details.badgeColor }]}>
        <Text style={styles.bannerTitle}>{details.title}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.bannerDesc}>{details.desc}</Text>

        {/* Barra de Progreso Gamificada */}
        <View style={styles.progressRow}>
          {[1, 2, 3, 4, 5].map((step) => (
            <View
              key={step}
              style={[
                styles.stepSegment,
                step <= details.step && { backgroundColor: details.badgeColor }
              ]}
            />
          ))}
        </View>

        {/* Detalles del Viaje */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🛫 Origen:</Text>
            <Text style={styles.infoVal}>{ride.origin}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🏁 Destino:</Text>
            <Text style={styles.infoVal}>{ride.destination}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>💵 Tarifa:</Text>
            <Text style={styles.fareVal}>
              ${ride.fare_amount.toFixed(2)} USD{bcv ? ` · ${formatBs(ride.fare_amount, bcv)}` : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>💳 Pago:</Text>
            <Text style={styles.infoVal}>
              {ride.payment_method === 'pago_movil' 
                ? `Pago Móvil (${ride.payment_reference || 'Ref pendiente'})` 
                : ride.payment_method === 'diamantes' ? 'Diamantes' : 'Efectivo'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{isDriver ? '👤 Pasajero:' : '🏍️ Conductor:'}</Text>
            <Text style={styles.driverVal}>{isDriver ? ride.passenger_name : ride.driver_name}</Text>
          </View>
        </View>

        {!isDriver && ride.payment_method === 'pago_movil' && ride.driver_mobile_payment_number && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>📲 Datos de Pago Móvil del conductor</Text>
            {ride.driver_mobile_payment_bank && (
              <Text style={styles.infoVal}>Banco: {ride.driver_mobile_payment_bank}</Text>
            )}
            <Text style={styles.infoVal}>Teléfono: {ride.driver_mobile_payment_number}</Text>
            {ride.driver_mobile_payment_id && (
              <Text style={styles.infoVal}>Identificación: {ride.driver_mobile_payment_id}</Text>
            )}
            <Text style={styles.infoHint}>Solo visible para los participantes de este viaje.</Text>
          </View>
        )}

        {canCall ? (
          <View style={styles.contactBox}>
            <PressableScale
              variant="glass"
              accent={isDriver ? theme.colors.secondary : theme.colors.primary}
              style={styles.callBtn}
              onPress={callCounterpart}
              accessibilityLabel={`Llamar a ${counterpartName}`}
              accessibilityHint="Abre la app Teléfono con el número listo para llamar"
            >
              <View style={[styles.callIcon, { backgroundColor: isDriver ? theme.colors.secondary : theme.colors.primary }]}>
                <Icon name="phone-outline" size={20} color={theme.colors.bgDark} />
              </View>
              <View style={styles.callText}>
                <Text style={styles.callTitle} numberOfLines={1}>Llamar a {counterpartName.split(' ')[0]}</Text>
                <Text style={styles.callHint} numberOfLines={1}>{phone}</Text>
              </View>
              <Icon name="chevron-right-outline" size={20} color={theme.colors.textMuted} />
            </PressableScale>
          </View>
        ) : null}

        {/* Acciones para el Conductor */}
        {isDriver ? (
          <View style={styles.actionsBox}>
            {ride.status === 'solicitado' && (
              <View style={styles.driverButtonsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnSuccess]}
                  onPress={() => onUpdateStatus('aceptado')}
                >
                  <Text style={styles.btnTextWhite}>✅ Aceptar Carrera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnDanger]}
                  onPress={() => onUpdateStatus('rechazado')}
                >
                  <Text style={styles.btnTextWhite}>✕ Rechazar</Text>
                </TouchableOpacity>
              </View>
            )}

            {ride.status === 'aceptado' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnPrimary]}
                onPress={() => onUpdateStatus('en_camino')}
              >
                <Text style={styles.btnTextDark}>🛵 Voy en camino al punto</Text>
              </TouchableOpacity>
            )}

            {ride.status === 'en_camino' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnSecondary]}
                onPress={() => onUpdateStatus('en_curso')}
              >
                <Text style={styles.btnTextWhite}>🚀 Pasajero a bordo: Iniciar Carrera</Text>
              </TouchableOpacity>
            )}

            {ride.status === 'en_curso' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnSuccess]}
                onPress={() => onUpdateStatus('completado')}
              >
                <Text style={styles.btnTextWhite}>🏁 Finalizar Carrera y Cobrar</Text>
              </TouchableOpacity>
            )}

            {ride.status === 'completado' && (
              <View style={styles.completedNotice}>
                <Text style={styles.completedNoticeText}>
                  ✨ ¡Carrera completada con éxito! Ya estás disponible de nuevo.
                </Text>
              </View>
            )}

            {canCancel && (
              <TouchableOpacity style={[styles.actionBtn, styles.btnOutline]} onPress={onCancel} accessibilityRole="button">
                <Text style={styles.btnTextRed}>✕ Cancelar viaje</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Acciones para el Pasajero */
          <View style={styles.actionsBox}>
            {ride.status === 'completado' ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnGold]}
                onPress={onOpenReview}
              >
                <Text style={styles.btnTextDark}>⭐ Calificar y ganar +5 Fe</Text>
              </TouchableOpacity>
            ) : canCancel ? (
              <TouchableOpacity style={[styles.actionBtn, styles.btnOutline]} onPress={onCancel} accessibilityRole="button">
                <Text style={styles.btnTextRed}>{ride.status === 'solicitado' ? '✕ Cancelar solicitud' : '✕ Cancelar viaje'}</Text>
              </TouchableOpacity>
            ) : ride.status === 'en_curso' ? (
              <Text style={styles.onboardHint}>Ya vas a bordo. Si hay un problema, llama al conductor o pídele que cancele el viaje.</Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = themed(() => ({
  container: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.cardBorder,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  headerBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bannerTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: '#0B0F19',
  },
  body: {
    padding: 16,
  },
  bannerDesc: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  stepSegment: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.cardElevated,
    borderRadius: 2,
  },
  infoCard: {
    backgroundColor: theme.colors.cardElevated,
    padding: 12,
    borderRadius: theme.radius.sm,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  infoVal: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  infoHint: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  fareVal: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
    fontSize: 14,
  },
  driverVal: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    fontSize: 13,
  },
  actionsBox: {
    gap: 8,
  },
  contactBox: {
    marginBottom: 12,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  callIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callText: {
    flex: 1,
    gap: 2,
  },
  callTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  callHint: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  onboardHint: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  driverButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  btnSuccess: {
    backgroundColor: theme.colors.success,
  },
  btnDanger: {
    backgroundColor: theme.colors.error,
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
  },
  btnSecondary: {
    backgroundColor: theme.colors.secondary,
  },
  btnGold: {
    backgroundColor: theme.colors.gold,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  btnTextWhite: {
    fontFamily: theme.fonts.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  btnTextDark: {
    fontFamily: theme.fonts.bold,
    color: '#0B0F19',
    fontSize: 13,
  },
  btnTextRed: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.error,
    fontSize: 13,
  },
  completedNotice: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  completedNoticeText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.success,
    fontSize: 12,
    textAlign: 'center',
  }
}));
