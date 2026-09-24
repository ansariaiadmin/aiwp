# blocks-compat

WooCommerce Cart & Checkout Blocks integration point. Complements the
core scaffold, which already declares `custom_order_tables` (HPOS) and
`cart_checkout_blocks` feature compatibility on `before_woocommerce_init`
for every generated plugin regardless of which modules are selected.

## What it does

- Skips itself entirely (via `requirements()`) when WooCommerce is not
  active.
- Hooks `woocommerce_blocks_loaded` and fires
  `{{PREFIX}}_register_blocks_integration`, the single place glue code
  should call `woocommerce_store_api_register_endpoint_data()` or register
  a `Automattic\WooCommerce\StoreApi\Schemas\ExtendSchema` field — never by
  hooking legacy shortcode-checkout actions, which the block-based
  checkout does not fire.

## Options

None.

## Hooks

- Listens to `woocommerce_blocks_loaded`.
- Fires `{{PREFIX}}_register_blocks_integration`.

## Example usage

```json
{
  "modules": ["blocks-compat"]
}
```

```php
add_action('{{PREFIX}}_register_blocks_integration', function () {
    woocommerce_store_api_register_endpoint_data([
        'endpoint' => \Automattic\WooCommerce\StoreApi\Schemas\V1\CheckoutSchema::IDENTIFIER,
        'namespace' => '{{PREFIX}}',
        'schema_callback' => static fn () => ['gift_note' => ['type' => 'string']],
    ]);
});
```
