# Site Health Scanner (`health-scan`)

Real on-site health checks with a weighted 0–100 score — no external services.

## What it does
- Runs 7 dependency-free checks: PHP version, WordPress version, `WP_DEBUG`,
  uploads writability, database table count, WP-Cron presence, HTTPS.
- Computes a **weighted score (0–100)**; each check is `pass` / `warn` / `fail`.
- Caches the result in a non-autoloaded option; refreshes daily via WP-Cron.
- Exposes `GET /wp-json/<slug>/v1/health` (admins only).
- Renders an admin **dashboard widget** with per-check icons.

## Hooks
| Type | Name | Purpose |
|---|---|---|
| action | `{{PREFIX}}_run_health_scan` | Trigger a scan programmatically |
| action | `{{PREFIX}}_health_scored` | Fired after every scan with the full result |
| filter | `{{PREFIX}}_health_checks` | Add/remove/weight checks |
| filter | `{{PREFIX}}_health_score` | Adjust the final score |

## Options
- `scan_interval_hours` (number, default 24)

## Example: add a custom check
```php
add_filter( 'sguard_health_checks', function ( array $checks ): array {
    $checks[] = [
        'slug'    => 'my_gateway',
        'status'  => get_transient( 'gateway_ok' ) ? 'pass' : 'warn',
        'label'   => 'Payment gateway reachable',
        'message' => 'Last ping: ' . gmdate( 'Y-m-d H:i', (int) get_option( 'gateway_last_ping', 0 ) ),
        'weight'  => 15,
    ];
    return $checks;
} );
```
