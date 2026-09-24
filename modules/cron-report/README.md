# cron-report

Schedules a recurring "generate + deliver a report" job. Requires the
`scheduler` module (declared in `module.json#requires`, resolved
automatically by `tools/compose.php`). Optionally integrates with
`email-notify` (to email the report) and `csv-export` (to snapshot rows to
a CSV file in `wp-content/uploads`) if those modules are also present in
the spec — neither is a hard dependency.

## What it does

1. On `boot()`, schedules `{{PREFIX}}_run_report` to fire every
   `{{PREFIX}}_report_interval` seconds (default: `DAY_IN_SECONDS`) via the
   `scheduler` module.
2. When the hook fires, it collects data from the `{{PREFIX}}_report_data`
   filter (this is where a spec's `features` glue code plugs in real
   WooCommerce metrics via `wc_get_orders()`).
3. If `email-notify` is present and `report_email` is set and valid, emails
   an HTML summary.
4. If `csv-export` is present and the data includes a `rows` array, writes
   a CSV snapshot to `wp-content/uploads/{{SLUG}}-report-<date>.csv`.
5. Always fires `{{PREFIX}}_report_ready` with the full data payload so
   glue code can do anything else (e.g. push to Slack).
6. Unschedules itself on `{{PREFIX}}_deactivate`.

## Options

| Key            | Type  | Default | Notes                                 |
|----------------|-------|---------|-----------------------------------------|
| `report_email` | email | `''`    | Recipient; report is not emailed if empty/invalid |

## Hooks

- Action `{{PREFIX}}_run_report` — the scheduled hook itself.
- Action `{{PREFIX}}_report_ready($data)` — fires after generation.
- Filter `{{PREFIX}}_report_data($data)` — build the actual report payload.
- Filter `{{PREFIX}}_report_interval($seconds)` — change the cadence.

## Example usage

```json
{
  "modules": ["scheduler", "cron-report", "email-notify", "csv-export"],
  "options": [
    { "key": "report_email", "type": "email", "default": "" }
  ]
}
```

```php
add_filter('{{PREFIX}}_report_data', function (array $data): array {
    $orders = wc_get_orders(['status' => 'completed', 'date_created' => '>' . (time() - DAY_IN_SECONDS)]);

    $data['orders_today'] = count($orders);
    $data['revenue_today'] = array_sum(array_map(static fn ($o) => (float) $o->get_total(), $orders));
    $data['rows'] = array_map(static fn ($o) => ['id' => $o->get_id(), 'total' => $o->get_total()], $orders);

    return $data;
});
```
