/**
 * BottomTabBar.tsx — Barra inferior flotante con botón central
 *
 * Cuatro pestañas en una cápsula de vidrio y un botón central elevado para
 * la acción principal del rol: pedir viaje (pasajero) o conectarse (conductor).
 * Las pestañas cambian sin animación de deslizamiento: son pares, no niveles.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { PressableScale } from '../brand/PressableScale';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon: IconName;
  badge?: number;
}

interface Props<K extends string> {
  tabs: [TabItem<K>, TabItem<K>, TabItem<K>, TabItem<K>];
  active: K | null;
  onChange: (key: K) => void;
  center: {
    icon: IconName;
    label: string;
    color: string;
    onPress: () => void;
    /** Anillo pulsante: p. ej. conductor conectado o viaje en curso. */
    live?: boolean;
  };
}

export const TAB_BAR_HEIGHT = 68;

export function BottomTabBar<K extends string>({ tabs, active, onChange, center }: Props<K>) {
  const insets = useSafeAreaInsets();
  const renderTab = (tab: TabItem<K>) => {
    const selected = tab.key === active;
    return (
      <Pressable
        key={tab.key}
        onPress={() => onChange(tab.key)}
        style={styles.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={tab.label}
        hitSlop={4}
      >
        <View style={[styles.iconWrap, selected && styles.iconWrapActive]}>
          <MaterialCommunityIcons
            name={tab.icon}
            size={22}
            color={selected ? theme.colors.primary : theme.colors.textSecondary}
          />
          {tab.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tab.badge > 9 ? '9+' : tab.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="tablist">
        {renderTab(tabs[0])}
        {renderTab(tabs[1])}
        <View style={styles.centerSlot} />
        {renderTab(tabs[2])}
        {renderTab(tabs[3])}
      </View>

      {/* Capa centrada que deja pasar los toques fuera del botón. */}
      <View
        style={[styles.centerButtonContainer, { bottom: Math.max(insets.bottom, 12) + 22 }]}
        pointerEvents="box-none"
      >
      <PressableScale
        onPress={center.onPress}
        accessibilityLabel={center.label}
        style={[
          styles.centerButton,
          { backgroundColor: center.color, boxShadow: `0 8px 24px ${center.color}66` },
          center.live && { borderColor: theme.colors.textPrimary },
        ]}
      >
        <MaterialCommunityIcons name={center.icon} size={30} color={theme.colors.bgDark} />
      </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 34,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(24, 37, 39, 0.96)',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    gap: 2,
  },
  iconWrap: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: theme.colors.primarySoft,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: 10.5,
    color: theme.colors.textMuted,
  },
  labelActive: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: theme.fonts.bold,
    fontSize: 9,
    color: theme.colors.bgDark,
  },
  centerSlot: {
    width: 72,
  },
  centerButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  centerButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.bgDark,
  },
});
