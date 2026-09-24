# csv-export

CSV generation and a guarded download endpoint. Never writes a publicly
accessible file under `wp-content/uploads` by default — `write_to_file()`
is meant for paths inside a plugin-managed private directory, and the admin
download always streams through a nonce + capability guarded admin-post
action.

## What it does

- `admin-post.php?action={{PREFIX}}_export_csv` — guarded by
  `Guard::verify_write()` (nonce **and** `manage_options`) — streams the
  rows collected via the `{{PREFIX}}_csv_export_rows` filter as a CSV
  download.
- `CsvExport::to_csv_string($rows)` — builds a CSV in memory (e.g. for an
  email attachment).
- `CsvExport::write_to_file($path, $rows)` — streaming write for larger
  exports.

## Options

None.

## Hooks

- Registers `admin_post_{{PREFIX}}_export_csv`.
- Filter `{{PREFIX}}_csv_export_rows` — array of associative-array rows to
  export; the CSV header row is derived from the first row's keys.

## Example usage

```json
{
  "modules": ["csv-export"]
}
```

```php
add_filter('{{PREFIX}}_csv_export_rows', function (array $rows): array {
    return [
        ['order_id' => 101, 'total' => 42.5],
        ['order_id' => 102, 'total' => 17.0],
    ];
});
```

Link to the download, always nonce-wrapped:

```php
echo esc_url(
    wp_nonce_url(
        admin_url('admin-post.php?action={{PREFIX}}_export_csv'),
        '{{PREFIX}}_export_csv'
    )
);
```
