/**
 * AboutLithioModal.tsx — "¿Qué es LITHIO?"
 *
 * Manifiesto institucional en cinco tarjetas que se deslizan: qué es LITHIO,
 * qué significa el nombre, por qué el litio, lo que nos mueve y el cierre con
 * la versión. Cada tarjeta muestra poco texto a la vez; el nombre y los
 * principios se exploran tocando. Se abre desde la bienvenida y desde el
 * encabezado de la app.
 *
 * Abajo, "Atrás" y "Siguiente" tienen exactamente el mismo tamaño y tipografía.
 */

import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  ScrollViewInstance,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Icon, IconName } from './ui/Icon';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { VersionTag } from './ui/VersionTag';
import { theme, themed } from '../constants/theme';
import { LithiumAtom } from './brand/LithiumAtom';
import { LatticeBackground } from './brand/LatticeBackground';
import { PeriodicTile } from './brand/PeriodicTile';
import { PressableScale } from './brand/PressableScale';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const MAX_WIDTH = 560;
const SLIDES = ['intro', 'nombre', 'litio', 'valores', 'cierre'] as const;

const ACRONYM: { letter: string; word: string; meaning: string }[] = [
  { letter: 'L', word: 'Linked', meaning: 'Vinculado' },
  { letter: 'I', word: 'Intelligent', meaning: 'Inteligente' },
  { letter: 'T', word: 'Transport', meaning: 'Transporte' },
  { letter: 'H', word: 'Higher', meaning: 'Superior' },
  { letter: 'I', word: 'Innovative', meaning: 'Innovadoras' },
  { letter: 'O', word: 'Opportunities', meaning: 'Oportunidades' },
];

