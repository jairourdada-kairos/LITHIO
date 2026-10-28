/**
 * WalletActionSheet.tsx — Recargar, enviar, donar, retirar y taller
 *
 * Una sola hoja para las acciones de la billetera. Recargas, retiros y
 * canjes del taller quedan "En revisión" hasta que el administrador los
 * aprueba; envíos y donaciones se aplican al instante.
 */

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Icon } from './ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../constants/theme';
import { FormField } from './FormField';
import { PrimaryButton } from './brand/PrimaryButton';
import { apiService, LinkPerson, WorkshopItem } from '../services/api';
import type { WalletAction } from '../screens/shared/WalletScreen';

interface Props {
  action: WalletAction | null;
  balance: number;
  onClose: () => void;
  /** Se llama tras una operación exitosa para recargar la billetera. */
  onDone: () => void;
}

const COPY: Record<WalletAction, { title: string; message: string; confirm: string }> = {
  recargar: {
    title: 'Recargar diamantes',
    message: 'Haz el Pago Móvil a LITHIO y escribe la referencia. Los diamantes se acreditan cuando el administrador lo verifique.',
    confirm: 'Enviar recarga',
  },
  enviar: {
    title: 'Enviar a un enlace',
    message: 'Solo puedes enviar diamantes a tus enlaces. Máximo ◆50 por envío y ◆100 al día.',
    confirm: 'Enviar diamantes',
  },
  donar: {
    title: 'Donar al Fondo Solidario',
    message: 'Tu donación paga viajes a estudiantes que lo necesitan. Cuenta dentro del límite de ◆100 al día.',
    confirm: 'Donar',
  },
  retirar: {
    title: 'Retirar ganancias',
    message: 'Indica dónde recibir el pago. El monto queda retenido hasta que el administrador lo transfiera.',
    confirm: 'Solicitar retiro',
  },
  taller: {
    title: 'Mecánico de confianza',
    message: 'Paga servicios del taller aliado con tus diamantes. El administrador te confirma la cita.',
    confirm: '',
  },
};

