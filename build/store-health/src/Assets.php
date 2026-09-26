<?php
/**
 * Versioned asset enqueue helper. Admin-only by default; a module that
 * needs a front-end asset must explicitly call enqueue_public().
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

namespace AnsariAi\StoreHealth;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Assets {

	public function register(): void {
		add_action( 'admin_enqueue_scripts', array( $this, 'maybe_enqueue_admin' ) );
	}

	public function maybe_enqueue_admin( string $hook ): void {
		/**
		 * Filters whether admin assets should be enqueued on the current
		 * admin screen. Defaults to only the plugin's own settings screen.
		 *
		 * @param bool   $should_enqueue
		 * @param string $hook Current admin page hook suffix.
		 */
		$should_enqueue = (bool) apply_filters(
			'ansariai_sh_load_admin_assets',
			false !== strpos( $hook, 'store-health' ),
			$hook
		);

		if ( ! $should_enqueue ) {
			return;
		}

		$this->enqueue_admin();
	}

	public function enqueue_admin(): void {
		$css = ANSARIAI_SH_DIR . 'assets/css/admin.css';
		$js  = ANSARIAI_SH_DIR . 'assets/js/admin.js';

		if ( file_exists( $css ) ) {
			wp_enqueue_style(
				'store-health-admin',
				ANSARIAI_SH_URL . 'assets/css/admin.css',
				array(),
				(string) filemtime( $css )
			);
		}

		if ( file_exists( $js ) ) {
			wp_enqueue_script(
				'store-health-admin',
				ANSARIAI_SH_URL . 'assets/js/admin.js',
				array(),
				(string) filemtime( $js ),
				true
			);
			// The help trigger button uses WordPress's dashicons set.
			wp_enqueue_style( 'dashicons' );
		}
	}

	/**
	 * Modules must call this explicitly (never enqueued automatically) if
	 * they need a public/front-end asset.
	 */
	public function enqueue_public( string $handle, string $relative_css_path = '', string $relative_js_path = '' ): void {
		if ( '' !== $relative_css_path ) {
			$path = ANSARIAI_SH_DIR . $relative_css_path;
			if ( file_exists( $path ) ) {
				wp_enqueue_style( $handle, ANSARIAI_SH_URL . $relative_css_path, array(), (string) filemtime( $path ) );
			}
		}

		if ( '' !== $relative_js_path ) {
			$path = ANSARIAI_SH_DIR . $relative_js_path;
			if ( file_exists( $path ) ) {
				wp_enqueue_script( $handle, ANSARIAI_SH_URL . $relative_js_path, array(), (string) filemtime( $path ), true );
			}
		}
	}
}
