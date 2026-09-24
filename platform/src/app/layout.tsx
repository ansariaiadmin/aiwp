import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, setRequestLocale } from "next-intl/server";
import { DirectionProvider } from "@radix-ui/react-direction";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import { LanguageProvider } from "@/components/language-provider";
import { PwaInstaller } from "@/components/pwa-installer";
import { directionOf, isLocale, defaultLocale, type Locale } from "@/i18n/config";
import "./globals.css";

/**
 * Latin text in Inter, Persian in Vazirmatn — both self-hosted.
 *
 * Self-hosted rather than next/font/google on purpose. Google Fonts is
 * fetched at *build* time, which makes the build depend on outbound network
 * access; this project ships as a zip that people unzip and run offline, so
 * a build step that needs the internet is a broken build step on their
 * machine. Both faces live in src/fonts/ under the SIL OFL 1.1, which
 * permits redistribution alongside the source.
 *
 * Both are variable fonts exposed as CSS variables and selected by the body
 * font stack, so a document mixing scripts renders each run in the right
 * face. Vazirmatn is drawn to sit beside a Latin face at a matching
 * x-height, which is why it is the Persian choice rather than a system
 * default.
 */
const inter = localFont({
  src: "../fonts/Inter-latin-var.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
  style: "normal",
});

const vazirmatn = localFont({
  src: "../fonts/Vazirmatn-var.ttf",
  variable: "--font-vazirmatn",
  display: "swap",
  weight: "100 900",
  style: "normal",
});

export async function generateMetadata(): Promise<Metadata> {
  const raw = await getLocale();
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const fa = locale === "fa";

  return {
    title: {
      default: fa
        ? "AiWp Platform — مدیریت فکتوری پلاگین وردپرس"
        : "AiWp Platform — WordPress plugin factory management",
      template: "%s | AiWp Platform",
    },
    description: fa
      ? "پنل مدیریت کامل برای فکتوری پلاگین‌های وردپرس AiWp: لایسنس، مشتریان، تنظیمات هوش مصنوعی و پیامک."
      : "Full admin panel for the AiWp WordPress plugin factory: licensing, customers, AI provider and SMS settings.",
    robots: { index: false, follow: false },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    // iOS ignores manifest theme_color; it needs these meta hints.
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "AiWp",
    },
  };
}

export const viewport: Viewport = {
  // "interactive-widget=resizes-content" keeps the mobile keyboard from
  // covering toolbars; safe-area insets are consumed in globals.css.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161a24" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single source of truth: this runs the same resolver as the message
  // loader, so <html lang> and the rendered strings can never disagree.
  // Duplicating the cookie read here is what made the Accept-Language
  // fallback work for messages but not for the document direction.
  const raw = await getLocale();
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;

  // Tells next-intl which locale this render belongs to. Required for
  // static rendering; harmless on dynamic routes.
  setRequestLocale(locale);

  // Direction is derived from the locale, never hardcoded. Every Radix
  // primitive inside reads this provider, so menus, selects and dialogs
  // open on the correct side without per-component dir attributes.
  const dir = directionOf(locale);

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${inter.variable} ${vazirmatn.variable} font-sans antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DirectionProvider dir={dir}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <QueryProvider>
                <LanguageProvider locale={locale}>
                  <PwaInstaller />
                  {children}
                  <Toaster position="top-center" richColors dir={dir} />
                </LanguageProvider>
              </QueryProvider>
            </ThemeProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
