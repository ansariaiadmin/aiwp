<?php
/**
 * Settings Page Extras module.
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

namespace AnsariAi\StoreHealth\Modules\SettingsPage;

use AnsariAi\StoreHealth\Contracts\ModuleInterface;
use AnsariAi\StoreHealth\Support\Guard;

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
		add_filter( 'plugin_action_links_' . ANSARIAI_SH_BASENAME, [ $this, 'add_settings_link' ] );
		add_action( 'admin_post_ansariai_sh_reset_settings', [ $this, 'handle_reset_settings' ] );
	}

	public function boot(): void {
	}

	/**
	 * @param string[] $links
	 *
	 * @return string[]
	 */
	public function add_settings_link( array $links ): array {
		$url = admin_url( 'options-general.php?page=store-health-settings' );

		array_unshift(
			$links,
			sprintf(
				'<a href="%1$s">%2$s</a>',
				esc_url( $url ),
				esc_html__( 'Settings', 'store-health' )
			)
		);

		return $links;
	}

	/**
	 * Handles the "Reset settings" admin-post action. Guarded by both a
	 * nonce and the manage_options capability before touching any option.
	 */
	public function handle_reset_settings(): void {
		Guard::verify_write( 'ansariai_sh_reset_settings', '_wpnonce', 'manage_options' );

		delete_option( 'ansariai_sh_settings' );

		wp_safe_redirect(
			add_query_arg(
				[
					'page'  => 'store-health-settings',
					'reset' => '1',
				],
				admin_url( 'options-general.php' )
			)
		);
		exit;
	}
}
