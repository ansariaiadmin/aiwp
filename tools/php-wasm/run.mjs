/**
 * Runs a PHP script through a WebAssembly PHP build.
 *
 * Why this exists: the factory in tools/*.php is the heart of this repo, but
 * a native `php` binary is not always installable (locked-down CI images,
 * sandboxes without access to distro package repos). This runner executes
 * the exact same PHP files against the host filesystem so they can still be
 * validated and tested.
 *
 * It is a *verification* tool. On a normal dev machine — and in the shipped
 * installer — use the real `php` binary; it is faster and it is what the
 * production build path uses. See docs/DEVELOPMENT.md.
 *
 * Usage:
 *   node tools/php-wasm/run.mjs <script.php> [args...]
 */
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PHP, setPhpIniEntries } from "@php-wasm/universal";
import { loadNodeRuntime, useHostFilesystem } from "@php-wasm/node";

const PHP_VERSION = process.env.PHP_WASM_VERSION ?? "8.3";

const scriptArg = process.argv[2];
if (!scriptArg) {
  console.error("usage: node run.mjs <script.php> [args...]");
  process.exit(2);
}

// PHP sees the host filesystem mounted at the same absolute paths, so we
// pass argv through untouched and chdir to the script's directory the way
// the `php` CLI does not — but tools/*.php resolve paths relative to
// __DIR__, so cwd only affects relative argument paths. Resolve those
// against the *caller's* cwd to match native behaviour.
const callerCwd = process.cwd();
const scriptPath = resolve(callerCwd, scriptArg);

// Only arguments that actually name an existing path are resolved. Resolving
// every argument turned values like a license key into absolute paths.
const args = process.argv.slice(3).map((a) => {
  if (a.startsWith("-") || a.includes("=")) return a;
  try {
    const resolved = resolve(callerCwd, a);
    return existsSync(resolved) ? resolved : a;
  } catch {
    return a;
  }
});

const php = new PHP(
  await loadNodeRuntime(PHP_VERSION, {
    // Required: without it the Emscripten runtime throws
    // "PHPLoader.processId must be set before init".
    emscriptenOptions: { processId: process.pid },
  }),
);

useHostFilesystem(php);

// Process spawning cannot work inside WASM, and the failure mode is a raw JS
// exception thrown out of the WASM module — not a PHP Throwable — so no
// amount of try/catch in PHP can recover from it. Disabling the functions
// through php.ini instead means function_exists() reports them absent and
// callers take their own documented fallback path (tools/build.php falls
// back to a token_get_all()-based syntax check).
await setPhpIniEntries(php, {
  disable_functions: "shell_exec,exec,passthru,system,popen,proc_open",
});

const code = `<?php
// The php-cli SAPI defines these; the WebAssembly SAPI does not, and
// tools/*.php writes diagnostics to STDERR.
if (!defined('STDOUT')) { define('STDOUT', fopen('php://stdout', 'w')); }
if (!defined('STDERR')) { define('STDERR', fopen('php://stderr', 'w')); }
if (!defined('STDIN'))  { define('STDIN',  fopen('php://stdin', 'r')); }

// tools/build.php runs PHP_CodeSniffer in-process. phpcs has exactly one
// shell_exec() call site with no function_exists() guard —
// Util\\Common::isStdinATTY() at src/Util/Common.php:220 — and with the
// process-spawning functions disabled above that becomes a fatal
// "Call to undefined function PHP_CodeSniffer\\Util\\shell_exec()", which
// fails the lint step of every build.
//
// PHP resolves an unqualified function call inside a namespace to that
// namespace first and only then to the global scope, so defining the
// namespaced name routes phpcs down its own documented non-TTY path and the
// full lint still runs. Guarded by function_exists(), so on a host where
// shell_exec() is available (the production path) this defines nothing and
// behaviour is unchanged.
if (!function_exists('shell_exec')) {
  eval('namespace PHP_CodeSniffer\\Util { function shell_exec($cmd) { return false; } }');
}

// The factory scripts guard their CLI entry point with a
// realpath(argv[0]) === __FILE__ check, so both the superglobal and the
// ordinary globals must be populated the way the php-cli SAPI does it.
$GLOBALS['argv'] = $_SERVER['argv'] = ${JSON.stringify([scriptPath, ...args])};
$GLOBALS['argc'] = $_SERVER['argc'] = ${1 + args.length};
$argv = $GLOBALS['argv'];
$argc = $GLOBALS['argc'];
chdir(${JSON.stringify(dirname(scriptPath))});
try {
  include ${JSON.stringify(scriptPath)};
} catch (Throwable $e) {
  fwrite(STDERR, "Uncaught " . get_class($e) . ": " . $e->getMessage() . "\\n  at " . $e->getFile() . ":" . $e->getLine() . "\\n");
  exit(255);
}
`;

const out = await php.runStream({ code, requestHandler: undefined });

const stdout = await out.stdoutText;
const stderr = await out.stderrText;

if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

// PHP's exit code is not surfaced by runStream(); detect the common
// conventions the factory scripts use (non-zero exit on failure) from the
// text they print. tools/*.php print an explicit error marker.
const failed = /ERROR|FAIL|Exception|Fatal error/i.test(stderr);
const exitCode = await out.exitCode;
php.exit();
process.exit(typeof exitCode === "number" ? exitCode : failed ? 1 : 0);
