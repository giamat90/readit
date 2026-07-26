import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";
import it from "@/locales/it.json";
import es from "@/locales/es.json";
import de from "@/locales/de.json";
import fr from "@/locales/fr.json";
import pt from "@/locales/pt.json";
import ja from "@/locales/ja.json";
import zh from "@/locales/zh.json";
import ru from "@/locales/ru.json";
import nl from "@/locales/nl.json";

const SUPPORTED = ["en", "it", "es", "de", "fr", "pt", "ja", "zh", "ru", "nl"];

export const deviceLanguage = (): string => {
  const code = Localization.getLocales()[0]?.languageCode ?? "en";
  return SUPPORTED.includes(code) ? code : "en";
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    it: { translation: it },
    es: { translation: es },
    de: { translation: de },
    fr: { translation: fr },
    pt: { translation: pt },
    ja: { translation: ja },
    zh: { translation: zh },
    ru: { translation: ru },
    nl: { translation: nl },
  },
  lng: deviceLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