const LITHIUM_FACTS: { icon: IconName; text: string }[] = [
  { icon: 'arrowhead-up-outline', text: 'El metal más ligero de la tabla periódica.' },
  { icon: 'battery-outline', text: 'El corazón de las baterías que mueven el mundo: guarda energía y la entrega cuando hace falta.' },
  { icon: 'atom', text: 'Sus tres electrones inspiran nuestro emblema.' },
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

const fade = () => FadeIn.duration(220).reduceMotion(ReduceMotion.System);

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
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = Math.min(windowWidth, MAX_WIDTH);
  const pager = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const goTo = (next: number) => {
    const target = Math.max(0, Math.min(SLIDES.length - 1, next));
    pager.current?.scrollTo({ x: target * pageWidth, animated: true });
    setIndex(target);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const current = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (current !== index && current >= 0 && current < SLIDES.length) setIndex(current);
  };

  return (
    <View style={styles.root}>
      <LatticeBackground />
      <View style={[styles.frame, { width: pageWidth, paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <Text style={styles.kicker}>MANIFIESTO · {index + 1}/{SLIDES.length}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Icon name="close-outline" size={22} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          style={styles.pager}
        >
          <Slide width={pageWidth}>
            <IntroSlide />
          </Slide>
          <Slide width={pageWidth}>
            <NameSlide />
          </Slide>
          <Slide width={pageWidth}>
            <LithiumSlide />
          </Slide>
          <Slide width={pageWidth}>
            <ValuesSlide />
          </Slide>
          <Slide width={pageWidth}>
            <ClosingSlide />
          </Slide>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.dots} accessibilityRole="tablist">
            {SLIDES.map((slide, dot) => (
              <Pressable
                key={slide}
                onPress={() => goTo(dot)}
                hitSlop={8}
                accessibilityRole="tab"
                accessibilityState={{ selected: dot === index }}
                accessibilityLabel={`Tarjeta ${dot + 1} de ${SLIDES.length}`}
              >
                <View style={[styles.dot, dot === index && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
          <View style={styles.buttons}>
            <PressableScale
              variant="glass"
              onPress={() => goTo(index - 1)}
              disabled={index === 0}
              style={[styles.navButton, styles.backButton, index === 0 && styles.navDisabled]}
              accessibilityLabel="Atrás"
            >
              <Icon name="arrow-back-outline" size={18} color={theme.colors.textPrimary} />
              <Text style={[styles.navLabel, styles.backLabel]}>Atrás</Text>
            </PressableScale>
            <PressableScale
              variant="solid"
              accent={theme.colors.primary}
              onPress={() => (isLast ? onClose() : goTo(index + 1))}
              style={[styles.navButton, styles.nextButton]}
              accessibilityLabel={isLast ? 'Entendido' : 'Siguiente'}
            >
              <Text style={[styles.navLabel, styles.nextLabel]}>{isLast ? 'Entendido' : 'Siguiente'}</Text>
              <Icon name={isLast ? 'checkmark-outline' : 'arrow-forward-outline'} size={18} color={theme.colors.onPrimary} />
            </PressableScale>
          </View>
        </View>
      </View>
    </View>
  );
};

/** Una tarjeta del carrusel: si el teléfono es pequeño, su contenido se desplaza en vertical. */
const Slide: React.FC<{ width: number; children: React.ReactNode }> = ({ width, children }) => (
  <ScrollView style={{ width }} contentContainerStyle={styles.slide} showsVerticalScrollIndicator={false}>
    {children}
  </ScrollView>
);

const IntroSlide: React.FC = () => (
  <View style={styles.centered}>
    <LithiumAtom size={150} />
    <Text style={styles.title} accessibilityRole="header">¿Qué es LITHIO?</Text>
    <Text style={styles.lead}>Una red de movilidad hecha por y para la comunidad universitaria.</Text>
    <View style={styles.pillRow}>
      {['Segura', 'Cercana', 'Inteligente'].map((word) => (
        <Text key={word} style={styles.pill}>{word}</Text>
      ))}
    </View>
    <Text style={styles.caption}>Conecta a quien necesita llegar con quien puede llevarlo.</Text>
  </View>
);

const NameSlide: React.FC = () => {
  const [selected, setSelected] = useState(0);
  const item = ACRONYM[selected];
  return (
    <View>
      <Text style={styles.slideTitle} accessibilityRole="header">El nombre</Text>
      <Text style={styles.hint}>Toca cada letra</Text>
      <View style={styles.letterRow}>
        {ACRONYM.map((entry, position) => {
          const active = position === selected;
          return (
            <Pressable
              key={`${entry.word}-${position}`}
              onPress={() => setSelected(position)}
              style={[styles.letterTile, active && styles.letterTileActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${entry.letter}: ${entry.word}, ${entry.meaning}`}
            >
              <Text style={[styles.letter, active && styles.letterActive]}>{entry.letter}</Text>
            </Pressable>
          );
        })}
      </View>
      <Animated.View key={selected} entering={fade()} style={styles.wordCard}>
        <Text style={styles.wordEnglish}>{item.word}</Text>
        <Text style={styles.wordSpanish}>{item.meaning}</Text>
      </Animated.View>
      <Text style={styles.footnote}>Transporte Inteligente Vinculado para Oportunidades Innovadoras.</Text>
    </View>
  );
};

const LithiumSlide: React.FC = () => (
  <View>
    <View style={styles.centered}>
      <PeriodicTile size={104} />
      <Text style={[styles.slideTitle, styles.centerText]} accessibilityRole="header">¿Por qué el litio?</Text>
    </View>
    <View style={styles.factList}>
      {LITHIUM_FACTS.map((fact) => (
        <View key={fact.text} style={styles.fact}>
          <View style={styles.factIcon}>
            <Icon name={fact.icon} size={18} color={theme.colors.primary} />
          </View>
          <Text style={styles.factText}>{fact.text}</Text>
        </View>
      ))}
    </View>
    <Text style={styles.quote}>Así queremos que funcione nuestra comunidad: ligera, llena de energía y siempre en movimiento.</Text>
  </View>
);

const ValuesSlide: React.FC = () => {
  const list = principles();
  const [selected, setSelected] = useState(0);
  const current = list[selected];
  return (
    <View>
      <Text style={styles.slideTitle} accessibilityRole="header">Lo que nos mueve</Text>
      <Text style={styles.hint}>Toca cada principio</Text>
      <View style={styles.valueGrid}>
        {list.map((principle, position) => {
          const active = position === selected;
          return (
            <Pressable
              key={principle.title}
              onPress={() => setSelected(position)}
              style={[styles.valueTile, active && { borderColor: principle.color, backgroundColor: theme.colors.surface }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.valueIcon, { borderColor: principle.color }]}>
                <Icon name={principle.icon} size={22} color={principle.color} />
              </View>
              <Text style={styles.valueTitle} numberOfLines={2}>{principle.title}</Text>
            </Pressable>
          );
        })}
      </View>
      <Animated.View key={selected} entering={fade()} style={[styles.valueDetail, { borderLeftColor: current.color }]}>
        <Text style={styles.valueDetailTitle}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
      </Animated.View>
    </View>
  );
};

const ClosingSlide: React.FC = () => (
  <View style={styles.centered}>
    <LithiumAtom size={110} />
    <Text style={styles.closingText}>Innovación tecnológica nacida en la universidad, al servicio de quienes la hacen posible.</Text>
    <View style={styles.versionWrap}>
      <VersionTag variant="card" />
    </View>
  </View>
);

const styles = themed(() => ({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.bgDark,
  },
  frame: {
    flex: 1,
    maxWidth: MAX_WIDTH,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  kicker: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: theme.colors.primary,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.glassBg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  centered: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 30,
    color: theme.colors.textPrimary,
    marginTop: 12,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  lead: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    lineHeight: 26,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 10,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  pill: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.primaryLine,
    backgroundColor: theme.colors.primarySoft,
    overflow: 'hidden',
  },
  caption: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 18,
  },
  slideTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 26,
    color: theme.colors.textPrimary,
    marginTop: 12,
  },
  hint: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 16,
  },
  letterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  letterTile: {
    flex: 1,
    aspectRatio: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  letterTileActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    boxShadow: theme.glow.soft,
  },
  letter: {
    fontFamily: theme.fonts.bold,
    fontSize: 26,
    color: theme.colors.textSecondary,
  },
  letterActive: {
    color: theme.colors.primary,
  },
  wordCard: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 20,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  wordEnglish: {
    fontFamily: theme.fonts.bold,
    fontSize: 28,
    color: theme.colors.textPrimary,
  },
  wordSpanish: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    color: theme.colors.primary,
    marginTop: 4,
  },
  footnote: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  factList: {
    gap: 10,
    marginTop: 18,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  factIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  factText: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  quote: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginTop: 18,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary,
  },
  valueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  valueTile: {
    width: '48.5%',
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  valueIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  valueDetail: {
    marginTop: 14,
    padding: 16,
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    backgroundColor: theme.colors.glassBg,
  },
  valueDetailTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  body: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  closingText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 20,
    lineHeight: 29,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 16,
  },
  versionWrap: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.glassBorder,
  },
  dotActive: {
    width: 22,
    backgroundColor: theme.colors.primary,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  // Los dos botones comparten medidas y tipografía: solo cambia el relleno.
  navButton: {
    flex: 1,
    flexBasis: 0,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  backButton: {
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
  },
  nextButton: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  navDisabled: {
    opacity: 0.4,
  },
  navLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
  },
  backLabel: {
    color: theme.colors.textPrimary,
  },
  nextLabel: {
    color: theme.colors.onPrimary,
  },
}));
