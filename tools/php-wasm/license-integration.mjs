/**
 * End-to-end contract test between a generated plugin and a live platform.
 *
 * The WebAssembly PHP build cannot open outbound sockets, so this harness
 * bridges the two halves:
 *
 *   1. Run the composed plugin's LicenseClient in "record" mode. Its real
 *      wp_remote_post() calls are captured instead of sent.
 *   2. Perform those exact requests against a live platform. The origin is
 *      swapped for the test server; the PATH is left untouched, because the
 *      path is the contract under test (the host is deployment config the
 *      buyer sets in the plugin spec).
 *   3. Re-run the plugin in "replay" mode, handing back the real responses,
 *      so the plugin's own response-parsing code executes on real data.
 *
 * Usage:
 *   node tools/php-wasm/license-integration.mjs <build-dir> <license-key> [platform-url]
 *
 * Defaults to http://127.0.0.1:3000.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const runner = join(here, "run.mjs");
const testScript = join(repoRoot, "tools/tests/license-integration.php");

const buildDir = process.argv[2];
const licenseKey = process.argv[3];
const platformUrl = (process.argv[4] ?? process.env.AIWP_PLATFORM_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");

if (!buildDir || !licenseKey) {
  console.error("usage: node license-integration.mjs <build-dir> <license-key> [platform-url]");
  process.exit(2);
}

const resolvedBuild = resolve(process.cwd(), buildDir);
const workDir = mkdtempSync(join(tmpdir(), "aiwp-license-it-"));

function runPhp(mode, responsesFile) {
  const env = {
    ...process.env,
    AIWP_WP_FIXTURE: mode,
    AIWP_WP_SITE_URL: "https://customer-shop.test",
  };
  if (responsesFile) env.AIWP_WP_RESPONSES = responsesFile;

  const out = execFileSync(
    process.execPath,
    [runner, testScript, resolvedBuild, licenseKey],
    { env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );

  try {
    return JSON.parse(out);
  } catch {
    throw new Error(`PHP did not return JSON (mode=${mode}):\n${out.slice(0, 800)}`);
  }
}

let failures = 0;
const report = (ok, name, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}${detail && !ok ? `\n      ${detail}` : ""}`);
};

console.log(`\nPlugin      ${resolvedBuild}`);
console.log(`Platform    ${platformUrl}`);
console.log(`License key ${licenseKey}\n`);

// ---------------------------------------------------------------------------
console.log("1. Plugin builds its license requests (record mode)");
// ---------------------------------------------------------------------------
const recorded = runPhp("record");

for (const a of recorded.assertions) {
  report(a.ok, a.name, a.detail);
}

console.log(`\n  captured ${recorded.requests.length} request(s):`);
for (const r of recorded.requests) {
  console.log(`    POST ${r.url}`);
}

report(recorded.requests.length >= 4, "plugin issued at least the 4 core license calls", `got ${recorded.requests.length}`);

// The path contract: every request must land under /api/v1/license/.
const badPaths = recorded.requests.filter((r) => !/\/api\/v1\/license\/[a-z-]+$/.test(r.url));
report(
  badPaths.length === 0,
  "every request targets /api/v1/license/{action}",
  badPaths.map((r) => r.url).join(", "),
);

const badBodies = recorded.requests.filter(
  (r) => !r.body?.license_key || !r.body?.product_id || !r.body?.site_url,
);
report(
  badBodies.length === 0,
  "every request carries license_key, product_id and site_url",
  badBodies.map((r) => JSON.stringify(r.body)).join(", "),
);

// ---------------------------------------------------------------------------
console.log("\n2. Performing those requests against the live platform");
// ---------------------------------------------------------------------------
const responses = [];

for (const r of recorded.requests) {
  // Swap the origin, keep the path: the host is deployment config, the path
  // is the contract.
  const path = new URL(r.url).pathname + new URL(r.url).search;
  const target = platformUrl + path;

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // A real customer site, not the platform's own origin.
        Origin: "https://customer-shop.test",
      },
      body: new URLSearchParams(
        Object.fromEntries(Object.entries(r.body).map(([k, v]) => [k, String(v)])),
      ),
    });

    const text = await res.text();
    responses.push({ status: res.status, body: text });
    console.log(`    ${res.status}  ${path}  ${text.slice(0, 90)}`);
  } catch (e) {
    responses.push({ error: String(e.message ?? e) });
    console.log(`    ERR  ${path}  ${e.message}`);
  }
}

const okCount = responses.filter((r) => r.status === 200).length;
report(okCount === responses.length, `platform answered 200 to all ${responses.length}`, `${okCount} ok`);

// ---------------------------------------------------------------------------
console.log("\n3. Plugin parses the real responses (replay mode)");
// ---------------------------------------------------------------------------
const responsesFile = join(workDir, "responses.json");
writeFileSync(responsesFile, JSON.stringify(responses));

const replayed = runPhp("replay", responsesFile);

for (const a of replayed.assertions) {
  report(a.ok, a.name, a.detail);
}

const replayFailed = replayed.assertions.filter((a) => !a.ok);
report(
  replayFailed.length === 0,
  "plugin accepted the platform's real responses",
  replayFailed.map((a) => `${a.name}: ${a.detail}`).join("; "),
);

rmSync(workDir, { recursive: true, force: true });

const colour = failures === 0 ? "\x1b[32m" : "\x1b[31m";
console.log(`\n${colour}${failures === 0 ? "PASS" : `${failures} FAILURE(S)`}\x1b[0m\n`);
process.exit(failures === 0 ? 0 : 1);
