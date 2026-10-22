/**
 * QuizScreen.tsx — Reacción del día
 *
 * Una pregunta de ciencia al día con tres opciones. Si aciertas ganas Fe;
 * en cualquier caso se revela la respuesta y un dato curioso.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { apiService, QuizToday } from '../../services/api';

interface Props {
  accent: string;
  onBack: () => void;
  /** Avisa al inicio que ya se respondió (y cuánto Fe hay ahora). */
  onAnswered: (points?: number) => void;
}

const LETTERS = ['A', 'B', 'C'];

export const QuizScreen: React.FC<Props> = ({ accent, onBack, onAnswered }) => {
  const insets = useSafeAreaInsets();
  const [quiz, setQuiz] = useState<QuizToday | null>(null);
  const [sending, setSending] = useState<number | null>(null);

  useEffect(() => {
    apiService
      .getQuizToday()
      .then(setQuiz)
      .catch((e) => Alert.alert('No se pudo cargar la Reacción', e instanceof Error ? e.message : 'Intenta de nuevo.'));
  }, []);

  const answer = async (option: number) => {
    if (!quiz || quiz.answered || sending !== null) return;
    setSending(option);
    try {
      const result = await apiService.answerQuiz(option);
      setQuiz({ ...quiz, answered: true, chosen: option, correct: result.correct, correct_index: result.correct_index, fact: result.fact });
      onAnswered(result.points);
    } catch (e) {
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally {
      setSending(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Reacción del día" onBack={onBack} />
      {!quiz ? (
        <ActivityIndicator color={accent} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.flask}>
            <MaterialCommunityIcons name="flask-outline" size={30} color={accent} />
            <Text style={styles.muted}>Acierta y gana <Text style={styles.gold}>+{quiz.reward} Fe</Text>. Una pregunta por día.</Text>
          </View>

          <Text style={styles.question}>{quiz.question}</Text>

          <View style={styles.options}>
            {quiz.options.map((option, index) => {
              const revealed = quiz.answered;
              const isCorrect = revealed && index === quiz.correct_index;
              const isWrongChoice = revealed && index === quiz.chosen && !quiz.correct;
              return (
                <Pressable
                  key={index}
                  onPress={() => void answer(index)}
                  disabled={revealed || sending !== null}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && styles.pressed,
                    isCorrect && { borderColor: theme.colors.success, backgroundColor: theme.colors.surfaceAlt },
                    isWrongChoice && { borderColor: theme.colors.error },
                    revealed && !isCorrect && !isWrongChoice && styles.dim,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: revealed, selected: index === quiz.chosen }}
                >
                  <Text style={[styles.letter, { color: accent }]}>{LETTERS[index]}</Text>
                  <Text style={styles.optionText}>{option}</Text>
                  {sending === index ? <ActivityIndicator color={accent} /> : null}
                  {isCorrect ? <MaterialCommunityIcons name="check-circle" size={22} color={theme.colors.success} /> : null}
                  {isWrongChoice ? <MaterialCommunityIcons name="close-circle" size={22} color={theme.colors.error} /> : null}
                </Pressable>
              );
            })}
          </View>

          {quiz.answered ? (
            <Animated.View entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)} style={styles.result}>
              <Text style={[styles.resultTitle, { color: quiz.correct ? theme.colors.success : theme.colors.textPrimary }]}>
                {quiz.correct ? `¡Reacción exitosa! +${quiz.reward} Fe` : 'Esta vez no hubo reacción'}
              </Text>
              {quiz.fact ? <Text style={styles.fact}>{quiz.fact}</Text> : null}
              <Text style={styles.muted}>Vuelve mañana para una nueva pregunta.</Text>
            </Animated.View>
          ) : null}
        </ScrollView>
      )}
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
    gap: 20,
  },
  flask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  muted: {
    flexShrink: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  gold: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
  },
  question: {
    fontFamily: theme.fonts.bold,
    fontSize: 22,
    lineHeight: 30,
    color: theme.colors.textPrimary,
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.surface,
  },
  pressed: {
    opacity: 0.8,
  },
  dim: {
    opacity: 0.5,
  },
  letter: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 16,
  },
  optionText: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 15.5,
    color: theme.colors.textPrimary,
  },
  result: {
    gap: 8,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  resultTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
  },
  fact: {
    fontFamily: theme.fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: theme.colors.textPrimary,
  },
}));
