<?php
/**
 * License Client module.
 *
 * Talks to the ansariaiwp license server to activate/validate/deactivate a
 * license key, and delivers private plugin updates via the
 * 'site_transient_update_plugins' + 'plugins_api' filters — never a
 * wordpress.org or GitHub URL is exposed to the site owner.
 *
 * The license server base URL and product id are resolved at build time
 * from the plugin spec ("license.server" / "license.productId") into the
 * LICENSE_SERVER / LICENSE_PRODUCT_ID constants below by tools/compose.php.
 * This module is only included in a build when spec.license.enabled=true.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\LicenseClient;

use VendorPlugin\Contracts\ModuleInterface;
use VendorPlugin\Plugin;
use VendorPlugin\Settings;
use VendorPlugin\Support\Guard;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class LicenseClient implements ModuleInterface {

	private const LICENSE_SERVER = '{{LICENSE_SERVER}}';
	private const PRODUCT_ID     = '{{LICENSE_PRODUCT_ID}}';
	private const CHECK_HOOK     = '{{PREFIX}}_license_check';

	public function id(): string {
		return 'license-client';
	}

	public function requirements(): array {
		$unmet = [];

		if ( '' === self::LICENSE_SERVER ) {
			$unmet[] = __( 'No license server configured in the plugin spec.', '{{TEXT_DOMAIN}}' );
		}

		return $unmet;
	}

	public function register(): void {
		add_action( 'admin_post_{{PREFIX}}_activate_license', [ $this, 'handle_activate' ] );
		add_action( 'admin_post_{{PREFIX}}_deactivate_license', [ $this, 'handle_deactivate' ] );
		add_action( self::CHECK_HOOK, [ $this, 'revalidate' ] );

		add_filter( 'site_transient_update_plugins', [ $this, 'inject_update' ] );
		add_filter( 'plugins_api', [ $this, 'plugin_information' ], 10, 3 );
		add_action( 'upgrader_process_complete', [ $this, 'clear_update_cache' ], 10, 0 );
	}

	public function boot(): void {
		$scheduler = Plugin::instance()->module( 'scheduler' );

		if ( null !== $scheduler ) {
			$scheduler->schedule_recurring( self::CHECK_HOOK, DAY_IN_SECONDS );

			add_action(
				'{{PREFIX}}_deactivate',
				static function () use ( $scheduler ): void {
					$scheduler->unschedule( LicenseClient::CHECK_HOOK );
				}
			);
		}
	}

	public function is_active(): bool {
		return 'active' === Settings::get( 'license_status', 'inactive' );
	}

	/**
	 * Handles the "Activate license" admin-post action.
	 */
	public function handle_activate(): void {
		// Guard::verify_write() performs both the capability check and the
		// nonce check (wp_verify_nonce()) before this method continues.
		Guard::verify_write( '{{PREFIX}}_activate_license', '_wpnonce', 'manage_options' );

		$key = isset( $_POST['license_key'] ) ? sanitize_text_field( wp_unslash( $_POST['license_key'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce already verified above via Guard::verify_write().

		$result = $this->call( 'activate', [ 'license_key' => $key ] );

		if ( ! empty( $result['success'] ) ) {
			$this->store_license( $key, 'active' );
			do_action( '{{PREFIX}}_license_activated', $key );
		} else {
			$this->store_license( $key, 'invalid' );
		}

		$this->redirect_back();
	}

	public function handle_deactivate(): void {
		Guard::verify_write( '{{PREFIX}}_deactivate_license', '_wpnonce', 'manage_options' );

		$key = (string) Settings::get( 'license_key', '' );

		$this->call( 'deactivate', [ 'license_key' => $key ] );

		$this->store_license( $key, 'inactive' );
		do_action( '{{PREFIX}}_license_deactivated', $key );

		$this->redirect_back();
	}

	/**
	 * Periodic revalidation, called from the scheduler.
	 */
	public function revalidate(): void {
		$key = (string) Settings::get( 'license_key', '' );

		if ( '' === $key ) {
			return;
		}

		$result = $this->call( 'validate', [ 'license_key' => $key ] );

		$status = ! empty( $result['success'] ) ? 'active' : 'invalid';
		$this->store_license( $key, $status );
	}

	private function store_license( string $key, string $status ): void {
		$option                   = (array) get_option( '{{PREFIX}}_settings', [] );
		$option['license_key']    = $key;
		$option['license_status'] = $status;
		update_option( '{{PREFIX}}_settings', $option );
	}

	/**
	 * @param array<string,mixed> $params
	 *
	 * @return array<string,mixed>
	 */
	private function call( string $action, array $params ): array {
		if ( '' === self::LICENSE_SERVER ) {
			return [
				'success' => false,
				'message' => 'No license server configured.',
			];
		}

		$url = trailingslashit( self::LICENSE_SERVER ) . 'license/' . rawurlencode( $action );

		$response = wp_remote_post(
			$url,
			[
				'timeout' => 15,
				'body'    => array_merge(
					$params,
					[
						'product_id' => self::PRODUCT_ID,
						'site_url'   => home_url(),
					]
				),
			]
		);

		if ( is_wp_error( $response ) ) {
			\VendorPlugin\Logger::error(
				'License server request failed.',
				[
					'action' => $action,
					'error'  => $response->get_error_message(),
				]
			);

			return [
				'success' => false,
				'message' => $response->get_error_message(),
			];
		}

		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		return is_array( $body ) ? $body : [ 'success' => false ];
	}

	/**
	 * Injects a private update into the 'update_plugins' site transient
	 * when the license server reports a newer version and the license is
	 * active. Never points at wordpress.org or a public GitHub URL — the
	 * download link is a short-lived, license-scoped URL from the license
	 * server itself.
	 */
	public function inject_update( mixed $transient ): mixed {
		if ( ! is_object( $transient ) || ! $this->is_active() ) {
			return $transient;
		}

		$info = $this->call( 'update-check', [ 'license_key' => (string) Settings::get( 'license_key', '' ) ] );

		if ( empty( $info['success'] ) || empty( $info['new_version'] ) ) {
			return $transient;
		}

		if ( version_compare( (string) $info['new_version'], VPLUGIN_VERSION, '<=' ) ) {
			return $transient;
		}

		$plugin_data = (object) [
			'slug'        => '{{SLUG}}',
			'plugin'      => VPLUGIN_BASENAME,
			'new_version' => (string) $info['new_version'],
			'url'         => self::LICENSE_SERVER,
			'package'     => isset( $info['package_url'] ) ? esc_url_raw( (string) $info['package_url'] ) : '',
			'tested'      => isset( $info['tested'] ) ? (string) $info['tested'] : '',
		];

		if ( ! isset( $transient->response ) || ! is_array( $transient->response ) ) {
			$transient->response = [];
		}

		$transient->response[ VPLUGIN_BASENAME ] = $plugin_data;

		return $transient;
	}

	/**
	 * Supplies the "View details" plugins_api response from the license
	 * server instead of wordpress.org.
	 *
	 * @param mixed $result
	 * @param mixed $action
	 * @param mixed $args
	 */
	public function plugin_information( mixed $result, mixed $action = null, mixed $args = null ): mixed {
		if ( 'plugin_information' !== $action || ! is_object( $args ) || ( $args->slug ?? '' ) !== '{{SLUG}}' ) {
			return $result;
		}

		$info = $this->call( 'info', [ 'license_key' => (string) Settings::get( 'license_key', '' ) ] );

		if ( empty( $info['success'] ) ) {
			return $result;
		}

		return (object) [
			'name'     => '{{PLUGIN_NAME}}',
			'slug'     => '{{SLUG}}',
			'version'  => isset( $info['new_version'] ) ? (string) $info['new_version'] : VPLUGIN_VERSION,
			'sections' => [
				'description' => isset( $info['description'] ) ? wp_kses_post( (string) $info['description'] ) : '',
				'changelog'   => isset( $info['changelog'] ) ? wp_kses_post( (string) $info['changelog'] ) : '',
			],
		];
	}

	public function clear_update_cache(): void {
		delete_site_transient( 'update_plugins' );
	}

	private function redirect_back(): void {
		wp_safe_redirect(
			add_query_arg( [ 'page' => '{{SLUG}}-settings' ], admin_url( 'options-general.php' ) )
		);
		exit;
	}
}
