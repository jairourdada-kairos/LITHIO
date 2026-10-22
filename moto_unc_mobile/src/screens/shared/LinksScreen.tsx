/**
 * LinksScreen.tsx — Enlaces: amigos de viaje
 *
 * Cada persona tiene un código Li-XXXX. Al aceptar una solicitud se forma
 * un enlace; su tipo depende de los viajes compartidos (como un enlace
 * químico): nuevo → iónico (1+ viaje) → covalente (5+ viajes).
 * La lista se ordena por Fe acumulado, a modo de tabla de posiciones.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Share, Alert, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themed } from '../../constants/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Avatar } from '../../components/ui/Avatar';
import { ElementTile } from '../../components/brand/ElementTile';
import { FormField } from '../../components/FormField';
import { PressableScale } from '../../components/brand/PressableScale';
import { apiService, BondType, LinkPerson, LinksInfo } from '../../services/api';

interface Props {
  accent: string;
  onBack: () => void;
}

const BOND: Record<BondType, { label: string; hint: string }> = {
  nuevo: { label: 'Nuevo', hint: 'Aún sin viajes juntos' },
  iónico: { label: 'Iónico', hint: '1 a 4 viajes juntos' },
  covalente: { label: 'Covalente', hint: '5 o más viajes juntos' },
};

export const LinksScreen: React.FC<Props> = ({ accent, onBack }) => {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<LinksInfo | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setInfo(await apiService.getLinks());
    } catch (e) {
      Alert.alert('No se pudieron cargar tus enlaces', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
      await load();
    } catch (e) {
      Alert.alert('No se pudo completar', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  const sendRequest = async () => {
    const value = code.trim();
    if (value.length < 4) {
      setError('Escribe el código, por ejemplo Li-7K2Q.');
      return;
    }
    setError(undefined);
    setBusy('request');
    try {
      await apiService.requestLink(value);
      setCode('');
      await load();
      Alert.alert('Solicitud enviada', 'Cuando la acepte, aparecerá en tus enlaces.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar.');
    } finally {
      setBusy(null);
    }
  };

  const remove = (person: LinkPerson, wording: string) =>
    Alert.alert(wording, `${person.name} dejará de estar en tus enlaces.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: wording, style: 'destructive', onPress: () => void run(`r${person.link_id}`, () => apiService.removeLink(person.link_id)) },
    ]);

  const shareCode = () => {
    if (!info?.my_code) return;
    void Share.share({ message: `Agrégame en LITHIO como enlace de viaje: ${info.my_code}` });
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Enlaces" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={accent} />}
      >
        <Pressable onPress={shareCode} style={[styles.codeCard, { borderColor: accent }]} accessibilityRole="button" accessibilityLabel="Compartir mi código">
          <Text style={styles.muted}>Tu código de enlace</Text>
          <Text style={[styles.code, { color: accent }]}>{info?.my_code ?? '—'}</Text>
          <View style={styles.shareRow}>
            <MaterialCommunityIcons name="share-variant" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.muted}>Toca para compartirlo</Text>
          </View>
        </Pressable>

        <View style={styles.addRow}>
          <FormField
            label="Agregar por código"
            placeholder="Li-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
            error={error}
            maxLength={12}
            containerStyle={styles.flex}
          />
          <PressableScale style={[styles.addBtn, { backgroundColor: accent }]} onPress={sendRequest} disabled={busy !== null} accessibilityLabel="Enviar solicitud">
            <MaterialCommunityIcons name="account-plus" size={22} color={theme.colors.bgDark} />
          </PressableScale>
        </View>

        {info?.incoming.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Solicitudes recibidas</Text>
            {info.incoming.map((person) => (
              <View key={person.link_id} style={styles.row}>
                <Avatar name={person.name} uri={person.avatar_url} size={40} ringColor={accent} />
                <Text style={[styles.name, styles.flex]}>{person.name}</Text>
                <Pressable onPress={() => remove(person, 'Rechazar')} style={styles.iconBtn} accessibilityLabel={`Rechazar a ${person.name}`}>
                  <MaterialCommunityIcons name="close" size={20} color={theme.colors.textSecondary} />
                </Pressable>
                <PressableScale
                  style={[styles.acceptBtn, { backgroundColor: accent }]}
                  onPress={() => void run(`a${person.link_id}`, () => apiService.acceptLink(person.link_id))}
                  disabled={busy !== null}
                >
                  <Text style={styles.acceptText}>Aceptar</Text>
                </PressableScale>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tus enlaces · por Fe acumulado</Text>
          {info && info.links.length === 0 ? (
            <Text style={styles.empty}>
              Comparte tu código con tus compañeros de ruta. Juntos suman viajes y su enlace se vuelve más fuerte.
            </Text>
          ) : null}
          {info?.links.map((person, index) => (
            <Pressable
              key={person.link_id}
              onLongPress={() => remove(person, 'Quitar enlace')}
              style={styles.row}
              accessibilityHint="Mantén presionado para quitar el enlace"
            >
              <Text style={styles.rank}>{index + 1}</Text>
              <ElementTile z={person.element.z} symbol={person.element.symbol} size={44} accent={accent} />
              <View style={styles.flex}>
                <Text style={styles.name}>{[person.name, person.last_name].filter(Boolean).join(' ')}</Text>
                <Text style={styles.muted}>
                  {BOND[person.bond].label} · {person.rides_together} {person.rides_together === 1 ? 'viaje' : 'viajes'} juntos
                </Text>
              </View>
              <Text style={styles.fe}>Fe {person.fe_lifetime}</Text>
            </Pressable>
          ))}
        </View>

        {info?.outgoing.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Esperando respuesta</Text>
            {info.outgoing.map((person) => (
              <View key={person.link_id} style={styles.row}>
                <Avatar name={person.name} uri={person.avatar_url} size={36} ringColor={theme.colors.cardBorder} />
                <Text style={[styles.muted, styles.flex]}>{person.name}</Text>
                <Pressable onPress={() => remove(person, 'Cancelar solicitud')} accessibilityRole="button">
                  <Text style={styles.link}>Cancelar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.legend}>
          {(Object.keys(BOND) as BondType[]).map((key) => (
            <Text key={key} style={styles.muted}>
              <Text style={styles.legendLabel}>{BOND[key].label}: </Text>
              {BOND[key].hint}
            </Text>
          ))}
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
    gap: 20,
  },
  flex: {
    flex: 1,
  },
  muted: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  codeCard: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 20,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
  },
  code: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 30,
    letterSpacing: 2,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rank: {
    width: 18,
    textAlign: 'center',
    fontFamily: theme.fonts.monoBold,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  name: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  fe: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 13,
    color: theme.colors.gold,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  acceptBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.bgDark,
  },
  link: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.colors.error,
  },
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  legend: {
    gap: 4,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  legendLabel: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.textPrimary,
  },
}));
