<?php
/**
 * Plugin Name:       Site Guardian
 * Plugin URI:        https://ansariai.ir
 * Description:       Real-time site health scoring, backup freshness alerts, scheduled email digests and a REST status API - zero configuration needed.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            Mohammad Ansari
 * Author URI:        https://ansariai.ir
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       site-guardian
 * Domain Path:       /languages
 *
 * @package AnsariAi\SiteGuardian
 */

declare(strict_types=1);

// This file has no logic beyond bootstrapping: every module and every piece
// of behaviour lives under src/. Keep it that way when hand-editing.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SGUARD_VERSION', '1.0.0' );
define( 'SGUARD_FILE', __FILE__ );
define( 'SGUARD_DIR', plugin_dir_path( __FILE__ ) );
define( 'SGUARD_URL', plugin_dir_url( __FILE__ ) );
define( 'SGUARD_BASENAME', plugin_basename( __FILE__ ) );

require SGUARD_DIR . 'src/autoload.php';

register_activation_hook( __FILE__, array( 'AnsariAi\SiteGuardian\Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'AnsariAi\SiteGuardian\Activator', 'deactivate' ) );

/**
 * Single bootstrap entry point. All plugin logic starts here.
 *
 * The function itself is named after the plugin prefix (sguard_boot is the
 * scaffold's own placeholder name; tools/compose.php renames both the
 * declaration and the add_action() callback string together) to avoid any
 * chance of colliding with another active plugin.
 */
function sguard_boot(): \AnsariAi\SiteGuardian\Plugin {
	return \AnsariAi\SiteGuardian\Plugin::instance();
}

add_action( 'plugins_loaded', 'sguard_boot' );
