/**
 * PromptSheet.tsx — Hoja con un campo de texto (fecha de inspección, nota…)
 */

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { FormField } from '../FormField';
import { PrimaryButton } from '../brand/PrimaryButton';

export interface PromptConfig {
  title: string;
  message: string;
  label: string;
  placeholder: string;
  confirm: string;
  accent: string;
  required?: boolean;
  onSubmit: (value: string) => Promise<void> | void;
}

export const PromptSheet: React.FC<{ config: PromptConfig | null; onClose: () => void }> = ({ config, onClose }) => {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue('');
    setError(undefined);
  }, [config]);

  if (!config) return null;

  const submit = async () => {
    if (config.required && !value.trim()) {
      setError('Este campo es obligatorio');
      return;
    }
    setBusy(true);
    try {
      await config.onSubmit(value.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.message}>{config.message}</Text>
          <FormField
            label={config.label}
            value={value}
            onChangeText={(text) => {
              setValue(text);
              setError(undefined);
            }}
            placeholder={config.placeholder}
            error={error}
            autoFocus
            multiline
          />
          <PrimaryButton label={config.confirm} onPress={submit} loading={busy} accent={config.accent} />
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
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.surface,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.cardBorder,
    marginBottom: 8,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  message: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
}));
