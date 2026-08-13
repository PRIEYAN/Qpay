import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { palettes, type Palette, type ThemeMode } from './theme';

type ThemeContextValue = {
  mode: ThemeMode;
  /** The resolved palette as JS values — for SVG/canvas consumers only. */
  theme: Palette;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const STORAGE_KEY = '@qpay/themeMode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function systemMode(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Mirrors the mobile `ThemeProvider`, with one addition the web needs: an
 * explicit user override that persists. Mobile could only follow
 * `useColorScheme()`; here a user who picks a mode in Settings should keep
 * it across reloads, so a stored choice wins over the OS preference and
 * only an unset choice keeps tracking the system.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode() ?? systemMode());
  const [hasOverride, setHasOverride] = useState(() => readStoredMode() !== null);

  // Keep following the OS while the user hasn't chosen explicitly.
  useEffect(() => {
    if (hasOverride || typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handle = (e: MediaQueryListEvent) => setModeState(e.matches ? 'dark' : 'light');
    query.addEventListener('change', handle);
    return () => query.removeEventListener('change', handle);
  }, [hasOverride]);

  // The single write that repaints the whole app.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setHasOverride(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Theme preference is a nicety — never break rendering over it.
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, theme: palettes[mode], isDark: mode === 'dark', setMode, toggle }),
    [mode, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme() must be called from inside <ThemeProvider>.');
  return ctx;
}
