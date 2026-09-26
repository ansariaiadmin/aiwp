/**
 * The bridge between the AI agent and the real factory.
 *
 * The factory (tools/compose.php) is spec-driven and template-based: it does
 * not ask a model to write PHP, it substitutes hand-written, linted module
 * templates from a complete spec. The agent's job is therefore not to write
 * code — it is to produce a spec the factory will accept.
 *
 * draft-spec produces the *creative* half (slug, name, modules, options,
 * features). It deliberately does not invent the *operational* half — author,
 * PHP/WP requirements, and especially the license block, which every sold
 * plugin must carry. Those are the operator's domain, not the model's, and
 * letting a model guess a license server would be how a plugin ships pointing
 * at the wrong endpoint.
 *
 * toFactorySpec() is the seam: it takes the drafted spec plus the operator's
 * operational defaults and produces a complete spec that satisfies
 * spec/plugin-spec.schema.json, so it can be handed straight to build.php.
 * validateFactorySpec() then checks it against the same required fields and
 * module-id contract the factory enforces, so a malformed spec is caught here
 * — with a clear message — rather than as a confusing failure deep inside the
 * PHP composer.
 */

import { MODULE_IDS } from "./module-catalogue";
import type { DraftedSpec } from "@/lib/validation/ai";

export interface FactoryAuthor {
  name: string;
  uri: string;
}

export interface FactoryRequires {
  php: string;
  wp: string;
  /** WooCommerce version, when the plugin needs it. Omitted otherwise. */
  woo?: string;
}

export interface FactoryLicense {
  enabled: boolean;
  server: string;
  productId: string;
}

export interface FactoryOption {
  key: string;
  type: "text" | "email" | "number" | "checkbox" | "textarea" | "select" | "password";
  label: string;
  default?: string | number | boolean;
  tab?: string;
}

export interface FactorySpec {
  slug: string;
  name: string;
  description: string;
  namespace: string;
  prefix: string;
  textDomain: string;
  version: string;
  author: FactoryAuthor;
  requires: FactoryRequires;
  license: FactoryLicense;
  modules: string[];
  options: FactoryOption[];
  features: string[];
}

/** The operational defaults an operator configures once, not per plugin. */
export interface FactoryDefaults {
  authorName?: string;
  authorUri?: string;
  requiresPhp?: string;
  requiresWp?: string;
  /** WooCommerce requirement; set when the plugin targets WooCommerce. */
  requiresWoo?: string;
  /**
   * The platform's own license API base. Every plugin this factory builds is
   * sold, so the license block is enabled by default and points here.
   */
  licenseServer?: string;
}

const DEFAULTS: Required<Pick<FactoryDefaults, "authorName" | "authorUri" | "requiresPhp" | "requiresWp" | "licenseServer">> = {
  authorName: "AnsariAi",
  authorUri: "https://ansariai.ir",
  requiresPhp: "8.1",
  requiresWp: "6.5",
  licenseServer: "https://ansariai.ir/api/v1",
};

/**
 * Completes a drafted spec into a factory-ready one.
 *
 * The model's creative choices are preserved exactly; only the operational
 * fields the model must not guess are filled from the operator's defaults.
 * The license product id defaults to the slug, which is the convention the
 * factory's own examples follow.
 */
export function toFactorySpec(
  drafted: DraftedSpec,
  defaults: FactoryDefaults = {},
): FactorySpec {
  const authorName = defaults.authorName ?? DEFAULTS.authorName;
  const authorUri = defaults.authorUri ?? DEFAULTS.authorUri;

  const requires: FactoryRequires = {
    php: defaults.requiresPhp ?? DEFAULTS.requiresPhp,
    wp: defaults.requiresWp ?? DEFAULTS.requiresWp,
  };
  if (defaults.requiresWoo) requires.woo = defaults.requiresWoo;

  return {
    slug: drafted.slug,
    name: drafted.name,
    description: drafted.description ?? "",
    namespace: drafted.namespace,
    prefix: drafted.prefix,
    textDomain: drafted.textDomain,
    version: drafted.version,
    author: { name: authorName, uri: authorUri },
    requires,
    license: {
      enabled: true,
      server: defaults.licenseServer ?? DEFAULTS.licenseServer,
      productId: drafted.slug,
    },
    modules: [...drafted.modules],
    options: (drafted.options ?? []).map((o) => ({
      key: o.key,
      type: o.type,
      label: o.label,
      ...(o.default !== undefined ? { default: o.default } : {}),
      ...(o.tab !== undefined ? { tab: o.tab } : {}),
    })),
    features: drafted.features ?? [],
  };
}

export type FactorySpecError =
  | { kind: "missing-field"; field: string }
  | { kind: "unknown-module"; moduleId: string }
  | { kind: "bad-version"; field: string; value: string };

/**
 * Validates a factory spec against the contract compose.php enforces.
 *
 * Mirrors spec/plugin-spec.schema.json's required fields and the module-id
 * rule, so the check here is the same one the factory would apply — catching
 * the problem before a PHP subprocess is ever spawned. Returns the first
 * error, or null when the spec is compose-ready.
 */
export function validateFactorySpec(spec: FactorySpec): FactorySpecError | null {
  const requiredStrings: Array<[keyof FactorySpec, string]> = [
    ["slug", "slug"],
    ["name", "name"],
    ["namespace", "namespace"],
    ["prefix", "prefix"],
    ["textDomain", "textDomain"],
    ["version", "version"],
  ];

  for (const [key, field] of requiredStrings) {
    const value = spec[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      return { kind: "missing-field", field };
    }
  }

  if (!Array.isArray(spec.modules) || spec.modules.length === 0) {
    return { kind: "missing-field", field: "modules" };
  }

  if (!/^\d+\.\d+\.\d+$/.test(spec.version)) {
    return { kind: "bad-version", field: "version", value: spec.version };
  }

  const allowed = new Set<string>(MODULE_IDS);
  for (const id of spec.modules) {
    if (!allowed.has(id)) {
      return { kind: "unknown-module", moduleId: id };
    }
  }

  return null;
}
