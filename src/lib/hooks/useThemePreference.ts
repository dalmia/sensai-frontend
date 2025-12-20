import { useEffect, useState, useCallback } from 'react';

export type ThemePreference = 'dark' | 'light' | 'device';

type ThemeListener = (preference: ThemePreference, isDark: boolean) => void;

// Simple shared state + pub/sub so all hook instances stay in sync
let currentPreference: ThemePreference = 'dark';
let currentIsDark = true;
const listeners = new Set<ThemeListener>();

function notify(preference: ThemePreference, isDark: boolean) {
  currentPreference = preference;
  currentIsDark = isDark;
  listeners.forEach((listener) => listener(preference, isDark));
}

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
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(currentPreference);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(currentIsDark);

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
    notify(newPreference, isDark);
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

    // Keep shared state in sync so other hook instances update immediately
    notify(preference, isDark);
  }, []);

  // Subscribe to updates from other hook instances (e.g., header toggle)
  useEffect(() => {
    const listener: ThemeListener = (preference, isDark) => {
      setThemePreferenceState(preference);
      setIsDarkMode(isDark);
      applyDarkClass(isDark);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { themePreference, setThemePreference, isDarkMode };
}
