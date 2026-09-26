import { describe, it, expect } from "vitest";
import { toFactorySpec, validateFactorySpec } from "@/lib/ai/factory-spec";
import type { DraftedSpec } from "@/lib/validation/ai";

const drafted: DraftedSpec = {
  slug: "invoice-nagger",
  name: "Invoice Nagger",
  description: "Nags customers about unpaid invoices.",
  namespace: "AnsariAi\\InvoiceNagger",
  prefix: "ansariai_in",
  textDomain: "invoice-nagger",
  version: "1.0.0",
  modules: ["settings-page", "email-notify", "scheduler", "cron-report", "license-client"],
  options: [{ key: "days", type: "number", label: "Days before nag", default: 3, tab: "general" }],
  features: ["Emails a reminder N days after an invoice goes unpaid."],
};

describe("toFactorySpec", () => {
  it("fills the operational fields the model must not guess", () => {
    const spec = toFactorySpec(drafted);

    expect(spec.author).toEqual({ name: "AnsariAi", uri: "https://ansariai.ir" });
    expect(spec.requires.php).toBe("8.1");
    expect(spec.license.enabled).toBe(true);
    expect(spec.license.productId).toBe("invoice-nagger");
  });

  it("preserves the model's creative choices exactly", () => {
    const spec = toFactorySpec(drafted);

    expect(spec.slug).toBe(drafted.slug);
    expect(spec.modules).toEqual(drafted.modules);
    expect(spec.options).toHaveLength(1);
    expect(spec.features).toEqual(drafted.features);
  });

  it("honours operator overrides, including a WooCommerce requirement", () => {
    const spec = toFactorySpec(drafted, {
      licenseServer: "https://shop.example/api/v1",
      requiresWoo: "9.0",
      authorName: "Acme",
    });

    expect(spec.license.server).toBe("https://shop.example/api/v1");
    expect(spec.requires.woo).toBe("9.0");
    expect(spec.author.name).toBe("Acme");
  });

  it("omits the woo requirement when none is configured", () => {
    const spec = toFactorySpec(drafted);
    expect(spec.requires).not.toHaveProperty("woo");
  });
});

describe("validateFactorySpec", () => {
  it("accepts a completed spec", () => {
    expect(validateFactorySpec(toFactorySpec(drafted))).toBeNull();
  });

  it("rejects an invented module before the factory ever sees it", () => {
    const spec = toFactorySpec({ ...drafted, modules: ["settings-page", "time-machine"] });
    expect(validateFactorySpec(spec)).toEqual({
      kind: "unknown-module",
      moduleId: "time-machine",
    });
  });

  it("rejects a missing required field", () => {
    const spec = toFactorySpec({ ...drafted, prefix: "" });
    expect(validateFactorySpec(spec)).toEqual({ kind: "missing-field", field: "prefix" });
  });

  it("rejects a malformed version", () => {
    const spec = toFactorySpec({ ...drafted, version: "1.0" });
    expect(validateFactorySpec(spec)?.kind).toBe("bad-version");
  });

  it("rejects an empty module list", () => {
    const spec = toFactorySpec({ ...drafted, modules: [] });
    expect(validateFactorySpec(spec)).toEqual({ kind: "missing-field", field: "modules" });
  });
});
