# sms-gateway

Driver-based SMS sending. Ships two drivers out of the box —
[Kavenegar](https://kavenegar.com/) and
[MeliPayamak](https://www.melipayamak.com/) — behind a common
`SmsDriverInterface`, selected by the `{{PREFIX}}_sms_driver` option.

## What it does

- `SmsGateway::send($to, $message)` resolves the configured driver and
  delegates to it. Never throws: failures are logged (with the API key
  redacted by the core `Logger`) and `send()` returns `false`.
- `Drivers/AbstractHttpDriver` centralizes outbound HTTP via
  `wp_remote_post()` (never raw `curl`), so every driver respects
  WordPress's HTTP API filters, proxies and timeouts.

## Options

| Key            | Type   | Default      | Notes                                              |
|----------------|--------|--------------|-----------------------------------------------------|
| `sms_driver`   | string | `kavenegar`  | `kavenegar` or `melipayamak`                        |
| `sms_api_key`  | string | `''`         | Kavenegar API key, or MeliPayamak username token     |
| `sms_sender`   | string | `''`         | Kavenegar sender line, or MeliPayamak password+from  |

These are rendered on the plugin's settings screen by the core `Settings`
scaffold (add them to the spec's `options` array with `"type": "password"`
for `sms_api_key` so it is never shown in plaintext in the browser). They
are stored in `wp_options`, never hardcoded, never logged in plaintext.

## Hooks

- Filter `{{PREFIX}}_sms_driver` — map of driver id => factory closure, to
  register additional gateways.
- Action `{{PREFIX}}_sms_before_send` — fires before every send, useful for
  rate limiting or audit logging in glue code.

## Example usage

```json
{
  "modules": ["sms-gateway"],
  "options": [
    { "key": "sms_driver", "type": "select", "choices": ["kavenegar", "melipayamak"], "default": "kavenegar" },
    { "key": "sms_api_key", "type": "password", "default": "" },
    { "key": "sms_sender", "type": "text", "default": "" }
  ]
}
```

```php
$sms = \{{NAMESPACE}}\Plugin::instance()->module('sms-gateway');
$sms->send('+989120000000', 'Your order has shipped.');
```
