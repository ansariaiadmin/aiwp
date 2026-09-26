# Backup Freshness Alert (`backup-alert`)

Never discover your backups stopped working *after* disaster strikes.

## What it does
- Reads the last-backup Unix timestamp from a configurable option
  (or via the `{{PREFIX}}_backup_last_timestamp` filter — e.g. map it to
  UpdraftPlus/BackWPup's own stored value).
- On a daily cron tick, compares age against `backup_max_age_days`.
- When stale: shows an admin notice, fires `{{PREFIX}}_backup_stale`,
  and emails the configured address — through the bundled `email-notify`
  module when present, falling back to plain `wp_mail()`.
- Throttles repeat emails with a transient so you get at most one alert
  per staleness window.

## Hooks
| Type | Name | Purpose |
|---|---|---|
| action | `{{PREFIX}}_check_backup_age` | Run the check now |
| action | `{{PREFIX}}_backup_stale` | Fired when stale (wire SMS here) |
| filter | `{{PREFIX}}_backup_last_timestamp` | Supply the timestamp from anywhere |
| filter | `{{PREFIX}}_backup_max_age_days` | Override the threshold |

## Options
- `backup_alert_email` (email)
- `backup_max_age_days` (number, default 7)
- `backup_time_option` (text — name of the option holding the timestamp)

## Example: SMS on stale backup
```php
add_action( 'sguard_backup_stale', function ( ?string $msg ): void {
    sguard()->module( 'sms-gateway' )->send( '0912...', 'Backup stale: ' . $msg );
} );
```
