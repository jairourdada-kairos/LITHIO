import React, { useEffect, useState } from 'react';
import { Text, View, TouchableOpacity, Linking, TextInput, ActivityIndicator, Alert, Share } from 'react-native';
import { theme, themed } from '../constants/theme';
import { Icon } from './ui/Icon';
import { Breathe, Celebrate } from './ui/Motion';
import { PressableScale } from './brand/PressableScale';
import { Ride, RideStatus, UserRole } from '../types';
import { formatBs, useBcvRate } from '../services/rates';
import { apiService } from '../services/api';
import { photoFormValue, pickDocumentPhoto } from '../services/avatar';
import { placeName } from '../utils/text';

/** Estados en los que tiene sentido pagar o anotar el Pago Móvil. */
// El Pago Móvil se confirma con el viaje ya aceptado: al pedirlo aún no hay nada que pagar ni anotar.
const PAYABLE: RideStatus[] = ['aceptado', 'en_camino', 'en_curso', 'completado'];

interface ActiveRideCardProps {
  ride: Ride;
  role: UserRole;
  onUpdateStatus: (status: RideStatus) => void;
  onOpenReview: () => void;
  onCancel: () => void;
  /** El pasajero anotó (o corrigió) la referencia del Pago Móvil. */
  onReferenceSaved?: (reference: string) => void;
}

/**
 * Paso del Pago Móvil dentro del viaje: con los datos del conductor ya a la
 * vista, el pasajero transfiere y anota la referencia; la captura es opcional.
 */