export const WalletActionSheet: React.FC<Props> = ({ action, balance, onClose, onDone }) => {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [links, setLinks] = useState<LinkPerson[] | null>(null);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [workshop, setWorkshop] = useState<WorkshopItem[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAmount('');
    setText('');
    setNote('');
    setRecipient(null);
    setError(undefined);
    if (action === 'enviar') apiService.getLinks().then((info) => setLinks(info.links)).catch(() => setLinks([]));
    if (action === 'taller') apiService.getWorkshop().then(setWorkshop).catch(() => setWorkshop([]));
  }, [action]);

  if (!action) return null;
  const copy = COPY[action];

  const finish = (title: string, message: string) => {
    onDone();
    onClose();
    Alert.alert(title, message);
  };

  const submit = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!(value > 0)) {
      setError('Escribe un monto mayor que cero.');
      return;
    }
    if (action !== 'recargar' && value > balance) {
      setError(`Tu saldo es ◆ ${balance.toFixed(2)}.`);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (action === 'recargar') {
        if (text.trim().length < 4) throw new Error('Escribe la referencia del Pago Móvil.');
        await apiService.requestTopup(value, text.trim());
        finish('Recarga enviada', 'Verás los diamantes cuando el administrador confirme el pago.');
      } else if (action === 'enviar') {
        if (!recipient) throw new Error('Elige a qué enlace enviarle.');
        await apiService.sendDiamonds(recipient, value, note.trim());
        finish('Diamantes enviados', `Enviaste ◆ ${value.toFixed(2)}.`);
      } else if (action === 'donar') {
        await apiService.donate(value);
        finish('¡Gracias por donar!', `Aportaste ◆ ${value.toFixed(2)} al Fondo Solidario LITHIO.`);
      } else if (action === 'retirar') {
        if (text.trim().length < 6) throw new Error('Indica tu Pago Móvil o cuenta para recibir.');
        await apiService.requestWithdrawal(value, text.trim());
        finish('Retiro solicitado', 'El administrador te transferirá y lo verás como aprobado.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.');
    } finally {
      setBusy(false);
    }
  };

  const redeem = (item: WorkshopItem) =>
    Alert.alert(item.title, `Pagarás ◆ ${item.cost.toFixed(2)} del saldo. ¿Confirmas?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Canjear',
        onPress: async () => {
          try {
            await apiService.redeemWorkshop(item.id);
            finish('Canje enviado', 'El administrador te confirmará la cita en el taller.');
          } catch (e) {
            Alert.alert('No se pudo canjear', e instanceof Error ? e.message : 'Intenta de nuevo.');
          }
        },
      },
    ]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.message}>{copy.message}</Text>
            {action !== 'recargar' ? <Text style={styles.balance}>Disponible: ◆ {balance.toFixed(2)}</Text> : null}

            {action === 'taller' ? (
              workshop === null ? (
                <Text style={styles.message}>Cargando servicios…</Text>
              ) : (
                workshop.map((item) => {
                  const affordable = balance >= item.cost;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => redeem(item)}
                      disabled={!affordable}
                      style={({ pressed }) => [styles.option, !affordable && styles.dim, pressed && styles.pressed]}
                      accessibilityRole="button"
                    >
                      <Icon name="settings-2-outline" size={22} color={theme.colors.secondary} />
                      <View style={styles.flex}>
                        <Text style={styles.optionTitle}>{item.title}</Text>
                        {item.description ? <Text style={styles.message}>{item.description}</Text> : null}
                      </View>
                      <Text style={styles.cost}>◆ {item.cost.toFixed(2)}</Text>
                    </Pressable>
                  );
                })
              )
            ) : (
              <>
                {action === 'enviar' ? (
                  links === null ? (
                    <Text style={styles.message}>Cargando enlaces…</Text>
                  ) : links.length === 0 ? (
                    <Text style={styles.message}>Aún no tienes enlaces. Agrégalos desde Perfil → Enlaces con su código Li-XXXX.</Text>
                  ) : (
                    <View style={styles.chips}>
                      {links.map((person) => {
                        const selected = recipient === person.friend_code;
                        return (
                          <Pressable
                            key={person.user_id}
                            onPress={() => setRecipient(person.friend_code)}
                            style={[styles.chip, selected && styles.chipActive]}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                          >
                            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{person.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )
                ) : null}

                <FormField
                  label="Monto en diamantes"
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  hint="1 ◆ = 1 USD"
                />
                {action === 'recargar' ? (
                  <FormField label="Referencia del Pago Móvil" placeholder="Últimos 6 dígitos" value={text} onChangeText={setText} maxLength={30} />
                ) : null}
                {action === 'retirar' ? (
                  <FormField
                    label="Dónde recibir"
                    placeholder="0414-1234567 · V-12345678 · Banco"
                    value={text}
                    onChangeText={setText}
                    maxLength={120}
                  />
                ) : null}
                {action === 'enviar' && links?.length ? (
                  <FormField label="Nota (opcional)" placeholder="Para el pasaje de mañana" value={note} onChangeText={setNote} maxLength={80} />
                ) : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <PrimaryButton
                  label={copy.confirm}
                  onPress={submit}
                  loading={busy}
                  disabled={action === 'enviar' && !links?.length}
                  accent={theme.colors.diamond}
                />
              </>
            )}
            {action === 'taller' && error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = themed(() => ({
  flex: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: theme.colors.bgDark,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.cardBorder,
    marginBottom: 12,
  },
  content: {
    gap: 14,
    paddingBottom: 8,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  message: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  balance: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 14,
    color: theme.colors.diamond,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  chipActive: {
    backgroundColor: theme.colors.diamond,
    borderColor: theme.colors.diamond,
  },
  chipText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  chipTextActive: {
    color: theme.colors.bgDark,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
  },
  optionTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  cost: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 14,
    color: theme.colors.diamond,
  },
  dim: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
  error: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.error,
  },
}));
