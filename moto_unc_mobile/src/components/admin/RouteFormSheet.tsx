/**
 * RouteFormSheet.tsx — Crear o editar una ruta (administración)
 *
 * Origen, destino, tarifa en USD (muestra el equivalente en Bs con la tasa
 * BCV del día), minutos estimados y etiqueta. El servidor valida rangos.
 */

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { FormField } from '../FormField';
import { PrimaryButton } from '../brand/PrimaryButton';
import { formatBs, useBcvRate } from '../../services/rates';
import type { PresetRoute } from '../../types';

export interface RouteDraft {
  origin: string;
  destination: string;
  fare_usd: number;
  estimated_minutes: number;
  tag: string | null;
}

interface Props {
  visible: boolean;
  /** Ruta a editar; null para crear una nueva. */
  route: PresetRoute | null;
  onClose: () => void;
  onSubmit: (draft: RouteDraft) => Promise<void>;
}

type Errors = Partial<Record<'origin' | 'destination' | 'fare' | 'minutes' | 'form', string>>;

export const RouteFormSheet: React.FC<Props> = ({ visible, route, onClose, onSubmit }) => {
  const insets = useSafeAreaInsets();
  const bcv = useBcvRate();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [fare, setFare] = useState('');
  const [minutes, setMinutes] = useState('');
  const [tag, setTag] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setOrigin(route?.origin ?? '');
    setDestination(route?.destination ?? '');
    setFare(route ? String(route.fare_usd) : '');
    setMinutes(route ? String(route.estimated_minutes) : '');
    setTag(route?.tag ?? '');
    setErrors({});
  }, [visible, route]);

  if (!visible) return null;
  const fareValue = Number(fare.replace(',', '.'));

  const submit = async () => {
    const minutesValue = Number(minutes);
    const next: Errors = {
      origin: origin.trim().length < 2 ? 'Escribe el origen' : undefined,
      destination: destination.trim().length < 2 ? 'Escribe el destino' : undefined,
      fare: !(fareValue > 0 && fareValue <= 100) ? 'Tarifa entre 0.01 y 100 USD' : undefined,
      minutes: !(Number.isInteger(minutesValue) && minutesValue >= 1 && minutesValue <= 600) ? 'Minutos entre 1 y 600' : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    try {
      await onSubmit({
        origin: origin.trim(),
        destination: destination.trim(),
        fare_usd: Math.round(fareValue * 100) / 100,
        estimated_minutes: minutesValue,
        tag: tag.trim() || null,
      });
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'No se pudo guardar la ruta.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>{route ? 'Editar ruta' : 'Nueva ruta'}</Text>
            <FormField label="Origen" placeholder="Campus UNC" value={origin} onChangeText={setOrigin} error={errors.origin} maxLength={120} />
            <FormField label="Destino" placeholder="IVIC" value={destination} onChangeText={setDestination} error={errors.destination} maxLength={120} />
            <View style={styles.row}>
              <FormField
                label="Tarifa (USD)"
                placeholder="2.50"
                keyboardType="decimal-pad"
                value={fare}
                onChangeText={setFare}
                error={errors.fare}
                hint={bcv && fareValue > 0 ? `≈ ${formatBs(fareValue, bcv)}` : undefined}
                containerStyle={styles.flex}
              />
              <FormField
                label="Minutos"
                placeholder="15"
                keyboardType="number-pad"
                value={minutes}
                onChangeText={setMinutes}
                error={errors.minutes}
                containerStyle={styles.flex}
              />
            </View>
            <FormField label="Etiqueta (opcional)" placeholder="Campus, Biblioteca…" value={tag} onChangeText={setTag} maxLength={60} />
            {errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}
            <PrimaryButton label={route ? 'Guardar cambios' : 'Crear ruta'} onPress={submit} loading={saving} accent={theme.colors.secondary} />
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
    maxHeight: '90%',
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  error: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.error,
  },
}));
