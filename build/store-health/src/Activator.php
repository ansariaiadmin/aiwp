<?php
/**
 * Activation / deactivation / uninstall lifecycle.
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

namespace AnsariAi\StoreHealth;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Activator {

	/**
	 * Runs on register_activation_hook. Verifies minimum requirements,
	 * runs DB migrations, and flushes rewrite rules if the plugin
	 * registers any (modules may hook 'ansariai_sh_activate' to add their
	 * own one-time setup).
	 */
	public static function activate(): void {
		self::guard_requirements();

		Installer::migrate();

		update_option( 'ansariai_sh_activated_version', ANSARIAI_SH_VERSION );

		/**
		 * Fires after core activation steps (requirements check + DB
		 * migration) have completed. Modules that need one-time setup
		 * (e.g. scheduling a recurring event) should hook this instead of
		 * register_activation_hook directly, since module classes are not
		 * guaranteed to be loaded yet when WordPress fires that hook.
		 */
		do_action( 'ansariai_sh_activate' );

		flush_rewrite_rules();
	}

	/**
	 * Runs on register_deactivation_hook. Never deletes data — only
	 * unschedules recurring jobs. Data removal only happens in uninstall()
	 * and only when the site owner opted in.
	 */
	public static function deactivate(): void {
		/**
		 * Fires on deactivation so modules can clear scheduled events
		 * (Action Scheduler and/or wp-cron).
		 */
		do_action( 'ansariai_sh_deactivate' );

		flush_rewrite_rules();
	}

	/**
	 * Runs from uninstall.php (only when the user deletes the plugin from
	 * wp-admin). Removes options and, only if opted in via the
	 * 'ansariai_sh_remove_data_on_uninstall' option, custom DB tables.
	 */
	public static function uninstall(): void {
		$remove_data = (bool) get_option( 'ansariai_sh_remove_data_on_uninstall', false );

		do_action( 'ansariai_sh_uninstall', $remove_data );

		delete_option( 'ansariai_sh_activated_version' );
		delete_option( 'ansariai_sh_log' );
		delete_option( Installer::SCHEMA_VERSION_OPTION );

		if ( $remove_data ) {
			Installer::drop_tables();
		}
	}

	/**
	 * Hard-stop activation with a clear admin message when minimum PHP/WP
	 * requirements are not met. Uses deactivate_plugins() + wp_die() as
	 * WordPress core recommends, rather than letting a fatal error occur.
	 */
	private static function guard_requirements(): void {
		$errors = array();

		if ( version_compare( PHP_VERSION, '8.1', '<' ) ) {
			$errors[] = sprintf(
				/* translators: 1: required PHP version, 2: current PHP version. */
				__( 'Store Health Assistant requires PHP %1$s or higher. You are running PHP %2$s.', 'store-health' ),
				'8.1',
				PHP_VERSION
			);
		}

		global $wp_version;

		if ( isset( $wp_version ) && version_compare( $wp_version, '6.8', '<' ) ) {
			$errors[] = sprintf(
				/* translators: 1: required WordPress version, 2: current WordPress version. */
				__( 'Store Health Assistant requires WordPress %1$s or higher. You are running WordPress %2$s.', 'store-health' ),
				'6.8',
				$wp_version
			);
		}

		if ( array() === $errors ) {
			return;
		}

		if ( ! function_exists( 'deactivate_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		deactivate_plugins( ANSARIAI_SH_BASENAME );

		wp_die(
			esc_html( implode( ' ', $errors ) ),
			esc_html__( 'Plugin activation error', 'store-health' ),
			array( 'back_link' => true )
		);
	}
}
