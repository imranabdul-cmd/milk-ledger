import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '@family-milk/shared';
import { translations, TranslationKey } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to 'ml' (Malayalam) for mother's simple experience, or restore saved language from localStorage
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('milk_lang');
    return (saved === 'en' || saved === 'ml' || saved === 'ta') ? (saved as Language) : 'ml';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('milk_lang', lang);
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('milk_language_changed', { detail: lang }));
  };

  const toggleLanguage = () => {
    const order: Language[] = ['ml', 'ta', 'en'];
    const nextIdx = (order.indexOf(language) + 1) % order.length;
    setLanguage(order[nextIdx]);
  };

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem('milk_lang', language);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'milk_lang' && e.newValue && (e.newValue === 'en' || e.newValue === 'ta' || e.newValue === 'ml')) {
        setLanguageState(e.newValue as Language);
      }
    };

    const handleCustomEvent = (e: any) => {
      if (e.detail && (e.detail === 'en' || e.detail === 'ta' || e.detail === 'ml')) {
        setLanguageState(e.detail as Language);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('milk_language_changed', handleCustomEvent);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('milk_language_changed', handleCustomEvent);
    };
  }, [language]);

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.en[key] || (key as string);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
