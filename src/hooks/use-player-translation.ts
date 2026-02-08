import { Locale } from "../types/player";
import { translations, TranslationKey } from "../lib/locale";

export function usePlayerTranslation(locale: Locale) {
  return (key: TranslationKey): string => {
    return translations[locale][key] || translations["en-US"][key];
  };
}
