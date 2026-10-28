/**
 * BottomTabBar.tsx — Barra inferior flotante (Inicio · Viajes · Billetera · Perfil)
 *
 * Cápsula separada del borde con la pestaña activa resaltada. Las pestañas
 * cambian sin animación de deslizamiento: son pares, no niveles.
 *
 * La cápsula es cristal teñido con desenfoque del contenido que pasa por
 * debajo. Cada pestaña reacciona al puntero, al toque y al foco del teclado.
 */

import { View, Text } from 'react-native';
import { filledIcon, Icon, IconName } from '../ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { GlassSurface } from '../ui/GlassSurface';
import { PressableScale } from '../brand/PressableScale';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon: IconName;
  badge?: number;
}

interface Props<K extends string> {
  tabs: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  /** Color de la pestaña activa: turquesa (pasajero) o coral (conductor). */
  accent?: string;
}

export const TAB_BAR_HEIGHT = 64;

export function BottomTabBar<K extends string>({ tabs, active, onChange, accent = theme.colors.primary }: Props<K>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <GlassSurface blur radius={32} tint={theme.colors.glassBg} style={styles.bar} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <PressableScale
              key={tab.key}
              variant="glass"
              accent={accent}
              onPress={() => onChange(tab.key)}
              containerStyle={styles.tab}
              style={[styles.pill, selected && { backgroundColor: `${accent}24`, borderColor: `${accent}40` }]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
            >
                <Icon name={selected ? filledIcon(tab.icon) : tab.icon} size={22} color={selected ? accent : theme.colors.textMuted} />
                {selected ? <Text style={[styles.label, { color: accent }]}>{tab.label}</Text> : null}
                {tab.badge ? (
                  <View style={[styles.badge, { backgroundColor: theme.colors.secondary }]}>
                    <Text style={styles.badgeText}>{tab.badge > 9 ? '9+' : tab.badge}</Text>
                  </View>
                ) : null}
            </PressableScale>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = themed(() => ({
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
    borderRadius: 32,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: theme.fonts.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
}));
