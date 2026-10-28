/**
 * VersionTag.tsx — Identificador visible de la versión en uso
 *
 * "line": una línea discreta para el pie de una pantalla.
 * "card": tabla con versión, compilación, actualización y canal (Acerca de).
 * El texto se puede seleccionar para copiarlo al reportar un problema.
 */

import React from 'react';
import { Text, View } from 'react-native';
import { theme, themed } from '../../constants/theme';
import { getAppInfo, versionLine } from '../../services/appInfo';

const ENVIRONMENT_LABEL = { apk: 'APK instalado', 'expo-go': 'Expo Go (desarrollo)', web: 'Navegador web' };

export const VersionTag: React.FC<{ variant?: 'line' | 'card' }> = ({ variant = 'line' }) => {
  const info = getAppInfo();
  if (variant === 'line') {
    return (
      <Text style={styles.line} selectable accessibilityLabel={`Versión: ${versionLine(info)}`}>
        {versionLine(info)}
      </Text>
    );
  }

  const rows: [string, string][] = [
    ['Versión', info.version],
    ['Dónde corre', ENVIRONMENT_LABEL[info.environment]],
  ];
  if (info.build) rows.push(['Compilación', `build ${info.build}`]);
  if (info.environment === 'apk') {
    rows.push(['Actualización', info.updateId ? `${info.updateId}${info.updateDate ? ` · ${info.updateDate}` : ''}` : 'Código original del APK']);
    if (info.channel) rows.push(['Canal', info.channel]);
  }

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.cardTitle}>Versión de la app</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value} selectable>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = themed(() => ({
  line: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  card: {
    gap: 8,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.glass.shadow,
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  value: {
    flexShrink: 1,
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
}));
