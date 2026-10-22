/**
 * TutorialModal.tsx — "Cómo funciona LITHIO"
 *
 * Se muestra la primera vez que alguien entra con un rol (y se puede volver a
 * ver desde el Perfil). Cinco pantallas cortas, distintas para pasajero y
 * conductor, que explican la app sin saturar.
 */

import React, { useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, useWindowDimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../constants/theme';
import { LithiumAtom } from './brand/LithiumAtom';
import { PressableScale } from './brand/PressableScale';
import type { SessionRole } from '../services/session';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Slide {
  icon: IconName | 'atom-animated';
  tint: 'primary' | 'secondary' | 'gold' | 'diamond' | 'success';
  title: string;
  body: string;
}

const PASSENGER_SLIDES: Slide[] = [
  {
    icon: 'atom-animated',
    tint: 'primary',
    title: 'Bienvenido a LITHIO',
    body: 'Movilidad comunitaria para la UNC, el IVIC, San Antonio y Caracas. Conductores de la comunidad, verificados uno por uno.',
  },
  {
    icon: 'map-marker-path',
    tint: 'primary',
    title: 'Pide tu viaje en tres pasos',
    body: 'Toca "Iniciar trayecto", elige tu ruta y luego al conductor que prefieras entre los disponibles. Puedes viajar ahora o programarlo.',
  },
  {
    icon: 'diamond-stone',
    tint: 'diamond',
    title: 'Diamantes y Fe',
    body: 'Los diamantes (◆) son tu saldo: 1 ◆ = 1 USD para pagar viajes. El Fe es hierro de recompensa: lo ganas al viajar y al dejar reseñas útiles.',
  },
  {
    icon: 'account-multiple-outline',
    tint: 'secondary',
    title: 'Enlaces y Fondo Solidario',
    body: 'Agrega amigos con tu código Li-XXXX para enviarles diamantes. Con "Donar" ayudas a pagar viajes de estudiantes que lo necesitan.',
  },
  {
    icon: 'flask-outline',
    tint: 'gold',
    title: 'Sube por la tabla periódica',
    body: 'Tu nivel es un elemento: empiezas en Hidrógeno y avanzas con tu Fe. Responde la Reacción del día para ganar Fe extra.',
  },
];

const DRIVER_SLIDES: Slide[] = [
  {
    icon: 'atom-animated',
    tint: 'secondary',
    title: 'Bienvenido, conductor',
    body: 'En LITHIO los pasajeros te eligen por tu reputación. Tú eres el protón: la energía que mueve a la comunidad.',
  },
  {
    icon: 'shield-check-outline',
    tint: 'success',
    title: 'Verificación primero',
    body: 'Revisamos tus datos y documentos, inspeccionamos tu moto en persona y luego te damos la luz verde. Sigue el avance en "Tu postulación".',
  },
  {
    icon: 'power',
    tint: 'secondary',
    title: 'Conéctate y acepta',
    body: 'Con el botón de encendido apareces en el directorio. Las solicitudes llegan al instante: tienes 25 segundos para aceptar o rechazar.',
  },
  {
    icon: 'wallet-outline',
    tint: 'diamond',
    title: 'Cobra en diamantes',
    body: 'Los viajes pagados con ◆ se acreditan al completarlos. Puedes retirarlos o canjearlos en el taller aliado: aceite, cadena, lavado y más.',
  },
  {
    icon: 'star-outline',
    tint: 'gold',
    title: 'Tu reputación cuenta',
    body: 'Cada reseña suma a tu calificación. Casco extra, puntualidad y manejo seguro te harán el conductor favorito de la comunidad.',
  },
];

const storageKey = (userId: number, role: SessionRole) => `lithio.tutorial.${role}.${userId}`;

export async function shouldShowTutorial(userId: number, role: SessionRole): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(storageKey(userId, role))) !== 'visto';
  } catch {
    return false;
  }
}

interface Props {
  visible: boolean;
  role: SessionRole;
  userId: number;
  onClose: () => void;
}

export const TutorialModal: React.FC<Props> = (props) => (
  <Modal visible={props.visible} animationType="fade" onRequestClose={props.onClose} statusBarTranslucent>
    <SafeAreaProvider>
      <TutorialContent {...props} />
    </SafeAreaProvider>
  </Modal>
);

const TutorialContent: React.FC<Props> = ({ role, userId, onClose }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const slides = role === 'conductor' ? DRIVER_SLIDES : PASSENGER_SLIDES;
  const accent = role === 'conductor' ? theme.colors.secondary : theme.colors.primary;
  const last = page === slides.length - 1;

  const finish = () => {
    AsyncStorage.setItem(storageKey(userId, role), 'visto').catch(() => {});
    onClose();
  };

  const goTo = (index: number) => {
    scroller.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topRow}>
        <Text style={styles.counter}>
          {page + 1} / {slides.length}
        </Text>
        <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
          <Text style={styles.skip}>Saltar</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.pager}
      >
        {slides.map((slide) => {
          const tint = theme.colors[slide.tint];
          return (
            <View key={slide.title} style={[styles.slide, { width }]}>
              <View style={[styles.art, { backgroundColor: `${tint}14`, borderColor: `${tint}33` }]}>
                {slide.icon === 'atom-animated' ? (
                  <LithiumAtom size={150} />
                ) : (
                  <MaterialCommunityIcons name={slide.icon} size={72} color={tint} />
                )}
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{slide.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {slides.map((slide, index) => (
          <View key={slide.title} style={[styles.dot, index === page && { width: 22, backgroundColor: accent }]} />
        ))}
      </View>

      <PressableScale
        style={[styles.button, { backgroundColor: accent }]}
        onPress={() => (last ? finish() : goTo(page + 1))}
        accessibilityLabel={last ? 'Empezar' : 'Siguiente'}
      >
        <Text style={[styles.buttonText, { color: role === 'conductor' ? theme.colors.onSecondary : theme.colors.onPrimary }]}>
          {last ? 'Empezar' : 'Siguiente'}
        </Text>
      </PressableScale>
    </View>
  );
};

const styles = themed(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    minHeight: 44,
  },
  counter: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  skip: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  art: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 26,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 360,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.cardBorder,
  },
  button: {
    marginHorizontal: 24,
    minHeight: 56,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
  },
}));
