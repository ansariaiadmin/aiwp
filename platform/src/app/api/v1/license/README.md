# `/api/v1/license/*` — the versioned public license API

These routes are the **contract shipped inside every generated plugin**.
`modules/license-client/src/LicenseClient.php` builds its request URL as:

```
{LICENSE_SERVER}/license/{action}
```

and the plugin spec sets `LICENSE_SERVER` to `https://<host>/api/v1`
(see `spec/examples/store-health.json` → `license.server`).

A plugin that is already installed on a customer's WordPress cannot be
re-pointed at a new URL, so this path is **frozen**. Do not rename or move
it. If the request/response shape ever has to change, add `/api/v2/...`
and keep v1 serving the old shape.

The unversioned `/api/license/*` routes remain as an alias for hand-written
integrations and direct testing.
