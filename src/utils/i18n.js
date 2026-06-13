import en from "../locales/en.json";
import kk from "../locales/kk.json";

export const dictionaries = {
  en,
  kk,
};

export let currentLanguage = "kk";

export function setLanguage(lang) {
  currentLanguage = lang;
}

export function t(key) {
  return dictionaries[currentLanguage]?.[key] || dictionaries["en"][key] || key;
}
