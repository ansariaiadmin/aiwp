/**
 * The factory's module catalogue, as the model sees it.
 *
 * This mirrors the module.json file in each directory under modules/. It is
 * duplicated here rather than read at runtime because the platform ships as
 * a standalone Next.js bundle and must not reach outside its own directory
 * to answer a request.
 *
 * `tools/tests/run-tests.php` asserts the generated plugin only ever uses ids
 * from this list, so a module added to the factory without being listed here
 * shows up as a test failure rather than as a model that keeps choosing a
 * module the composer then rejects.
 */

export interface CatalogueModule {
  id: string;
  summary: string;
  /** Modules this one needs; the composer resolves them automatically. */
  requires: string[];
}

export const MODULE_CATALOGUE: readonly CatalogueModule[] = [
  {
    id: "settings-page",
    summary:
      "Adds a Settings screen under Settings, with tabbed fields generated from the spec's options, plus a Settings link on the Plugins list and a guarded reset action.",
    requires: [],
  },
  {
    id: "scheduler",
    summary:
      "Unified async and recurring job scheduling. Uses Action Scheduler when available (bundled with WooCommerce) and falls back to WP-Cron.",
    requires: [],
  },
  {
    id: "db-table",
    summary:
      "Registers one custom dbDelta-managed table with a small typed repository (insert/update/delete/find).",
    requires: [],
  },
  {
    id: "rest-api",
    summary:
      "Registers a namespaced REST route group with a mandatory permission_callback and input validation.",
    requires: [],
  },
  {
    id: "email-notify",
    summary:
      "wp_mail() wrapper with an HTML template, per-notification filters, and safe default headers and From handling.",
    requires: [],
  },
  {
    id: "csv-export",
    summary:
      "Streams arrays or generators to CSV, either as a nonce-guarded admin-post download or to a file.",
    requires: [],
  },
  {
    id: "cron-report",
    summary:
      "Schedules a recurring report job and emails it. Needs the scheduler and email-notify modules.",
    requires: ["scheduler"],
  },
  {
    id: "blocks-compat",
    summary:
      "Helpers for integrating with the WooCommerce Cart & Checkout Blocks (Store API extensions, HPOS-safe queries).",
    requires: [],
  },
  {
    id: "sms-gateway",
    summary:
      "Driver-based SMS sending with Kavenegar and MeliPayamak drivers. Keys are read from the platform's encrypted settings.",
    requires: [],
  },
  {
    id: "license-client",
    summary:
      "Talks to the license server: activate/validate/deactivate a key, and injects private plugin updates. Always include this for a paid plugin.",
    requires: ["scheduler"],
  },
] as const;

export const MODULE_IDS: readonly string[] = MODULE_CATALOGUE.map((m) => m.id);

/** Rendered into the system prompt so the model picks real modules only. */
export function catalogueForPrompt(): string {
  return MODULE_CATALOGUE.map((m) => {
    const needs = m.requires.length > 0 ? ` (requires: ${m.requires.join(", ")})` : "";
    return `- ${m.id}${needs}: ${m.summary}`;
  }).join("\n");
}
