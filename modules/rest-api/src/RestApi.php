<?php
/**
 * REST API module.
 *
 * Registers a `{{SLUG}}/v1` REST namespace. Ships one example read-only
 * route (`/status`) and lets other modules/glue code register more routes
 * via the `{{PREFIX}}_rest_routes` filter instead of calling
 * register_rest_route() directly, so every route is guaranteed to pass
 * through the same permission-callback discipline.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\RestApi;

use VendorPlugin\Contracts\ModuleInterface;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class RestApi implements ModuleInterface {

	public const NAMESPACE_V1 = '{{SLUG}}/v1';

	public function id(): string {
		return 'rest-api';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	public function boot(): void {
	}

	public function register_routes(): void {
		register_rest_route(
			self::NAMESPACE_V1,
			'/status',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_status' ],
				'permission_callback' => [ $this, 'can_read_status' ],
			]
		);

		/**
		 * Filters additional route definitions. Each item must be a valid
		 * register_rest_route() argument set including a non-null
		 * 'permission_callback' — routes missing one are skipped and
		 * logged rather than silently registered as public.
		 *
		 * @param array<int,array{route:string,args:array<string,mixed>}> $routes
		 */
		$routes = (array) apply_filters( '{{PREFIX}}_rest_routes', [] );

		foreach ( $routes as $route ) {
			if ( ! isset( $route['route'], $route['args'] ) || ! is_array( $route['args'] ) ) {
				continue;
			}

			if ( empty( $route['args']['permission_callback'] ) ) {
				\VendorPlugin\Logger::warning(
					'Skipped REST route registration: missing permission_callback.',
					[ 'route' => $route['route'] ]
				);

				continue;
			}

			register_rest_route( self::NAMESPACE_V1, $route['route'], $route['args'] );
		}
	}

	public function can_read_status(): bool {
		return current_user_can( 'manage_options' );
	}

	public function get_status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return new WP_REST_Response(
			[
				'plugin'  => '{{SLUG}}',
				'version' => VPLUGIN_VERSION,
				'time'    => current_time( 'mysql', true ),
			]
		);
	}
}
