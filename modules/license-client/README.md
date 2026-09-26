# license-client

Talks to the **ansariai.ir** private license server: activate / validate /
deactivate a license key from wp-admin, and deliver plugin updates through
the standard `update_plugins` WordPress mechanism — pointed at the license
server, never at wordpress.org or a public GitHub repository/release page.

## What it does

- `admin-post.php?action={{PREFIX}}_activate_license` /
  `..._deactivate_license` — nonce + `manage_options` guarded actions that
  POST to `{license.server}/license/activate|deactivate|validate` with the
  site's `home_url()` and the spec's `productId`.
- A daily `{{PREFIX}}_license_check` job (via the `scheduler` module,
  declared as a hard `requires` in `module.json`) revalidates the stored
  key and updates `license_status`.
- Hooks `site_transient_update_plugins` and `plugins_api` so an active
  license makes WordPress show/download updates from the license server's
  own short-lived, license-scoped package URL — the plugin never links to
  GitHub or wordpress.org for updates.

## Options

| Key               | Type   | Default    | Notes                                    |
|-------------------|--------|------------|--------------------------------------------|
| `license_key`     | string | `''`       | Entered by the site owner                  |
| `license_status`  | string | `inactive` | `inactive` \| `active` \| `invalid`, managed by this module |

## Configuration (from the plugin spec, resolved at build time)

```json
{
  "license": {
    "enabled": true,
    "server": "https://ansariai.ir/api/v1",
    "productId": "store-health"
  }
}
```

`tools/compose.php` only includes this module's files in a build when
`license.enabled` is `true`, and resolves `{{LICENSE_SERVER}}` /
`{{LICENSE_PRODUCT_ID}}` placeholders from `license.server` /
`license.productId` (defaulting `productId` to the plugin `slug`).

## Hooks

- Action `{{PREFIX}}_license_activated($key)`
- Action `{{PREFIX}}_license_deactivated($key)`
- Action `{{PREFIX}}_license_check` — the daily revalidation job.

## Security notes

- The license key is never logged (the core `Logger` redacts any context
  key containing `license`).
- No secret is ever hardcoded: the server URL comes from the spec (public
  configuration, not a secret), and the key itself is entered by the site
  owner and stored in `wp_options`.
- All outbound calls use `wp_remote_post()` with a 15s timeout, never a
  blocking call with no timeout.
