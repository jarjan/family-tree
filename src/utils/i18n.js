import { createContext } from "preact";
import { useContext } from "preact/hooks";
import en from "../locales/en.json" with { type: "json" };
import kk from "../locales/kk.json" with { type: "json" };

export const dictionaries = {
  en,
  kk,
};

export const DEFAULT_LANGUAGE = "kk";

export function isSupportedLanguage(lang) {
  return Object.hasOwn(dictionaries, lang);
}

export function translate(lang, key) {
  return dictionaries[lang]?.[key] || dictionaries.en[key] || key;
}

export const LanguageContext = createContext(DEFAULT_LANGUAGE);

/** Returns a `t(key)` bound to the language provided by the nearest LanguageContext. */
export function useT() {
  const lang = useContext(LanguageContext);
  return (key) => translate(lang, key);
}
