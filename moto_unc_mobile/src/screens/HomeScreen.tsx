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
  kicker: { color: theme.colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.colors.textPrimary, fontSize: 30, fontWeight: '800', marginTop: 8 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, marginTop: 5 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.cardElevated, borderWidth: 1, borderColor: theme.colors.cardBorder, marginBottom: 22 },
  balanceIcon: { fontSize: 20, fontWeight: '900', color: theme.colors.gold, width: 42, textAlign: 'center' },
  balanceLabel: { color: theme.colors.textMuted, fontSize: 12 },
  balanceValue: { color: theme.colors.gold, fontSize: 17, fontWeight: '800', marginTop: 2 },
  diamondsNotice: { padding: 14, borderRadius: theme.radius.sm, backgroundColor: 'rgba(255, 118, 94, 0.12)', borderWidth: 1, borderColor: 'rgba(255, 118, 94, 0.38)', marginBottom: 22 },
  diamondsTitle: { color: theme.colors.secondary, fontSize: 14, fontWeight: '800' },
  diamondsCopy: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 5 },
  options: { gap: 12 },
  option: { minHeight: 78, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.cardBorder },
  primaryOption: { backgroundColor: 'rgba(56, 189, 248, 0.16)', borderColor: theme.colors.primary },
  optionIcon: { fontSize: 28, width: 42 },
  optionCopy: { flex: 1 },
  optionTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '800' },
  optionSubtitle: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
  arrow: { color: theme.colors.primary, fontSize: 30, fontWeight: '300' },
});
