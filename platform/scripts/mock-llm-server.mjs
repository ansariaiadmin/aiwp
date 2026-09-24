/**
 * DEV/TEST ONLY: a minimal OpenAI-compatible chat-completions server.
 *
 * Used to exercise the platform's AI layer end to end without an API key or
 * network access — the platform is pointed at this via the "custom" provider,
 * exactly as it would be pointed at a self-hosted Qwen endpoint.
 *
 * It returns a canned plugin spec so the whole chain (settings -> provider
 * resolution -> routing -> request -> response parsing -> zod validation ->
 * API response) is covered.
 *
 *   node scripts/mock-llm-server.mjs [port]
 */
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 4100);

const SPEC = {
  slug: "invoice-nagger",
  name: "Invoice Nagger",
  description: "Reminds customers about unpaid WooCommerce orders on a schedule.",
  namespace: "AnsariAi\\InvoiceNagger",
  prefix: "ansariai_in",
  textDomain: "invoice-nagger",
  version: "1.0.0",
  modules: ["settings-page", "scheduler", "email-notify", "license-client"],
  options: [
    { key: "reminder_email", type: "email", label: "گیرنده‌ی گزارش", default: "", tab: "general" },
    { key: "days_before_reminder", type: "number", label: "روزهای قبل از یادآوری", default: 3, tab: "general" },
    { key: "enable_nagging", type: "checkbox", label: "یادآوری فعال باشد", default: true, tab: "general" },
  ],
  features: [
    "Every day, find unpaid orders older than the configured threshold and email the configured recipient a summary.",
    "Expose a read-only REST endpoint listing the orders currently awaiting payment.",
  ],
};

const requests = [];

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const auth = req.headers.authorization ?? "";

    if (req.url === "/__requests") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(requests));
      return;
    }

    requests.push({ url: req.url, method: req.method, auth, body: body ? JSON.parse(body) : null });

    // Simulate an auth failure so the error-mapping path can be tested too.
    if (auth === "Bearer bad-key") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Incorrect API key provided" } }));
      return;
    }

    if (auth === "Bearer flaky-key" && requests.length % 2 === 1) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "temporarily unavailable" } }));
      return;
    }

    const parsed = body ? JSON.parse(body) : {};
    const wantsJson = parsed.response_format?.type === "json_object";

    // Deliberately wrap the JSON in a markdown fence to prove the parser
    // tolerates what models actually do.
    const content = wantsJson ? "```json\n" + JSON.stringify(SPEC) + "\n```" : "plain text reply";

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: "chatcmpl-mock",
        model: parsed.model ?? "mock-model",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 120, completion_tokens: 90, total_tokens: 210 },
      }),
    );
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock LLM server listening on http://127.0.0.1:${PORT}/v1/chat/completions`);
});
