import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, type Language } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (path: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved === 'uk' || saved === 'en') {
      return saved;
    }
    return 'uk';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
    document.documentElement.setAttribute('lang', lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'uk' ? 'en' : 'uk');
  }, [language, setLanguage]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  // Рекурсивний або розділений крапкою резолвер ключів перекладу (e.g. 'common.save')
  const t = useCallback((path: string, fallback?: string): string => {
    const keys = path.split('.');
    let current: unknown = translations[language];

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        // Fallback to UK if missing in EN
        let fallbackVal: unknown = translations.uk;
        for (const fKey of keys) {
          if (fallbackVal && typeof fallbackVal === 'object' && fKey in fallbackVal) {
            fallbackVal = (fallbackVal as Record<string, unknown>)[fKey];
          } else {
            fallbackVal = undefined;
            break;
          }
        }
        return (typeof fallbackVal === 'string' ? fallbackVal : fallback) || path;
      }
    }

    return typeof current === 'string' ? current : (fallback || path);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