const PagoMovilConfirm: React.FC<{ ride: Ride; onReferenceSaved?: (reference: string) => void }> = ({ ride, onReferenceSaved }) => {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(!ride.payment_reference);
  const [saving, setSaving] = useState(false);
  const [receiptSent, setReceiptSent] = useState(Boolean(ride.has_receipt));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving) return;
    if (value.replace(/[\s-]/g, '').length < 4) {
      const msg = 'Escribe el número de referencia que te dio tu banco (al menos 4 caracteres).';
      setError(msg);
      Alert.alert('Falta la referencia', msg);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await apiService.setPaymentReference(ride.id, value);
      onReferenceSaved?.(saved);
      setEditing(false);
      setValue('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Intenta de nuevo.';
      setError(msg);
      Alert.alert('No se pudo guardar la referencia', msg);
    } finally {
      setSaving(false);
    }
  };

  const attach = async () => {
    if (uploading) return;
    const uri = await pickDocumentPhoto();
    if (!uri) return;
    setUploading(true);
    setError(null);
    try {
      await apiService.uploadRideReceipt(ride.id, await photoFormValue(uri, 'comprobante.jpg'));
      setReceiptSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Intenta de nuevo.';
      setError(msg);
      Alert.alert('No se pudo adjuntar la captura', msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.payBox}>
      <Text style={styles.payTitle}>💸 ¿Ya transferiste?</Text>
      {editing ? (
        <>
          <Text style={styles.infoHint}>
            Haz el Pago Móvil con los datos de arriba y anota aquí la referencia que te da el banco. Puedes hacerlo ahora o al llegar.
          </Text>
          <View style={styles.payRow}>
            <TextInput
              style={styles.payInput}
              placeholder="Referencia, ej. 849201"
              placeholderTextColor={theme.colors.textMuted}
              value={value}
              onChangeText={(next) => {
                setValue(next);
                if (error) setError(null);
              }}
              autoCapitalize="characters"
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              accessibilityLabel="Número de referencia del Pago Móvil"
            />
            <TouchableOpacity style={styles.paySave} onPress={() => void save()} disabled={saving} accessibilityRole="button">
              {saving ? <ActivityIndicator color={theme.colors.onPrimary} /> : <Text style={styles.btnTextDark}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.infoRow}>
          <Text style={styles.paySaved}>Referencia {ride.payment_reference}</Text>
          <TouchableOpacity
            onPress={() => {
              setError(null);
              setEditing(true);
            }}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text style={styles.payLinkText}>Corregir</Text>
          </TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.payError}>{error}</Text> : null}
      <TouchableOpacity style={styles.payLink} onPress={() => void attach()} disabled={uploading} accessibilityRole="button">
        {uploading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <>
            <Icon name="image-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.payLinkText}>{receiptSent ? 'Captura adjunta · cambiar' : 'Adjuntar captura del pago (opcional)'}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

export const ActiveRideCard: React.FC<ActiveRideCardProps> = ({
  ride,
  role,
  onUpdateStatus,
  onOpenReview,
  onCancel,
  onReferenceSaved,
}) => {
  const bcv = useBcvRate();
  const isDriver = role === 'conductor';
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    setStatusBusy(false);
  }, [ride.id, ride.status]);

  const handleStatusPress = (next: RideStatus) => {
    if (statusBusy) return;
    setStatusBusy(true);
    Promise.resolve(onUpdateStatus(next)).finally(() => setStatusBusy(false));
  };

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
  // El pasajero puede llamar desde que pide el viaje; el conductor, desde que lo acepta.
  const canCall =
    Boolean(phone) && (['aceptado', 'en_camino', 'en_curso'].includes(ride.status) || (!isDriver && ride.status === 'solicitado'));
  // Pago Móvil recién pedido: el pasajero aún no ve forma de pago ni referencia.
  const hidePayment = !isDriver && ride.payment_method === 'pago_movil' && ride.status === 'solicitado';
  const callCounterpart = () => {
    if (!phone) return;
    void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => undefined);
  };

  // Cancelar: los dos antes de empezar; con el pasajero a bordo, solo el conductor.
  const canCancel = isDriver
    ? ['aceptado', 'en_camino', 'en_curso'].includes(ride.status)
    : ['solicitado', 'aceptado', 'en_camino'].includes(ride.status);

  const canShare = ['solicitado', 'aceptado', 'en_camino', 'en_curso', 'completado'].includes(ride.status);
  const shareRide = async () => {
    const statusLabels: Record<RideStatus, string> = {
      solicitado: 'Solicitado (esperando confirmación)',
      aceptado: 'Aceptado por el conductor',
      en_camino: 'Conductor en camino al punto',
      en_curso: 'Carrera en curso',
      completado: 'Completado',
      cancelado: 'Cancelado',
      rechazado: 'Rechazado',
    };
    const moto = [ride.driver_moto_brand_model, ride.driver_moto_color].filter(Boolean).join(' · ');
    const lines = [
      `🏍️ Viaje en LITHIO #${ride.id}`,
      `📍 Ruta: ${placeName(ride.origin)} → ${placeName(ride.destination)}`,
      `👤 Conductor: ${ride.driver_name || 'Asignado'}${ride.driver_is_verified !== false ? ' (Verificado ✓)' : ''}`,
      ride.driver_plate ? `🪪 Placa: ${ride.driver_plate}${moto ? ` (${moto})` : ''}` : moto ? `🏍️ Vehículo: ${moto}` : null,
      `📌 Estado: ${statusLabels[ride.status] || ride.status}`,
    ].filter(Boolean);
    const message = lines.join('\n');
    try {
      await Share.share({ title: `Viaje LITHIO #${ride.id}`, message });
    } catch {
      Alert.alert('Resumen del viaje', message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Banner de Estado */}
      <View style={[styles.headerBanner, { backgroundColor: details.badgeColor }]}>
        <Text style={styles.bannerTitle}>{details.title}</Text>
      </View>

      <View style={styles.body}>
        {ride.status === 'completado' ? <Celebrate /> : null}
        <Text style={styles.bannerDesc}>{details.desc}</Text>

        {/* Barra de Progreso Gamificada */}
        <View style={styles.progressRow}>
          {[1, 2, 3, 4, 5].map((step) => (
            <Breathe key={step} active={step === details.step && details.step < 5} style={styles.stepCell}>
              <View
                style={[
                  styles.stepSegment,
                  step <= details.step && { backgroundColor: details.badgeColor }
                ]}
              />
            </Breathe>
          ))}
        </View>

        {/* Detalles del Viaje */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🛫 Origen:</Text>
            <Text style={styles.infoVal}>{placeName(ride.origin)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Destino:</Text>
            <Text style={styles.infoVal}>{placeName(ride.destination)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>💵 Tarifa:</Text>
            <Text style={styles.fareVal}>
              ${ride.fare_amount.toFixed(2)} USD{bcv ? ` · ${formatBs(ride.fare_amount, bcv)}` : ''}
            </Text>
          </View>
          <View style={[styles.infoRow, hidePayment && { display: 'none' }]}>
            <Text style={styles.infoLabel}>💳 Pago:</Text>
            <Text style={styles.infoVal}>
              {ride.payment_method === 'pago_movil' 
                ? (ride.payment_reference ? `Pago Móvil (${ride.payment_reference})` : 'Pago Móvil')
                : ride.payment_method === 'diamantes'
                  ? 'Iones'
                  : ride.payment_method === 'pase'
                    ? isDriver ? 'Pase de combo · cobras en iones' : 'Pase de combo'
                    : 'Efectivo'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{isDriver ? '👤 Pasajero:' : '🏍️ Conductor:'}</Text>
            <View style={styles.driverMetaRight}>
              <Text style={styles.driverVal}>{isDriver ? ride.passenger_name : ride.driver_name}</Text>
              {!isDriver && ride.driver_is_verified !== false ? (
                <View style={styles.verifiedBadge} accessibilityLabel="Conductor verificado">
                  <Icon name="checkmark-circle-2" size={12} color={theme.colors.primary} />
                  <Text style={styles.verifiedBadgeText}>Verificado</Text>
                </View>
              ) : null}
            </View>
          </View>
          {(ride.driver_plate || ride.driver_moto_brand_model) ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>🪪 Vehículo:</Text>
              <View style={styles.driverMetaRight}>
                {ride.driver_moto_brand_model ? (
                  <Text style={styles.infoVal}>
                    {ride.driver_moto_brand_model}
                    {ride.driver_moto_color ? ` · ${ride.driver_moto_color}` : ''}
                  </Text>
                ) : null}
                {ride.driver_plate ? (
                  <View style={styles.plateChip} accessibilityLabel={`Placa ${ride.driver_plate}`}>
                    <Text style={styles.plateChipText}>{ride.driver_plate}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {!isDriver && ride.payment_method === 'pago_movil' && ride.driver_mobile_payment_number && !hidePayment && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>📲 Datos de Pago Móvil del conductor</Text>
            {ride.driver_mobile_payment_bank && (
              <Text style={styles.infoVal} selectable>Banco: {ride.driver_mobile_payment_bank}</Text>
            )}
            <Text style={styles.infoVal} selectable>Teléfono: {ride.driver_mobile_payment_number}</Text>
            {ride.driver_mobile_payment_id && (
              <Text style={styles.infoVal} selectable>Identificación: {ride.driver_mobile_payment_id}</Text>
            )}
            <Text style={styles.infoHint}>Solo visible para los participantes de este viaje.</Text>
          </View>
        )}

        {/* La referencia se anota después de transferir, ya con los datos del conductor a la vista. */}
        {!isDriver && ride.payment_method === 'pago_movil' && PAYABLE.includes(ride.status) ? (
          <PagoMovilConfirm ride={ride} onReferenceSaved={onReferenceSaved} />
        ) : null}
        {isDriver && ride.payment_method === 'pago_movil' && PAYABLE.includes(ride.status) ? (
          <Text style={[styles.infoHint, styles.driverPayHint]}>
            {ride.payment_reference
              ? `✅ El pasajero anotó la referencia ${ride.payment_reference}. Verifícala en tu banco.`
              : '⏳ El pasajero aún no anota la referencia del Pago Móvil. Te avisamos cuando lo haga.'}
          </Text>
        ) : null}

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

        {canShare ? (
          <View style={styles.contactBox}>
            <PressableScale
              variant="glass"
              accent={isDriver ? theme.colors.secondary : theme.colors.primary}
              style={styles.shareBtn}
              onPress={() => void shareRide()}
              accessibilityRole="button"
              accessibilityLabel="Compartir viaje con un contacto"
            >
              <Icon name="share-outline" size={18} color={isDriver ? theme.colors.secondary : theme.colors.primary} />
              <Text style={styles.shareBtnText}>Compartir viaje con un contacto</Text>
            </PressableScale>
          </View>
        ) : null}

        {/* Acciones para el Conductor */}
        {isDriver ? (
          <View style={styles.actionsBox}>
            {ride.status === 'solicitado' && (
              <View style={styles.driverButtonsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rowBtn, styles.btnSuccess]}
                  onPress={() => handleStatusPress('aceptado')}
                  disabled={statusBusy}
                >
                  <Text style={styles.btnTextWhite}>Aceptar Carrera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rowBtn, styles.btnDanger]}
                  onPress={() => handleStatusPress('rechazado')}
                  disabled={statusBusy}
                >
                  <Text style={styles.btnTextWhite}>Rechazar</Text>
                </TouchableOpacity>
              </View>
            )}

            {ride.status === 'aceptado' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnPrimary]}
                onPress={() => handleStatusPress('en_camino')}
                disabled={statusBusy}
              >
                <Text style={styles.btnTextDark}>Voy en camino al punto</Text>
              </TouchableOpacity>
            )}

            {ride.status === 'en_camino' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnSecondary]}
                onPress={() => handleStatusPress('en_curso')}
                disabled={statusBusy}
              >
                <Text style={styles.btnTextWhite}>Pasajero a bordo: Iniciar Carrera</Text>
              </TouchableOpacity>
            )}

            {ride.status === 'en_curso' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnSuccess]}
                onPress={() => handleStatusPress('completado')}
                disabled={statusBusy}
              >
                <Text style={styles.btnTextWhite}>Finalizar Carrera y Cobrar</Text>
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
              <TouchableOpacity style={[styles.actionBtn, styles.btnOutline]} onPress={onCancel} disabled={statusBusy} accessibilityRole="button">
                <Text style={styles.btnTextRed}>Cancelar viaje</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Acciones para el Pasajero */
          <View style={styles.actionsBox}>
            {ride.status === 'completado' ? (
              ride.has_review ? (
                <View style={styles.completedNotice}>
                  <Text style={styles.completedNoticeText}>
                    ✨ ¡Gracias por calificar tu viaje!
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnGold]}
                  onPress={onOpenReview}
                >
                  <Text style={styles.btnTextDark}>Calificar el viaje</Text>
                </TouchableOpacity>
              )
            ) : canCancel ? (
              <TouchableOpacity style={[styles.actionBtn, styles.btnOutline]} onPress={onCancel} disabled={statusBusy} accessibilityRole="button">
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
    color: theme.colors.onAccent,
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
  stepCell: {
    flex: 1,
  },
  stepSegment: {
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
    fontSize: 12,
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
  driverMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
  },
  verifiedBadgeText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  plateChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bgDark,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  plateChipText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 11,
    color: theme.colors.textPrimary,
    letterSpacing: 0.4,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  shareBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textPrimary,
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
  // Sin flex: 1. En una columna de alto automático, Android (Yoga) dejaba el botón
  // con alto 0 + relleno: el texto no se veía y quedaba un recuadro vacío.
  actionBtn: {
    borderRadius: theme.radius.full,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBtn: {
    flex: 1,
  },
  driverPayHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 0,
    marginBottom: 14,
  },
  payBox: {
    backgroundColor: theme.colors.cardElevated,
    padding: 12,
    borderRadius: theme.radius.sm,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
  },
  payTitle: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    fontSize: 13,
  },
  payRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payInput: {
    flex: 1,
    minHeight: 46,
    fontFamily: theme.fonts.mono,
    fontSize: 16, // 16 o más: iOS no hace zoom al escribir
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.bgDark,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingHorizontal: 12,
  },
  paySave: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  paySaved: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.success,
    fontSize: 13,
  },
  payError: {
    fontFamily: theme.fonts.medium,
    color: theme.colors.error,
    fontSize: 12,
  },
  payLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.cardBorder,
  },
  payLinkText: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.primary,
    fontSize: 13,
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
    color: theme.colors.onAccent,
    fontSize: 16,
  },
  btnTextDark: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
    fontSize: 16,
  },
  btnTextRed: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.error,
    fontSize: 16,
  },
  completedNotice: {
    backgroundColor: `${theme.colors.success}26`,
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
