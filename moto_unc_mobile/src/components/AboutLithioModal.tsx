/**
 * AboutLithioModal.tsx — "¿Qué es LITHIO?"
 *
 * Manifiesto institucional: qué significa el nombre, por qué el litio y
 * qué promete la plataforma a la comunidad universitaria. Se abre desde la
 * bienvenida y desde el encabezado de la app.
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Icon, IconName } from './ui/Icon';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../constants/theme';
import { LithiumAtom } from './brand/LithiumAtom';
import { LatticeBackground } from './brand/LatticeBackground';
import { PeriodicTile } from './brand/PeriodicTile';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ACRONYM: { letter: string; word: string; meaning: string }[] = [
  { letter: 'L', word: 'Linked', meaning: 'Vinculado' },
  { letter: 'I', word: 'Intelligent', meaning: 'Inteligente' },
  { letter: 'T', word: 'Transport', meaning: 'Transporte' },
  { letter: 'H', word: 'Higher', meaning: 'Superior' },
  { letter: 'I', word: 'Innovative', meaning: 'Innovadoras' },
  { letter: 'O', word: 'Opportunities', meaning: 'Oportunidades' },
];

const principles = (): {
  icon: IconName;
  title: string;
  body: string;
  color: string;
}[] => [ // Función: lee la paleta activa
  {
    icon: 'shield-outline',
    title: 'Confianza verificada',
    body: 'Cada conductor es parte de la comunidad universitaria y se registra con su identidad real. Las reseñas de cada viaje construyen su reputación.',
    color: theme.colors.primary,
  },
  {
    icon: 'lock',
    title: 'Privacidad por diseño',
    body: 'Tu cédula, teléfono y datos de pago se guardan cifrados. Nadie, ni siquiera quien administra la base de datos, puede leerlos en claro.',
    color: theme.colors.primary,
  },
  {
    icon: 'people-outline',
    title: 'Transporte comunitario',
    body: 'Estudiantes, docentes e investigadores que se mueven entre la UNC, el IVIC, San Antonio de los Altos y Caracas, ayudándose entre sí.',
    color: theme.colors.secondary,
  },
  {
    icon: 'star-outline',
    title: 'Energía que se recompensa',
    body: 'Cada viaje y cada reseña útil suma Fe. Con Fe obtienes descuentos y premios por tu esfuerzo académico, como el voucher "Pasar con 20".',
    color: theme.colors.gold,
  },
];

export const AboutLithioModal: React.FC<Props> = ({ visible, onClose }) => (
  <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    {/* Un Modal es otra ventana nativa: necesita su propio proveedor de márgenes seguros. */}
    <SafeAreaProvider>
      <AboutContent onClose={onClose} />
    </SafeAreaProvider>
  </Modal>
);

const AboutContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <LatticeBackground />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Icon name="close-outline" size={22} color={theme.colors.textSecondary} />
          </Pressable>

          <View style={styles.hero}>
            <LithiumAtom size={120} />
            <Text style={styles.kicker}>MANIFIESTO</Text>
            <Text style={styles.title} accessibilityRole="header">¿Qué es LITHIO?</Text>
            <Text style={styles.lead}>
              Una red de movilidad hecha por y para la comunidad universitaria: conecta a quien necesita llegar con
              quien puede llevarlo, de forma segura, cercana e inteligente.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>El nombre</Text>
          <View style={styles.card}>
            {ACRONYM.map((item, index) => (
              <View key={`${item.word}-${index}`} style={styles.acronymRow}>
                <Text style={styles.acronymLetter}>{item.letter}</Text>
                <Text style={styles.acronymWord}>{item.word}</Text>
                <Text style={styles.acronymMeaning}>{item.meaning}</Text>
              </View>
            ))}
            <Text style={styles.cardFootnote}>
              Transporte Inteligente Vinculado para Oportunidades Innovadoras.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>¿Por qué el litio?</Text>
          <View style={[styles.card, styles.whyCard]}>
            <PeriodicTile size={64} />
            <Text style={styles.body}>
              El litio es el metal más ligero de la tabla periódica y el corazón de las baterías que mueven el mundo:
              guarda energía y la entrega cuando hace falta. Así queremos que funcione nuestra comunidad, ligera,
              llena de energía y siempre en movimiento. Sus tres electrones inspiran nuestro emblema.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Lo que nos mueve</Text>
          {principles().map((principle) => (
            <View key={principle.title} style={[styles.card, styles.principle]}>
              <View style={[styles.principleIcon, { borderColor: principle.color }]}>
                <Icon name={principle.icon} size={20} color={principle.color} />
              </View>
              <View style={styles.principleText}>
                <Text style={styles.principleTitle}>{principle.title}</Text>
                <Text style={styles.body}>{principle.body}</Text>
              </View>
            </View>
          ))}

          <View style={styles.closing}>
            <Text style={styles.closingText}>
              Innovación tecnológica nacida en la universidad, al servicio de quienes la hacen posible.
            </Text>
          </View>

          <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
            <Text style={styles.doneText}>Entendido</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.glassBg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 12,
  },
  kicker: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: theme.colors.primary,
    marginTop: 8,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 30,
    color: theme.colors.textPrimary,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  lead: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  sectionTitle: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    backgroundColor: theme.colors.glassBg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    borderRadius: theme.radius.lg,
    padding: 16,
  },
  acronymRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 4,
  },
  acronymLetter: {
    fontFamily: theme.fonts.bold,
    width: 28,
    fontSize: 20,
    color: theme.colors.primary,
  },
  acronymWord: {
    fontFamily: theme.fonts.semibold,
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  acronymMeaning: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  cardFootnote: {
    fontFamily: theme.fonts.regular,
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
  },
  whyCard: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  body: {
    fontFamily: theme.fonts.regular,
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  principle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  principleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principleText: {
    flex: 1,
  },
  principleTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  closing: {
    marginTop: 18,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary,
  },
  closingText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textPrimary,
  },
  doneBtn: {
    marginTop: 28,
    minHeight: 50,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.bgDark,
    fontSize: 16,
  },
}));
