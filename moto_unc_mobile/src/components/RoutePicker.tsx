import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { theme } from '../constants/theme';
import { PresetRoute } from '../types';

interface RoutePickerProps {
  presetRoutes: PresetRoute[];
  selectedOrigin: string;
  selectedDestination: string;
  onSelectRoute: (origin: string, destination: string, fare: number) => void;
  isScheduled: boolean;
  scheduledTime: string;
  onToggleScheduled: (scheduled: boolean) => void;
  onChangeScheduledTime: (time: string) => void;
}

export const RoutePicker: React.FC<RoutePickerProps> = ({
  presetRoutes,
  selectedOrigin,
  selectedDestination,
  onSelectRoute,
  isScheduled,
  scheduledTime,
  onToggleScheduled,
  onChangeScheduledTime,
}) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customOrigin, setCustomOrigin] = useState('');
  const [customDestination, setCustomDestination] = useState('');
  const isReversed = presetRoutes.some(
    (route) => selectedOrigin === route.destination && selectedDestination === route.origin
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>📍 1. Elige tu Ruta</Text>
        <TouchableOpacity onPress={() => setIsCustom(!isCustom)}>
          <Text style={styles.toggleCustomText}>
            {isCustom ? '← Ver Rutas Frecuentes' : '✏️ Escribir Ruta Manual'}
          </Text>
        </TouchableOpacity>
      </View>

      {!isCustom ? (
        <View>
          <TouchableOpacity
            style={[styles.swapButton, isReversed && styles.swapButtonActive]}
            onPress={() => {
              const nextOrigin = selectedDestination || '';
              const nextDestination = selectedOrigin || '';
              if (nextOrigin && nextDestination) {
                const route = presetRoutes.find(
                  (item) => item.origin === selectedOrigin && item.destination === selectedDestination
                    || item.origin === nextOrigin && item.destination === nextDestination
                );
                onSelectRoute(nextOrigin, nextDestination, route?.fare_usd || 3.0);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.swapText, isReversed && styles.swapTextActive]}>⇅ Invertir origen / destino</Text>
          </TouchableOpacity>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsList}
          >
            {presetRoutes.map((route) => {
              const isSelected = selectedOrigin === route.origin && selectedDestination === route.destination;
              return (
                <TouchableOpacity
                  key={route.id}
                  style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                  onPress={() => onSelectRoute(route.origin, route.destination, route.fare_usd)}
                  activeOpacity={0.8}
                >
                  <View style={styles.tagRow}>
                    <Text style={styles.tagText}>{route.tag}</Text>
                    <Text style={styles.fareText}>${route.fare_usd.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.routeOrigin} numberOfLines={1}>🛫 {route.origin}</Text>
                  <Text style={styles.routeDest} numberOfLines={1}>🏁 {route.destination}</Text>
                  <Text style={styles.estimatedText}>⏱️ Aprox. {route.estimated_minutes} min</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.customContainer}>
          <TouchableOpacity
            style={styles.swapButton}
            onPress={() => {
              const nextOrigin = customDestination || '';
              const nextDestination = customOrigin || '';
              if (nextOrigin && nextDestination) {
                setCustomOrigin(nextOrigin);
                setCustomDestination(nextDestination);
                onSelectRoute(nextOrigin, nextDestination, 3.0);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.swapText}>⇅ Cambiar salida con destino</Text>
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Punto de Salida:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej. Salida de Laboratorios UNC"
              placeholderTextColor={theme.colors.textMuted}
              value={customOrigin}
              onChangeText={(txt) => {
                setCustomOrigin(txt);
                onSelectRoute(txt, selectedDestination, 3.0);
              }}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Destino:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej. Entrada Principal IVIC o Redoma"
              placeholderTextColor={theme.colors.textMuted}
              value={customDestination}
              onChangeText={(txt) => {
                setCustomDestination(txt);
                onSelectRoute(selectedOrigin, txt, 3.0);
              }}
            />
          </View>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  toggleCustomText: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.primary,
    fontSize: 12,
  },
  presetsList: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  swapButton: {
    alignSelf: 'flex-end',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  swapButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  swapText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
    fontSize: 11,
  },
  swapTextActive: {
    color: '#0B0F19',
  },
  presetCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.radius.md,
    padding: 14,
    width: 260,
    borderWidth: 1.5,
    borderColor: theme.colors.cardBorder,
  },
  presetCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.cardElevated,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.secondary,
    fontSize: 11,
  },
  fareText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
    fontSize: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  routeOrigin: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
  },
  routeDest: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textPrimary,
    fontSize: 13,
    marginBottom: 6,
  },
  estimatedText: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  customContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  textInput: {
    fontFamily: theme.fonts.regular,
    backgroundColor: theme.colors.cardElevated,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.sm,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  scheduleRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  scheduleBtn: {
    flex: 1,
    backgroundColor: theme.colors.cardElevated,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  scheduleBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: theme.colors.primary,
  },
  scheduleBtnText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  scheduleBtnTextActive: {
    color: theme.colors.primary,
  },
  timeInputContainer: {
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 4,
  },
  timeLabel: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.gold,
    fontSize: 12,
  }
});
