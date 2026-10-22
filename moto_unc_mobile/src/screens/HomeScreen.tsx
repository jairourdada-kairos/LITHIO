import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  userName: string;
  points: number;
  onRequestRide: () => void;
  onScheduleRide: () => void;
  onRewards: () => void;
  onProfile: () => void;
}

export const HomeScreen: React.FC<Props> = ({
  userName,
  points,
  onRequestRide,
  onScheduleRide,
  onRewards,
  onProfile,
}) => (
  <View style={styles.container}>
    <View style={styles.greeting}>
      <Text style={styles.kicker}>LITHIO</Text>
      <Text style={styles.title}>Hola, {userName.split(' ')[0]}</Text>
      <Text style={styles.subtitle}>¿Qué necesitas hacer hoy?</Text>
    </View>

    <View style={styles.balance}>
      <Text style={styles.balanceIcon}>Fe</Text>
      <View>
      <Text style={styles.balanceLabel}>Hierro de recompensa</Text>
      <Text style={styles.balanceValue}>{points} Fe</Text>
      </View>
    </View>

    <View style={styles.diamondsNotice}>
      <Text style={styles.diamondsTitle}>◇ Diamantes · Próximamente</Text>
      <Text style={styles.diamondsCopy}>Recargas, pagos de viajes y transferencias se habilitarán con proveedores verificados.</Text>
    </View>

    <View style={styles.options}>
      <HomeOption icon="🏍️" title="Pedir un viaje ahora" subtitle="Elige ruta y conductor" onPress={onRequestRide} primary />
      <HomeOption icon="📅" title="Programar un viaje" subtitle="Selecciona día y hora" onPress={onScheduleRide} />
      <HomeOption icon="🪙" title="Recompensas Fe" subtitle="Canjea el hierro ganado en viajes" onPress={onRewards} />
      <HomeOption icon="👤" title="Perfil" subtitle="Datos de tu cuenta y vehículo" onPress={onProfile} />
    </View>
  </View>
);

interface OptionProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
}

const HomeOption: React.FC<OptionProps> = ({ icon, title, subtitle, onPress, primary }) => (
  <TouchableOpacity style={[styles.option, primary && styles.primaryOption]} onPress={onPress} activeOpacity={0.85}>
    <Text style={styles.optionIcon}>{icon}</Text>
    <View style={styles.optionCopy}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionSubtitle}>{subtitle}</Text>
    </View>
    <Text style={styles.arrow}>›</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: theme.colors.bgDark },
  greeting: { marginTop: 18, marginBottom: 22 },
  kicker: { fontFamily: theme.fonts.bold, color: theme.colors.primary, fontSize: 12, letterSpacing: 2 },
  title: { fontFamily: theme.fonts.bold, color: theme.colors.textPrimary, fontSize: 30, marginTop: 8 },
  subtitle: { fontFamily: theme.fonts.regular, color: theme.colors.textSecondary, fontSize: 15, marginTop: 5 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.cardElevated, borderWidth: 1, borderColor: theme.colors.cardBorder, marginBottom: 22 },
  balanceIcon: { fontFamily: theme.fonts.bold, fontSize: 20, color: theme.colors.gold, width: 42, textAlign: 'center' },
  balanceLabel: { fontFamily: theme.fonts.regular, color: theme.colors.textMuted, fontSize: 12 },
  balanceValue: { fontFamily: theme.fonts.bold, color: theme.colors.gold, fontSize: 17, marginTop: 2 },
  diamondsNotice: { padding: 14, borderRadius: theme.radius.sm, backgroundColor: 'rgba(255, 118, 94, 0.12)', borderWidth: 1, borderColor: 'rgba(255, 118, 94, 0.38)', marginBottom: 22 },
  diamondsTitle: { fontFamily: theme.fonts.bold, color: theme.colors.secondary, fontSize: 14 },
  diamondsCopy: { fontFamily: theme.fonts.regular, color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 5 },
  options: { gap: 12 },
  option: { minHeight: 78, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.cardBorder },
  primaryOption: { backgroundColor: 'rgba(56, 189, 248, 0.16)', borderColor: theme.colors.primary },
  optionIcon: { fontFamily: theme.fonts.regular, fontSize: 28, width: 42 },
  optionCopy: { flex: 1 },
  optionTitle: { fontFamily: theme.fonts.bold, color: theme.colors.textPrimary, fontSize: 16 },
  optionSubtitle: { fontFamily: theme.fonts.regular, color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
  arrow: { fontFamily: theme.fonts.light, color: theme.colors.primary, fontSize: 30 },
});
