/**
 * UpdateRequiredScreen.tsx — Esta versión del APK ya no se puede usar
 */

import React from 'react';
import { View, Text, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, themed } from '../constants/theme';
import { PrimaryButton } from '../components/brand/PrimaryButton';

export const UpdateRequiredScreen: React.FC<{ downloadUrl: string | null }> = ({ downloadUrl }) => (
  <View style={styles.root}>
    <MaterialCommunityIcons name="cellphone-arrow-down" size={56} color={theme.colors.primary} />
    <Text style={styles.title}>Actualiza LITHIO</Text>
    <Text style={styles.body}>
      Hay una versión nueva de la app con cambios importantes. Descárgala e instálala encima de esta: tu cuenta y tus datos se mantienen.
    </Text>
    {downloadUrl ? (
      <PrimaryButton label="Descargar la nueva versión" onPress={() => void Linking.openURL(downloadUrl)} style={styles.button} />
    ) : (
      <Text style={styles.body}>Pide el enlace de descarga al administrador de LITHIO.</Text>
    )}
  </View>
);

const styles = themed(() => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    backgroundColor: theme.colors.bgDark,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
  body: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  button: {
    alignSelf: 'stretch',
  },
}));
