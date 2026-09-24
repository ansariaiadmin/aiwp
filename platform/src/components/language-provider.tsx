"use client";

/**
 * Language switching.
 *
 * The locale lives in a cookie, so changing it is a plain cookie write plus
 * a refresh — there is no /[locale] route tree to navigate to and no URL to
 * rewrite. A full reload is deliberate: server components render their
 * strings at request time, so a client-side state change alone would leave
 * every server-rendered label in the old language while client components
 * showed the new one. A half-translated page is worse than a brief reload.
 */

import { createContext, useCallback, useContext, useMemo } from "react";
import { LOCALE_COOKIE, locales, localeNames, type Locale } from "@/i18n/config";

interface LanguageContextValue {
  locale: Locale;
  /** Every locale the UI can switch to, with its native name. */
  options: { value: Locale; label: string }[];
  setLocale: (next: Locale) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const setLocale = useCallback((next: Locale) => {
    if (next === locale) return;

    // One year, and not httpOnly — this is a presentation preference, not a
    // credential, and the middleware-free server read needs to see it on the
    // very next request.
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;

    // Reload so server components re-render in the new language.
    window.location.reload();
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      options: locales.map((l) => ({ value: l, label: localeNames[l] })),
      setLocale,
    }),
    [locale, setLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);

  if (!ctx) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }

  return ctx;
}
