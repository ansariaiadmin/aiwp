<?php
/**
 * Settings Page Extras module.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\SettingsPage;

use VendorPlugin\Contracts\ModuleInterface;
use VendorPlugin\Support\Guard;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class SettingsPage implements ModuleInterface {

	public function id(): string {
		return 'settings-page';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
		add_filter( 'plugin_action_links_' . VPLUGIN_BASENAME, [ $this, 'add_settings_link' ] );
		add_action( 'admin_post_{{PREFIX}}_reset_settings', [ $this, 'handle_reset_settings' ] );
	}

	public function boot(): void {
	}

	/**
	 * @param string[] $links
	 *
	 * @return string[]
	 */
	public function add_settings_link( array $links ): array {
		$url = admin_url( 'options-general.php?page={{SLUG}}-settings' );

		array_unshift(
			$links,
			sprintf(
				'<a href="%1$s">%2$s</a>',
				esc_url( $url ),
				esc_html__( 'Settings', '{{TEXT_DOMAIN}}' )
			)
		);

		return $links;
	}

	/**
	 * Handles the "Reset settings" admin-post action. Guarded by both a
	 * nonce and the manage_options capability before touching any option.
	 */
	public function handle_reset_settings(): void {
		Guard::verify_write( '{{PREFIX}}_reset_settings', '_wpnonce', 'manage_options' );

		delete_option( '{{PREFIX}}_settings' );

		wp_safe_redirect(
			add_query_arg(
				[
					'page'  => '{{SLUG}}-settings',
					'reset' => '1',
				],
				admin_url( 'options-general.php' )
			)
		);
		exit;
	}
}
