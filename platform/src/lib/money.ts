/**
 * Money formatting. Amounts are always integers in the currency's smallest
 * unit (see productPlans.price) — never floats.
 *
 * Iranian conventions: an IRR amount is rendered in Rial with a Persian
 * thousands separator, and the Toman equivalent is shown alongside it
 * because that is how prices are actually quoted in the Iranian market.
 */

const CURRENCY_LABEL: Record<string, string> = {
  IRR: "ریال",
  TMN: "تومان",
  USD: "دلار",
  EUR: "یورو",
};

export function formatAmount(amount: number, currency: string): string {
  const upper = currency.toUpperCase();
  const label = CURRENCY_LABEL[upper] ?? upper;

  if (upper === "IRR" || upper === "TMN") {
    return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(Math.round(amount))} ${label}`;
  }

  // Everything else is assumed to use a 1/100 subunit, like USD cents.
  const major = Math.round(amount) / 100;

  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: upper,
  }).format(major)}`;
}

/** "1,500,000 ریال (۱۵۰٬۰۰۰ تومان)" — the way Iranian stores quote prices. */
export function formatPriceWithToman(amount: number, currency: string): string {
  if (currency.toUpperCase() !== "IRR") return formatAmount(amount, currency);

  return `${formatAmount(amount, "IRR")} (${formatAmount(Math.round(amount / 10), "TMN")})`;
}
