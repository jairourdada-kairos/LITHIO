/**
 * ThemeMode.tsx — Preferencia de apariencia: claro, oscuro o automático
 *
 * "Automático" sigue el modo del sistema. La preferencia se guarda en el
 * teléfono. Los hijos se vuelven a montar al cambiar de esquema para que
 * todos los estilos (`themed`) se recalculen con la paleta nueva.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorScheme, setActiveScheme } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'lithio.themeMode';

interface ThemeModeContextValue {
  mode: ThemeMode;
  scheme: ColorScheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'dark',
  scheme: 'dark',
  setMode: () => {},
});

export const ThemeModeProvider: React.FC<{ children: (scheme: ColorScheme) => React.ReactNode }> = ({ children }) => {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const scheme: ColorScheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  // La paleta activa se fija antes de pintar a los hijos.
  setActiveScheme(scheme);

  const value = useMemo(
    () => ({
      mode,
      scheme,
      setMode: (next: ThemeMode) => {
        setModeState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    }),
    [mode, scheme]
  );

  if (!loaded) return null;
  return <ThemeModeContext.Provider value={value}>{children(scheme)}</ThemeModeContext.Provider>;
};

export const useThemeMode = () => useContext(ThemeModeContext);
