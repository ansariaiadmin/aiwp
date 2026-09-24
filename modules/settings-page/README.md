# settings-page

Small extras on top of the always-present `Settings` scaffold class:

- Adds a **Settings** quick link on the WordPress Plugins list screen.
- Adds a guarded **Reset settings** admin-post action
  (`admin-post.php?action={{PREFIX}}_reset_settings`) that deletes the
  plugin's settings option, requiring both a valid nonce
  (`{{PREFIX}}_reset_settings`) and the `manage_options` capability.

## What it does

The core `Settings` class (always present in every generated plugin,
regardless of modules selected) already renders the tabbed settings screen
from the spec's `options` array. This module only adds the surrounding
conveniences site owners expect: a shortcut link from the plugin list, and a
one-click way to reset all options back to their spec-defined defaults.

## Options

None. This module does not read or write any `wp_options` itself.

## Hooks

- Filters `plugin_action_links_{{PLUGIN_BASENAME}}` to prepend a Settings
  link.
- Registers `admin_post_{{PREFIX}}_reset_settings`.

## Example usage

```json
{
  "modules": ["settings-page"]
}
```

To link to the reset action from a custom admin screen, always wrap the URL
with a nonce:

```php
wp_nonce_url(
    admin_url('admin-post.php?action={{PREFIX}}_reset_settings'),
    '{{PREFIX}}_reset_settings'
);
```
