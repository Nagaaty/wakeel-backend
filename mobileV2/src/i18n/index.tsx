// ─── Wakeel — i18n Provider ───────────────────────────────────────────────────
// Provides:
//   useI18n()  → { t, locale, setLocale, isRTL }
//   I18nProvider  → wraps the app, reads/writes locale from AsyncStorage
//   t(key, vars?) → translated string with optional {var} interpolation
//
// RTL: when locale === 'ar', we flip I18nManager and reload (only once per change).
// Usage in any screen:
//   const { t, isRTL } = useI18n();
//   <Text>{t('booking.title')}</Text>
//   <Text>{t('review.count', { n: '42' })}</Text>
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { I18nManager, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Locale, TranslationKey } from './translations';

// ─── Context type ─────────────────────────────────────────────────────────────
interface I18nContextType {
  locale:    Locale;
  isRTL:     boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t:         (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale:    'ar',
  isRTL:     true,
  setLocale: async () => {},
  t:         (key) => key,
});

// ─── Storage key ─────────────────────────────────────────────────────────────
const LOCALE_KEY = 'wakeel_locale';

// ─── t() — resolves key + optional {var} interpolation ───────────────────────
function resolve(
  key:   TranslationKey,
  locale: Locale,
  vars?:  Record<string, string | number>,
): string {
  const entry = translations[key];
  if (!entry) return key; // fall back to key name
  let str: string = entry[locale] ?? entry.en ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return str;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');

  // Load persisted locale on mount — respects user's saved choice
  useEffect(() => {
    AsyncStorage.getItem(LOCALE_KEY).then((saved) => {
      const locale: Locale = saved === 'en' ? 'en' : 'ar';
      applyLocale(locale, false);
    }).catch(() => applyLocale('ar', false));
  }, []);

  const applyLocale = (newLocale: Locale, persist: boolean) => {
    setLocaleState(newLocale);
    const shouldBeRTL = newLocale === 'ar';

    // Apply RTL — on web this is a no-op (we rely on CSS direction)
    if (Platform.OS !== 'web') {
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
        
        // NativeModules.DevSettings.reload() currently crashes Expo 53 Go.
        // Prompt user to restart manually.
        Alert.alert(
          newLocale === 'ar' ? 'تم تغيير اللغة' : 'Language Changed',
          newLocale === 'ar' 
            ? 'يرجى إعادة تشغيل التطبيق بالكامل (Restart) لتطبيق اتجاه الشاشة من اليمين لليسار.' 
            : 'Please completely restart the app to apply the Left-to-Right layout direction.',
          [{ text: 'OK' }]
        );
      }
    }

    if (persist) {
      AsyncStorage.setItem(LOCALE_KEY, newLocale).catch(() => {});
    }
  };

  const setLocale = useCallback(async (newLocale: Locale) => {
    applyLocale(newLocale, true);
  }, []);

  const t = useCallback((
    key:  TranslationKey,
    vars?: Record<string, string | number>,
  ): string => {
    return resolve(key, locale, vars);
  }, [locale]);

  const isRTL = locale === 'ar';

  return (
    <I18nContext.Provider value={{ locale, isRTL, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useI18n(): I18nContextType {
  return useContext(I18nContext);
}

// ─── Standalone t() for use outside components (e.g. in Redux thunks) ─────────
// Only works if called after provider initialises — returns English fallback otherwise.
let _locale: Locale = 'ar';
export function setGlobalLocale(l: Locale) { _locale = l; }
export function tGlobal(
  key:  TranslationKey,
  vars?: Record<string, string | number>,
): string {
  return resolve(key, _locale, vars);
}

// ─── RTL-aware style helper ───────────────────────────────────────────────────
// Usage: <View style={rtlRow(isRTL)}>
export const rtlRow = (isRTL: boolean) => ({
  flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
});

export const rtlText = (isRTL: boolean) => ({
  textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left',
  writingDirection: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
});

// ─── Language toggle button (drop-in component) ───────────────────────────────
import { TouchableOpacity, Text } from 'react-native';
import type { Theme } from '../theme';

export function LangToggle({ C }: { C: Theme }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <TouchableOpacity
      onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      style={{
        paddingHorizontal: 12,
        paddingVertical:   6,
        borderRadius:      20,
        borderWidth:       1,
        borderColor:       C.gold,
        backgroundColor:   `${C.gold}15`,
      }}
    >
      <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>
        {t('app.switchLang')}
      </Text>
    </TouchableOpacity>
  );
}
