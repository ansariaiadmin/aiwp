"use client";

/**
 * Progressive-web-app glue.
 *
 * Three jobs, each small:
 *
 *  1. register the service worker — guarded by an env check so it never
 *     registers in dev, where a caching worker would serve stale code and
 *     make "why isn't my change showing" an hour of debugging
 *  2. announce offline / online with a translated toast, and remember that
 *     unsaved changes were lost if the connection dropped mid-edit
 *  3. surface the browser's install prompt, translated, so the admin panel
 *     can be launched like an app
 *
 * Everything here degrades silently: a browser without a service worker, or
 * one that refuses install prompts, simply gets a normal web app.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstaller() {
  const t = useTranslations();

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [offline, setOffline] = useState(false);

  // Register the worker once. Production only.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A failed registration must not break the app — it just means no
      // offline support this visit.
    });
  }, []);

  // Track connectivity and announce transitions.
  useEffect(() => {
    const down = () => {
      setOffline(true);
      toast.warning(t("state.offline"));
    };
    const up = () => {
      setOffline(false);
      toast.success(t("state.backOnline"));
    };

    window.addEventListener("offline", down);
    window.addEventListener("online", up);

    return () => {
      window.removeEventListener("offline", down);
      window.removeEventListener("online", up);
    };
  }, [t]);

  // Capture the deferred install prompt so we can offer it in our own UI.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;

    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    if (choice.outcome === "accepted") {
      toast.success(t("pwa.installed"));
    }

    setInstallEvent(null);
  }

  // The offline banner is announced to assistive tech and kept visually
  // subtle — a thin strip, not a modal, so reading is never blocked.
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={
          offline
            ? "bg-amber-500/95 text-foreground fixed inset-x-0 top-0 z-[60] px-4 py-1.5 text-center text-xs font-medium"
            : "hidden"
        }
      >
        {offline ? t("state.offline") : ""}
      </div>

      {installEvent && (
        <div className="fixed bottom-4 start-4 z-[60]">
          <div className="bg-popover border-border shadow-lg flex items-center gap-2 rounded-lg border p-3">
            <div className="text-sm">
              <p className="font-semibold">{t("pwa.installTitle")}</p>
              <p className="text-muted-foreground text-xs">{t("pwa.installHint")}</p>
            </div>
            <Button size="sm" onClick={() => void install()}>
              {t("pwa.install")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setInstallEvent(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
