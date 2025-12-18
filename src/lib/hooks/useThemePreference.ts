import { useEffect, useState } from 'react';

export type ThemePreference = 'dark' | 'light' | 'device';

const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'dark';
  const savedTheme = window.localStorage.getItem('theme');
  return savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'device' ? savedTheme : 'dark';
};

const getSystemIsDark = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const computeIsDarkMode = (preference: ThemePreference) => {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  return getSystemIsDark();
};

export function useThemePreference() {
  /**
   * IMPORTANT for Next.js hydration:
   * - Client Components are still pre-rendered on the server.
   * - Reading `localStorage` during initial render yields different results on server vs client,
   *   which causes hydration attribute mismatches.
   *
   * So we use a deterministic initial render (dark), then load the real preference after mount.
   */
  const [themePreference, setThemePreference] = useState<ThemePreference>('dark');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = getStoredThemePreference();
    setThemePreference(stored);
    setIsDarkMode(computeIsDarkMode(stored));
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('theme', themePreference);
  }, [hasHydrated, themePreference]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window === 'undefined') return;

    if (themePreference !== 'device') {
      setIsDarkMode(themePreference === 'dark');
      return;
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setIsDarkMode(mql.matches);
    apply();

    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }

    // Safari < 14
    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(handler);
    // eslint-disable-next-line deprecation/deprecation
    return () => mql.removeListener(handler);
  }, [hasHydrated, themePreference]);

  return { themePreference, setThemePreference, isDarkMode };
}


