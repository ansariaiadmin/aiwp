import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from "./config";

/**
 * Resolves the active locale for a request.
 *
 * Order of precedence:
 *   1. the NEXT_LOCALE cookie, set by the language switcher
 *   2. the Accept-Language header, so a first visit is not forced to Persian
 *      on an English browser
 *   3. the default locale
 *
 * Reading the header matters more than it looks — without it, an English-
 * speaking evaluator opening the app for the first time sees a wall of
 * Persian with no indication that English exists.
 */
async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;

  if (isLocale(fromCookie)) return fromCookie;

  const header = (await headers()).get("accept-language");

  if (header) {
    // Take the primary subtag of each candidate in quality order. Parsing
    // the full q-value grammar is unnecessary here; browsers list the
    // preferred language first and the fallback below covers the rest.
    for (const part of header.split(",")) {
      const tag = part.split(";")[0].trim().toLowerCase();
      if (tag.startsWith("fa")) return "fa";
      if (tag.startsWith("en")) return "en";
    }
  }

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    // Persian and English sort and pluralise differently; letting next-intl
    // own this keeps relative dates ("۲ روز پیش") correct in both.
    timeZone: "Asia/Tehran",
  };
});
