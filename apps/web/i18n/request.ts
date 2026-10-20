import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

// Сейчас только английский. Новый язык: добавить код сюда и файл messages/<код>.json.
export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

// Без i18n-роутинга: язык хранится в cookie, URL одинаковые для RU и EN.
export default getRequestConfig(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.find((l) => l === value) ?? DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
