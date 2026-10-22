/**
 * AvatarSheet.tsx — Hoja "Foto de perfil": tomar, elegir (con recorte) o eliminar
 */

import React, { useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../constants/theme';
import { AvatarSource, deleteAvatar, pickAvatar, uploadAvatar } from '../services/avatar';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  visible: boolean;
  hasPhoto: boolean;
  accent: string;
  onClose: () => void;
  /** Nueva URL de la foto, o null si se eliminó. */
  onChanged: (avatarUrl: string | null) => void;
}

export const AvatarSheet: React.FC<Props> = ({ visible, hasPhoto, accent, onClose, onChanged }) => {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const choose = async (source: AvatarSource) => {
    const uri = await pickAvatar(source);
    if (!uri) return;
    setBusy(true);
    try {
      onChanged(await uploadAvatar(uri));
      onClose();
    } catch (error) {
      Alert.alert('No se pudo guardar la foto', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Eliminar foto', 'Tu perfil mostrará tus iniciales.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAvatar();
            onChanged(null);
            onClose();
          } catch (error) {
            Alert.alert('No se pudo eliminar la foto', error instanceof Error ? error.message : 'Intenta de nuevo.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const options: { icon: IconName; label: string; hint?: string; onPress: () => void; danger?: boolean }[] = [
    { icon: 'camera-outline', label: 'Tomar foto', hint: 'Luego ajustas el encuadre', onPress: () => void choose('camera') },
    { icon: 'image-outline', label: 'Elegir de la galería', hint: 'Luego ajustas el encuadre', onPress: () => void choose('library') },
    ...(hasPhoto ? [{ icon: 'trash-can-outline' as IconName, label: 'Eliminar foto', onPress: remove, danger: true }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={busy ? undefined : onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Foto de perfil</Text>
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={accent} />
            <Text style={styles.hint}>Guardando tu foto…</Text>
          </View>
        ) : (
          options.map((option, index) => (
            <Pressable
              key={option.label}
              onPress={option.onPress}
              style={({ pressed }) => [styles.option, index > 0 && styles.divider, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={[styles.icon, { backgroundColor: option.danger ? `${theme.colors.error}1A` : `${accent}1A` }]}>
                <MaterialCommunityIcons name={option.icon} size={22} color={option.danger ? theme.colors.error : accent} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.label, option.danger && { color: theme.colors.error }]}>{option.label}</Text>
                {option.hint ? <Text style={styles.hint}>{option.hint}</Text> : null}
              </View>
            </Pressable>
          ))
        )}
      </View>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.cardBorder,
    marginBottom: 14,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  hint: {
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  busy: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
}));
