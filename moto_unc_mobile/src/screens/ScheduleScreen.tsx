import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  onBack: () => void;
  onContinue: (date: string, time: string) => void;
}

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const weekDays = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export const ScheduleScreen: React.FC<Props> = ({ onBack, onContinue }) => {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [time, setTime] = useState('08:00');
  const days = useMemo(() => new Date(year, month + 1, 0).getDate(), [month, year]);
  const firstDay = new Date(year, month, 1).getDay();

  const changeMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
    setSelectedDay(null);
  };

  const selectedDate = selectedDay ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}` : '';

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Volver</Text></TouchableOpacity>
      <Text style={styles.kicker}>PROGRAMAR VIAJE</Text>
      <Text style={styles.title}>¿Qué día viajas?</Text>
      <Text style={styles.subtitle}>Elige una fecha y después asignaremos la hora.</Text>

      <View style={styles.calendar}>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => changeMonth(-1)}><Text style={styles.monthArrow}>‹</Text></TouchableOpacity>
          <Text style={styles.monthTitle}>{monthNames[month]} {year}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}><Text style={styles.monthArrow}>›</Text></TouchableOpacity>
        </View>
        <View style={styles.weekRow}>{weekDays.map(day => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
        <View style={styles.daysGrid}>
          {Array.from({ length: firstDay }).map((_, index) => <View key={`empty-${index}`} style={styles.day} />)}
          {Array.from({ length: days }, (_, index) => index + 1).map(day => {
            const selected = day === selectedDay;
            return <TouchableOpacity key={day} style={[styles.day, selected && styles.selectedDay]} onPress={() => setSelectedDay(day)}><Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text></TouchableOpacity>;
          })}
        </View>
      </View>

      <View style={styles.selectedBox}>
        <Text style={styles.selectedLabel}>Fecha seleccionada</Text>
        <Text style={styles.selectedValue}>{selectedDate || 'Selecciona un día del calendario'}</Text>
        <Text style={styles.timeLabel}>Hora de recogida</Text>
        <TextInput style={styles.timeInput} value={time} onChangeText={setTime} placeholder="08:00" placeholderTextColor={theme.colors.textMuted} keyboardType="numbers-and-punctuation" />
      </View>
      <TouchableOpacity style={[styles.continue, (!selectedDay || !time) && styles.disabled]} disabled={!selectedDay || !time} onPress={() => onContinue(selectedDate, time)}>
        <Text style={styles.continueText}>Continuar a la hora →</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: theme.colors.bgDark },
  back: { fontFamily: theme.fonts.bold, color: theme.colors.primary, fontSize: 16, marginBottom: 26 },
  kicker: { fontFamily: theme.fonts.bold, color: theme.colors.primary, fontSize: 12, letterSpacing: 2 },
  title: { fontFamily: theme.fonts.bold, color: theme.colors.textPrimary, fontSize: 28, marginTop: 8 },
  subtitle: { fontFamily: theme.fonts.regular, color: theme.colors.textSecondary, fontSize: 14, marginTop: 5, marginBottom: 22 },
  calendar: { backgroundColor: theme.colors.cardBg, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 16 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  monthTitle: { fontFamily: theme.fonts.bold, color: theme.colors.textPrimary, fontSize: 18 },
  monthArrow: { fontFamily: theme.fonts.regular, color: theme.colors.primary, fontSize: 32, lineHeight: 32, paddingHorizontal: 10 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  weekDay: { fontFamily: theme.fonts.bold, width: 36, textAlign: 'center', color: theme.colors.textMuted, fontSize: 12 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  dayText: { fontFamily: theme.fonts.regular, color: theme.colors.textPrimary, fontSize: 15 },
  selectedDay: { backgroundColor: theme.colors.primary },
  selectedDayText: { fontFamily: theme.fonts.bold, color: '#082f49' },
  selectedBox: { marginTop: 18, padding: 15, borderRadius: theme.radius.md, backgroundColor: theme.colors.cardElevated },
  selectedLabel: { fontFamily: theme.fonts.regular, color: theme.colors.textMuted, fontSize: 12 },
  selectedValue: { fontFamily: theme.fonts.bold, color: theme.colors.textPrimary, fontSize: 16, marginTop: 4 },
  timeLabel: { fontFamily: theme.fonts.regular, color: theme.colors.textMuted, fontSize: 12, marginTop: 14 },
  timeInput: { fontFamily: theme.fonts.bold, color: theme.colors.textPrimary, fontSize: 18, marginTop: 4, paddingVertical: 4 },
  continue: { marginTop: 18, padding: 16, alignItems: 'center', borderRadius: theme.radius.md, backgroundColor: theme.colors.primary },
  disabled: { opacity: 0.4 },
  continueText: { fontFamily: theme.fonts.bold, color: '#082f49', fontSize: 16 },
});
