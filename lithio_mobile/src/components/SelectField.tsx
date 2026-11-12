/**
 * SelectField.tsx — Campo que se elige de una lista (carrera, área de trabajo)
 *
 * Se ve como un FormField; al tocarlo abre una hoja con las opciones.
 */
import React, { useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../constants/theme';
import { fieldStyles } from './FormField';
import { Icon } from './ui/Icon';

interface Props {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder: string;
  error?: string;
  required?: boolean;
  accent?: string;
}

export const SelectField: React.FC<Props> = ({
  label,
  value,
  options,
  onSelect,
  placeholder,
  error,
  required,
  accent = theme.colors.primary,
}) => {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.group}>
      <Text style={fieldStyles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.input, error ? styles.inputError : null]}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${value}` : `${label}: ${placeholder}`}
      >
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Icon name="chevron-down-outline" size={20} color={theme.colors.textSecondary} />
      </Pressable>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

      {open ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
          <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Cerrar" />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>{label}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={label}>
              {options.map((option) => {
                const selected = option === value;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      onSelect(option);
                      setOpen(false);
                    }}
                    style={[styles.option, selected && { borderColor: accent, backgroundColor: theme.colors.glassBgStrong }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.optionText, selected && { color: accent, fontFamily: theme.fonts.bold }]}>{option}</Text>
                    {selected ? <Icon name="checkmark-outline" size={20} color={accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};

const styles = themed(() => ({
  group: {
    marginBottom: 16,
  },
  required: {
    color: theme.colors.secondary,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.glassBgStrong,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    boxShadow: theme.glass.shadow,
    backgroundImage: theme.fx.sheen,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  value: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  placeholder: {
    color: theme.colors.textMuted,
  },
  error: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 6,
  },
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
  },
  sheet: {
    maxHeight: '70%',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.surfaceSolid,
    boxShadow: theme.glass.floating,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.cardBorder,
    marginBottom: 12,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  optionText: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
}));
