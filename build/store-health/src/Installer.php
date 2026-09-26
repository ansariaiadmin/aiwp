<?php
/**
 * dbDelta-based schema migrations, driven by a "migrations" list that
 * modules contribute to via the 'ansariai_sh_db_schema' filter.
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

namespace AnsariAi\StoreHealth;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Installer {

	public const SCHEMA_VERSION_OPTION  = 'ansariai_sh_schema_version';
	public const CURRENT_SCHEMA_VERSION = '1.0.0';

	/**
	 * Runs every activation and, defensively, on 'plugins_loaded' when the
	 * stored schema version is behind CURRENT_SCHEMA_VERSION (handles the
	 * case where a site owner updates the plugin files without an explicit
	 * deactivate/activate cycle).
	 */
	public static function migrate(): void {
		$installed_version = get_option( self::SCHEMA_VERSION_OPTION, '' );

		if ( self::CURRENT_SCHEMA_VERSION === $installed_version ) {
			return;
		}

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		foreach ( self::schema() as $create_sql ) {
			dbDelta( $create_sql );
		}

		update_option( self::SCHEMA_VERSION_OPTION, self::CURRENT_SCHEMA_VERSION );

		do_action( 'ansariai_sh_after_migrate', $installed_version, self::CURRENT_SCHEMA_VERSION );
	}

	public static function maybe_migrate(): void {
		if ( get_option( self::SCHEMA_VERSION_OPTION, '' ) !== self::CURRENT_SCHEMA_VERSION ) {
			self::migrate();
		}
	}

	/**
	 * Collects dbDelta-formatted CREATE TABLE statements from every module
	 * that needs its own table (e.g. db-table module) via a filter, so the
	 * scaffold never hardcodes a module's schema.
	 *
	 * @return string[]
	 */
	private static function schema(): array {
		/**
		 * Filters the list of dbDelta CREATE TABLE statements to run on
		 * install/upgrade. Each statement MUST follow the dbDelta
		 * formatting rules (https://developer.wordpress.org/reference/functions/dbdelta/).
		 *
		 * @param string[] $statements
		 */
		return (array) apply_filters( 'ansariai_sh_db_schema', array() );
	}

	/**
	 * Drops every table this plugin created, only ever called from
	 * Activator::uninstall() when the site owner opted in.
	 */
	public static function drop_tables(): void {
		global $wpdb;

		/**
		 * Filters the list of fully-qualified table names (with $wpdb->prefix
		 * already applied) to drop on uninstall.
		 *
		 * @param string[] $tables
		 */
		$tables = (array) apply_filters( 'ansariai_sh_db_tables', array() );

		foreach ( $tables as $table ) {
			$table = preg_replace( '/[^a-zA-Z0-9_]/', '', (string) $table );

			if ( '' === $table ) {
				continue;
			}

			// Table identifiers cannot be parameterised via $wpdb->prepare();
			// the name is validated above and always built from
			// $wpdb->prefix + a hardcoded module-defined suffix, never from
			// user input.
			$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
		}
	}
}
