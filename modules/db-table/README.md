# db-table

A single dbDelta-managed custom table (`{$wpdb->prefix}{{PREFIX}}_records`)
with a small typed repository, for plugin-owned data that has nothing to do
with WooCommerce orders/customers (which must always go through
`wc_get_orders()` / `WC_Order`, never a custom table or raw SQL).

## What it does

- Contributes a `CREATE TABLE` statement to `{{PREFIX}}_db_schema`, run by
  the core `Installer` scaffold on activation/upgrade via `dbDelta()`.
- Contributes its table name to `{{PREFIX}}_db_tables` so `Activator::uninstall()`
  can drop it when the site owner opts into "Remove data on uninstall".
- Exposes `DbTable::insert()`, `DbTable::find()`, `DbTable::paginate()`,
  `DbTable::delete()` — every query uses `$wpdb->prepare()`.

## Schema

```
id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
record_type  VARCHAR(64)     -- free-form discriminator, e.g. 'report-snapshot'
payload      LONGTEXT        -- JSON-encoded arbitrary data
created_at   DATETIME
```

## Options

None (this module only manages a table, not `wp_options`).

## Example usage

```json
{
  "modules": ["db-table"]
}
```

```php
use {{NAMESPACE}}\Modules\DbTable\DbTable;

$id = DbTable::insert('report-snapshot', ['orders' => 12, 'revenue' => 450.0]);

$row = DbTable::find($id);
$recent = DbTable::paginate('report-snapshot', 20, 1);
```
