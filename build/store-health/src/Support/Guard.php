<?php
/**
 * Shared nonce / capability / sanitize helpers used by every module.
 *
 * Every write action (settings save, AJAX handler, REST callback, form
 * submit) MUST go through verify_write() before touching the database.
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

namespace AnsariAi\StoreHealth\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Guard {

	/**
	 * Verify both a nonce and a capability in one call. Dies with a 403
	 * JSON/HTML error (via wp_die) when either check fails, exactly like
	 * WordPress core's own admin-post.php guards.
	 *
	 * @param string $nonce_action Nonce action string, typically 'ansariai_sh_' . $context.
	 * @param string $nonce_name   Name of the $_REQUEST field / header carrying the nonce.
	 * @param string $capability   Capability required, e.g. 'manage_options'.
	 */
	public static function verify_write( string $nonce_action, string $nonce_name = '_wpnonce', string $capability = 'manage_options' ): void {
		if ( ! self::current_user_can( $capability ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'store-health' ), 403 );
		}

		if ( ! self::verify_nonce( $nonce_action, $nonce_name ) ) {
			wp_die( esc_html__( 'Security check failed. Please reload the page and try again.', 'store-health' ), 403 );
		}
	}

	/**
	 * Non-fatal nonce check, safe to use in REST permission_callback or AJAX
	 * handlers that need to return a WP_Error instead of calling wp_die().
	 */
	public static function verify_nonce( string $action, string $field = '_wpnonce' ): bool {
		$nonce = '';

		if ( isset( $_REQUEST[ $field ] ) ) {
			$nonce = sanitize_text_field( wp_unslash( $_REQUEST[ $field ] ) );
		} elseif ( isset( $_SERVER['HTTP_X_WP_NONCE'] ) ) {
			$nonce = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_WP_NONCE'] ) );
		}

		if ( '' === $nonce ) {
			return false;
		}

		return (bool) wp_verify_nonce( $nonce, $action );
	}

	/**
	 * Non-fatal capability check.
	 */
	public static function current_user_can( string $capability ): bool {
		return current_user_can( $capability );
	}

	/**
	 * Sanitize a single input value according to a declared type. Mirrors
	 * the "type" values used in plugin spec "options" and module.json
	 * "options" arrays, so Settings.php and modules can share one helper.
	 *
	 * @param mixed $value Raw, unslashed input value.
	 */
	public static function sanitize( mixed $value, string $type ): mixed {
		switch ( $type ) {
			case 'email':
				return sanitize_email( (string) $value );

			case 'url':
				return esc_url_raw( (string) $value );

			case 'number':
				return is_numeric( $value ) ? $value + 0 : 0;

			case 'checkbox':
				return (bool) $value;

			case 'textarea':
				return sanitize_textarea_field( (string) $value );

			case 'password':
				// Never logged, never echoed back into a value="" attribute.
				return (string) $value;

			case 'select':
			case 'text':
			default:
				return sanitize_text_field( (string) $value );
		}
	}

	/**
	 * Sanitize an entire $_POST-like array using a field => type map. Any
	 * key present in $map but missing from $input falls back to null.
	 *
	 * @param array<string,mixed>  $input Raw, unslashed input (e.g. wp_unslash($_POST)).
	 * @param array<string,string> $map   field key => sanitize type.
	 *
	 * @return array<string,mixed>
	 */
	public static function sanitize_array( array $input, array $map ): array {
		$clean = array();

		foreach ( $map as $key => $type ) {
			$clean[ $key ] = array_key_exists( $key, $input )
				? self::sanitize( $input[ $key ], $type )
				: self::sanitize( 'checkbox' === $type ? false : '', $type );
		}

		return $clean;
	}
}
