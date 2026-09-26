<?php
/**
 * Plugin Name:       Store Health Assistant
 * Plugin URI:        https://ansariai.ir
 * Description:       Daily WooCommerce store health digest with configurable alert thresholds.
 * Version:           1.0.0
 * Requires at least: 6.8
 * Requires PHP:      8.1
 * Author:            Mohammad Ansari
 * Author URI:        https://ansariai.ir
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       store-health
 * Domain Path:       /languages
 * Requires Plugins:  woocommerce
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

// This file has no logic beyond bootstrapping: every module and every piece
// of behaviour lives under src/. Keep it that way when hand-editing.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ANSARIAI_SH_VERSION', '1.0.0' );
define( 'ANSARIAI_SH_FILE', __FILE__ );
define( 'ANSARIAI_SH_DIR', plugin_dir_path( __FILE__ ) );
define( 'ANSARIAI_SH_URL', plugin_dir_url( __FILE__ ) );
define( 'ANSARIAI_SH_BASENAME', plugin_basename( __FILE__ ) );

require ANSARIAI_SH_DIR . 'src/autoload.php';

register_activation_hook( __FILE__, array( 'AnsariAi\StoreHealth\Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'AnsariAi\StoreHealth\Activator', 'deactivate' ) );

/**
 * Single bootstrap entry point. All plugin logic starts here.
 *
 * The function itself is named after the plugin prefix (ansariai_sh_boot is the
 * scaffold's own placeholder name; tools/compose.php renames both the
 * declaration and the add_action() callback string together) to avoid any
 * chance of colliding with another active plugin.
 */
function ansariai_sh_boot(): \AnsariAi\StoreHealth\Plugin {
	return \AnsariAi\StoreHealth\Plugin::instance();
}

add_action( 'plugins_loaded', 'ansariai_sh_boot' );
