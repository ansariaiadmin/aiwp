/**
 * The factory's quality bar, as an enforceable ruleset.
 *
 * "Get better every day" only means something against a fixed, strict bar.
 * This is that bar: the non-negotiable rules every generated WordPress
 * module must satisfy. It is deliberately stricter than "it works" — it is
 * the standard a plugin has to clear to be sold, not just to run.
 *
 * The ruleset is used two ways, and they must stay in sync:
 *
 *   1. `rulesForPrompt()` renders it into the generation system prompt, so
 *      the model writes to the bar instead of guessing at one.
 *   2. Each rule carries a `detect` hint — a signature of the *violation* —
 *      so a verifier can scan generated PHP and catch the common breaches
 *      mechanically rather than trusting the model to self-police.
 *
 * Severity is honest: `blocker` means the plugin must not ship; `major`
 * means it must be fixed before review; `minor` is a quality nit. A small
 * model will breach these; the point of the ruleset plus the lesson loop
 * (see lessons.ts) is that every breach becomes retrievable knowledge, so
 * the same breach stops recurring.
 */

export type RuleSeverity = "blocker" | "major" | "minor";

export interface QualityRule {
  id: string;
  /** The rule, stated as an imperative the model can follow. */
  rule: string;
  severity: RuleSeverity;
  /**
   * A signature of the violation, as a substring or regex source. Used by a
   * mechanical verifier; deliberately conservative — it flags the obvious
   * breach, and a human/model review catches the subtle ones.
   */
  detect?: string;
  /** Why the rule exists, in one line — models follow rules they understand. */
  why: string;
}

export const QUALITY_RULES: readonly QualityRule[] = [
  {
    id: "escape-output",
    rule: "Escape every value at the point of output: esc_html(), esc_attr(), esc_url(), or wp_kses() with an explicit allow-list. Never echo a variable raw.",
    severity: "blocker",
    detect: "echo $",
    why: "Unescaped output is a stored XSS hole the moment any field holds user data.",
  },
  {
    id: "sanitize-input",
    rule: "Sanitize every input on the way in: sanitize_text_field(), absint(), sanitize_email(), wp_unslash() then validate. Never trust $_POST/$_GET/$_REQUEST.",
    severity: "blocker",
    detect: "$_POST[",
    why: "Unsanitized input is how malformed or malicious data reaches the database.",
  },
  {
    id: "nonce-verify",
    rule: "Verify a nonce on every form submission, AJAX action and state-changing REST route with check_admin_referer() / wp_verify_nonce().",
    severity: "blocker",
    why: "Without a nonce, any logged-in user can be tricked into performing the action (CSRF).",
  },
  {
    id: "capability-check",
    rule: "Gate every privileged action behind current_user_can() with the correct capability. A REST route must have a permission_callback that is never just '__return_true'.",
    severity: "blocker",
    detect: "__return_true",
    why: "A missing capability check lets subscribers reach admin-only actions.",
  },
  {
    id: "prepared-sql",
    rule: "Use $wpdb->prepare() for every query that interpolates a variable. Never concatenate a variable into SQL.",
    severity: "blocker",
    why: "String-built SQL is an injection hole.",
  },
  {
    id: "i18n-strings",
    rule: "Wrap every user-facing string in a translation function (__(), esc_html_e(), etc.) with the plugin's text domain. No hardcoded display strings.",
    severity: "major",
    why: "An untranslated string breaks the plugin for every non-English site.",
  },
  {
    id: "prefix-globals",
    rule: "Prefix every option name, hook, global, function and transient with the plugin prefix. No generic names.",
    severity: "major",
    why: "Unprefixed globals collide with other plugins and corrupt shared state.",
  },
  {
    id: "hpos-orders",
    rule: "Never read or write the posts/postmeta tables for orders. Use wc_get_orders() / the Order object so the plugin is HPOS-compatible.",
    severity: "blocker",
    detect: "get_post_meta(",
    why: "Direct post-meta order access silently breaks under High-Performance Order Storage.",
  },
  {
    id: "no-eval",
    rule: "Never use eval(), create_function(), or unserialize() on data that is not fully trusted. Never execute a string as code.",
    severity: "blocker",
    detect: "eval(",
    why: "Dynamic code execution on untrusted input is remote code execution.",
  },
  {
    id: "enqueue-assets",
    rule: "Register and enqueue scripts/styles with wp_enqueue_script()/wp_enqueue_style() and a version. No inline <script> tags echoed into the page.",
    severity: "major",
    why: "Inline assets break caching, CSP and dependency ordering.",
  },
  {
    id: "direct-file-access",
    rule: "Guard every PHP file with `defined( 'ABSPATH' ) || exit;` at the top.",
    severity: "major",
    why: "Without the guard, a file can be requested directly and run outside WordPress.",
  },
  {
    id: "uninstall-cleanup",
    rule: "Remove every option, table and transient the plugin created on uninstall. Leave no residue behind.",
    severity: "minor",
    why: "Abandoned data accumulates and leaks the plugin's presence after removal.",
  },
  {
    id: "no-superglobals-raw",
    rule: "Never read $_SERVER['HTTP_*'] or other superglobals directly into logic without sanitizing; use the WordPress request API where possible.",
    severity: "major",
    why: "Raw superglobals are attacker-controlled and frequently unsanitized.",
  },
  {
    id: "no-extract",
    rule: "Never call extract() to expand an array into variables. Destructure explicitly or read keys directly.",
    severity: "blocker",
    detect: "extract(",
    why: "extract() turns attacker-controlled keys into variables — a silent variable-injection hole.",
  },
  {
    id: "no-variable-variables",
    rule: "Never use variable variables ($$var) or dynamic function names built from input.",
    severity: "blocker",
    detect: "$$",
    why: "Dynamic symbol names from input are code-injection vectors and defeat static review.",
  },
  {
    id: "strict-types",
    rule: "Declare strict_types=1 and a namespace at the top of every PHP file.",
    severity: "minor",
    why: "Strict types catch type-coercion bugs at the boundary instead of at runtime.",
  },
  {
    id: "reserved-table-names",
    rule: "Never name a custom table after a reserved $wpdb table (posts, options, terms, users, …). Always use $wpdb->prefix plus your own suffix.",
    severity: "major",
    why: "Colliding with a core table name corrupts WordPress itself.",
  },
  {
    id: "error-handling",
    rule: "Handle WP_Error returns from wp_remote_*(), wp_insert_*() and similar. Never assume success.",
    severity: "major",
    why: "An ignored WP_Error turns a recoverable failure into a fatal.",
  },
];

