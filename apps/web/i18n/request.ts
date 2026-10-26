import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

// English only for now. To add a language: add its code here and a messages/<code>.json file.
export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

// No i18n routing: the locale lives in a cookie, so URLs are the same for every language.
export default getRequestConfig(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.find((l) => l === value) ?? DEFAULT_LOCALE;

  return {
    locale,
    // Explicit default so next-intl does not fall back to the environment (ENVIRONMENT_FALLBACK).
    timeZone: process.env.APP_TIME_ZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
