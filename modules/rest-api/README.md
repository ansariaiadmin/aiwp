# rest-api

Registers the `{{SLUG}}/v1` REST namespace and enforces that every route —
including ones added by other modules or glue code — has a
`permission_callback`.

## What it does

- Registers `GET /wp-json/{{SLUG}}/v1/status`, gated by `manage_options`, as
  a working example / health check.
- Exposes the `{{PREFIX}}_rest_routes` filter: any code that wants to add a
  route pushes `['route' => '/summary', 'args' => [...]]` onto the array
  instead of calling `register_rest_route()` directly. Routes without a
  `permission_callback` are **skipped** (never silently public) and logged.

## Options

None.

## Hooks

- Filter `{{PREFIX}}_rest_routes` — array of `{route, args}` route
  definitions to register under the `{{SLUG}}/v1` namespace.

## Example usage

```json
{
  "modules": ["rest-api"]
}
```

Adding a route from a glue class:

```php
add_filter('{{PREFIX}}_rest_routes', function (array $routes): array {
    $routes[] = [
        'route' => '/summary',
        'args' => [
            'methods' => 'GET',
            'callback' => static function (\WP_REST_Request $request) {
                return new \WP_REST_Response(['orders_today' => 12]);
            },
            'permission_callback' => static function () {
                return current_user_can('manage_woocommerce');
            },
        ],
    ];

    return $routes;
});
```