/** The rules that must never be breached for a plugin to ship. */
export const BLOCKER_RULES: readonly QualityRule[] = QUALITY_RULES.filter(
  (r) => r.severity === "blocker",
);

/**
 * Renders the ruleset into a system-prompt block.
 *
 * Ordered blockers-first so a model that truncates its attention still sees
 * the rules that matter most, and each rule carries its `why` — a model that
 * understands the reason follows the rule more reliably than one handed a
 * bare list.
 */
export function rulesForPrompt(): string {
  const order: Record<RuleSeverity, number> = { blocker: 0, major: 1, minor: 2 };
  return [...QUALITY_RULES]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .map((r) => `- [${r.severity.toUpperCase()}] ${r.rule} (because: ${r.why})`)
    .join("\n");
}

export interface RuleViolation {
  ruleId: string;
  severity: RuleSeverity;
  /** The line that tripped the detector, for the operator to see. */
  evidence: string;
}

/**
 * Mechanically scans generated PHP for the obvious breaches.
 *
 * This is intentionally a coarse first pass: it catches the violations with
 * a reliable textual signature (raw echo, eval, direct post-meta order
 * access, a __return_true permission callback) so they never reach review.
 * It is not a substitute for a full audit — the absence of a flag is not a
 * guarantee of safety, and the lesson loop exists precisely because this
 * catches only the obvious.
 */
export function scanForViolations(php: string): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const rule of QUALITY_RULES) {
    if (!rule.detect) continue;

    const lines = php.split("\n");
    for (const line of lines) {
      if (line.includes(rule.detect)) {
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          evidence: line.trim().slice(0, 160),
        });
        break; // one piece of evidence per rule is enough
      }
    }
  }

  return violations;
}
