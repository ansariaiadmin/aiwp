/**
 * Locale configuration.
 *
 * The locale is carried in a cookie rather than a /[locale] path segment.
 * That is a deliberate choice for this codebase: it has a large set of
 * existing routes (/admin/*, /dashboard/*, /store) and, more importantly, a
 * published plugin contract at /api/v1/license/* that must not move. Adding
 * a locale segment would rewrite every one of those URLs for no gain, since
 * nothing here is indexed — metadata sets robots noindex.
 *
 * Direction is derived from the locale and never hardcoded, so adding a
 * third language is a one-line change here.
 */

export const locales = ["fa", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fa";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeNames: Record<Locale, string> = {
  fa: "فارسی",
  en: "English",
};

/**
 * Writing direction per locale. Derived rather than assumed: a future
 * Hebrew or Urdu locale must not inherit RTL by accident from the default.
 */
export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  fa: "rtl",
  en: "ltr",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): "rtl" | "ltr" {
  return localeDirection[locale];
}

/**
 * The BCP-47 tag used for number, date and currency formatting.
 *
 * fa-IR gives Persian digits and the Solar Hijri calendar by default. That
 * is a real product decision, not a detail: prices in Toman read naturally
 * with Persian digits, but a licence key or an order reference must never be
 * reformatted, so callers that render identifiers use the raw string.
 */
export const localeFormatTag: Record<Locale, string> = {
  fa: "fa-IR",
  en: "en-US",
};
