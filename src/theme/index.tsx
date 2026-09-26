import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { colors, darkColors } from './colors';
import type { Colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { shadows } from './shadows';

const THEME_KEY = '@vendelo/theme';

export type Theme = {
  colors: Colors;
  spacing: typeof spacing;
  typography: typeof typography;
  shadows: typeof shadows;
};

type ThemeContextValue = Theme & {
  dark: boolean;
  setDark: (dark: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((value) => {
        if (value === 'dark') setDarkState(true);
      })
      .finally(() => setReady(true));
  }, []);

  const setDark = (next: boolean) => {
    setDarkState(next);
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light').catch(() => undefined);
  };

  const value: ThemeContextValue = {
    colors: dark ? darkColors : colors,
    spacing,
    typography,
    shadows,
    dark,
    setDark,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return context;
}