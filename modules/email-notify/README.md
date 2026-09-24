# email-notify

Thin, safe `wp_mail()` wrapper: validates the recipient, filters
subject/body/headers, forces `wp_kses_post()` on the final HTML body so a
filter can never inject a `<script>` tag, and logs failures without ever
including the message body (which may contain customer PII) in the log.

## What it does

`EmailNotify::send($to, $subject, $body_html, $context)`:

1. Rejects invalid `$to` addresses before calling `wp_mail()`.
2. Runs `$subject`/`$body_html` through filters so other modules (e.g.
   `cron-report`) or glue code can localize/brand the email without editing
   this module.
3. Sanitizes the final HTML with `wp_kses_post()`.
4. Sets `Content-Type: text/html` by default (overridable via filter).

`EmailNotify::wrap_template($title, $inner_html)` is an optional minimal
HTML shell for modules that don't need their own template file.

## Options

None.

## Hooks

- Filter `{{PREFIX}}_email_subject($subject, $context)`
- Filter `{{PREFIX}}_email_body($body_html, $context)`
- Filter `{{PREFIX}}_email_headers($headers)`
- Action `{{PREFIX}}_before_email_send($to, $subject)`

## Example usage

```json
{
  "modules": ["email-notify"]
}
```

```php
$email = \{{NAMESPACE}}\Plugin::instance()->module('email-notify');

$email->send(
    get_option('admin_email'),
    __('Daily store report', '{{TEXT_DOMAIN}}'),
    $email->wrap_template('Daily store report', '<p>12 orders, $450 revenue.</p>')
);
```
