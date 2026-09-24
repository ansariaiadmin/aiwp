<?php
/**
 * Shared HTTP plumbing for SMS drivers, using wp_remote_post() (never
 * curl directly) so requests respect WordPress HTTP filters/proxies.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\SmsGateway\Drivers;

use VendorPlugin\Modules\SmsGateway\SmsDriverInterface;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

abstract class AbstractHttpDriver implements SmsDriverInterface {

	protected string $api_key;

	protected string $sender;

	protected string $last_error = '';

	public function __construct( string $api_key, string $sender = '' ) {
		$this->api_key = $api_key;
		$this->sender  = $sender;
	}

	public function last_error(): string {
		return $this->last_error;
	}

	/**
	 * @param array<string,mixed> $body
	 *
	 * @return array<string,mixed>|null Decoded JSON body, or null on transport/HTTP error.
	 */
	protected function post( string $url, array $body ): ?array {
		$response = wp_remote_post(
			$url,
			[
				'timeout' => 15,
				'body'    => $body,
			]
		);

		if ( is_wp_error( $response ) ) {
			// Never include $this->api_key in the logged context.
			$this->last_error = $response->get_error_message();
			\VendorPlugin\Logger::error(
				'SMS gateway transport error.',
				[
					'driver' => $this->id(),
					'error'  => $this->last_error,
				]
			);

			return null;
		}

		$code    = (int) wp_remote_retrieve_response_code( $response );
		$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( $code < 200 || $code >= 300 ) {
			$this->last_error = sprintf( 'HTTP %d', $code );
			\VendorPlugin\Logger::error(
				'SMS gateway rejected the request.',
				[
					'driver' => $this->id(),
					'status' => $code,
				]
			);

			return null;
		}

		return is_array( $decoded ) ? $decoded : [];
	}
}
