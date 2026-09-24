# scheduler

Unified background job API. Other modules (`cron-report`, `email-notify`,
`license-client`) depend on this module for anything that shouldn't block a
web request.

## What it does

Provides `Scheduler::schedule_recurring()`, `Scheduler::schedule_async()`,
and `Scheduler::unschedule()`. Internally:

- If [Action Scheduler](https://actionscheduler.org/) functions
  (`as_schedule_recurring_action`, `as_enqueue_async_action`, ...) are
  loaded — which happens automatically whenever WooCommerce is active, or
  when any other active plugin bundles the library — jobs run through
  Action Scheduler's persistent, queryable, retry-capable queue.
- Otherwise it transparently falls back to `wp_schedule_event()` /
  `wp_schedule_single_event()` (wp-cron), so a generated plugin never has a
  hard dependency on WooCommerce just to run a daily job.

## Options

None.

## Hooks

- Filter `{{PREFIX}}_scheduler_backend` — return `'wp-cron'` to force the
  fallback backend even when Action Scheduler is available (useful in
  tests). Returning an empty string (default) auto-detects.
- Filter `cron_schedules` — adds a `{{PREFIX}}_five_minutes` interval for
  the wp-cron fallback path.

## Example usage

```json
{
  "modules": ["scheduler", "cron-report"]
}
```

From another module's `boot()`:

```php
$scheduler = \{{NAMESPACE}}\Plugin::instance()->module('scheduler');

$scheduler->schedule_recurring('{{PREFIX}}_run_report', DAY_IN_SECONDS);

add_action('{{PREFIX}}_run_report', function () {
    // ... generate and send the report.
});
```

On deactivation:

```php
add_action('{{PREFIX}}_deactivate', function () use ($scheduler) {
    $scheduler->unschedule('{{PREFIX}}_run_report');
});
```
