<?php
/**
 * Contract every SMS driver implements.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\SmsGateway;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

interface SmsDriverInterface {

	/**
	 * Stable driver id, e.g. 'kavenegar', 'melipayamak'.
	 */
	public function id(): string;

	/**
	 * Sends a single SMS. Returns true on success. On failure, returns
	 * false and the concrete error is available via last_error() — never
	 * thrown, so a failed SMS never fatals a background job.
	 */
	public function send( string $to, string $message ): bool;

	/**
	 * Human-readable reason for the last failed send(), empty string if
	 * the last call succeeded or none was made yet. MUST NOT include the
	 * API key/secret.
	 */
	public function last_error(): string;
}
