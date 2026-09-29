<?php
/**
 * Settings Page Extras module.
 *
 * @package AnsariAi\SiteGuardian
 */

declare(strict_types=1);

namespace AnsariAi\SiteGuardian\Modules\SettingsPage;

use AnsariAi\SiteGuardian\Contracts\ModuleInterface;
use AnsariAi\SiteGuardian\Support\Guard;

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
		add_filter( 'plugin_action_links_' . SGUARD_BASENAME, [ $this, 'add_settings_link' ] );
		add_action( 'admin_post_sguard_reset_settings', [ $this, 'handle_reset_settings' ] );
	}

	public function boot(): void {
	}

	/**
	 * @param string[] $links
	 *
	 * @return string[]
	 */
	public function add_settings_link( array $links ): array {
		$url = admin_url( 'options-general.php?page=site-guardian-settings' );

		array_unshift(
			$links,
			sprintf(
				'<a href="%1$s">%2$s</a>',
				esc_url( $url ),
				esc_html__( 'Settings', 'site-guardian' )
			)
		);

		return $links;
	}

	/**
	 * Handles the "Reset settings" admin-post action. Guarded by both a
	 * nonce and the manage_options capability before touching any option.
	 */
	public function handle_reset_settings(): void {
		Guard::verify_write( 'sguard_reset_settings', '_wpnonce', 'manage_options' );

		delete_option( 'sguard_settings' );

		wp_safe_redirect(
			add_query_arg(
				[
					'page'  => 'site-guardian-settings',
					'reset' => '1',
				],
				admin_url( 'options-general.php' )
			)
		);
		exit;
	}
}
