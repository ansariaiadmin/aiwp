<?php
/**
 * WooCommerce Blocks Compatibility module.
 *
 * The core scaffold already declares 'custom_order_tables' (HPOS) and
 * 'cart_checkout_blocks' compatibility via FeaturesUtil. This module adds
 * the actual Store API / Cart-Checkout Blocks integration point other
 * modules (or glue code) can hook into to render extra data in the
 * block-based checkout without touching legacy shortcode-based checkout
 * hooks.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\BlocksCompat;

use VendorPlugin\Contracts\ModuleInterface;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class BlocksCompat implements ModuleInterface {

	public function id(): string {
		return 'blocks-compat';
	}

	public function requirements(): array {
		$unmet = [];

		if ( ! class_exists( \WooCommerce::class ) ) {
			$unmet[] = __( 'WooCommerce must be active.', '{{TEXT_DOMAIN}}' );
		}

		return $unmet;
	}

	public function register(): void {
		add_action( 'woocommerce_blocks_loaded', [ $this, 'register_integration' ] );
	}

	public function boot(): void {
	}

	/**
	 * Registers this plugin as a Cart/Checkout Blocks integration so glue
	 * code can extend the Store API schema (extend_rest_api_add_field) and
	 * enqueue block-aware assets, instead of relying on legacy
	 * `woocommerce_before_checkout_form`-style hooks that Cart/Checkout
	 * Blocks do not fire.
	 */
	public function register_integration(): void {
		if ( ! function_exists( 'woocommerce_store_api_register_endpoint_data' ) ) {
			return;
		}

		/**
		 * Fires once Cart/Checkout Blocks integrations can be registered.
		 * Glue code should hook this to call
		 * woocommerce_store_api_register_endpoint_data() /
		 * Automattic\WooCommerce\StoreApi\StoreApi for custom checkout
		 * fields, rather than editing this module.
		 */
		do_action( '{{PREFIX}}_register_blocks_integration' );
	}
}
