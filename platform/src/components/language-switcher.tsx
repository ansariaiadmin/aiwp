"use client";

/**
 * Language switcher.
 *
 * Shows each language in its own script — "فارسی" and "English" — rather
 * than translated into the current language. A user who cannot read the
 * current language is exactly the person who needs to find their own, and
 * "Persian" written in English is no use to them.
 *
 * Language names stay LTR-neutral in layout terms: they sit in a menu whose
 * alignment follows the document direction, but the words themselves are not
 * mirrored.
 */

import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/components/language-provider";

export function LanguageSwitcher() {
  const t = useTranslations("a11y");
  const { locale, options, setLocale } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("toggleLanguage")}>
          <Languages className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            // Each option keeps its own natural direction so neither name is
            // rendered backwards inside the other locale's layout.
            dir="auto"
            onClick={() => setLocale(option.value)}
            // aria-current rather than a disabled state: the active language
            // stays focusable and announced, it just does nothing on click.
            aria-current={option.value === locale ? "true" : undefined}
            className={option.value === locale ? "font-semibold" : undefined}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
