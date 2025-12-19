import { useEffect, useState, useCallback } from 'react';

export type ThemePreference = 'dark' | 'light' | 'device';

function getIsDarkMode(preference: ThemePreference): boolean {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return true;
}

function applyDarkClass(isDark: boolean) {
  if (typeof document === 'undefined') return;
  
  const html = document.documentElement;
  if (isDark) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

export function useThemePreference() {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('dark');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Wrapper that applies theme immediately when called
  const setThemePreference = useCallback((newPreference: ThemePreference) => {
    const isDark = getIsDarkMode(newPreference);
    
    // Apply to DOM immediately (synchronously)
    applyDarkClass(isDark);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newPreference);
    }
    
    // Update React state
    setThemePreferenceState(newPreference);
    setIsDarkMode(isDark);
  }, []);

  // On mount: read from localStorage and apply
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('theme') as ThemePreference | null;
    const preference = (stored === 'dark' || stored === 'light' || stored === 'device') ? stored : 'dark';
    const isDark = getIsDarkMode(preference);
    
    // Apply immediately
    applyDarkClass(isDark);
    
    // Update state
    setThemePreferenceState(preference);
    setIsDarkMode(isDark);
  }, []);

  return { themePreference, setThemePreference, isDarkMode };
}
