<?php
/**
 * SMS Gateway module.
 *
 * Resolves the configured driver (Kavenegar or MeliPayamak by default,
 * extensible via a filter) and exposes a single send() entry point. The
 * API key/sender are read from wp_options (set through the settings
 * screen) — never hardcoded, never logged.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\SmsGateway;

use VendorPlugin\Contracts\ModuleInterface;
use VendorPlugin\Modules\SmsGateway\Drivers\KavenegarDriver;
use VendorPlugin\Modules\SmsGateway\Drivers\MeliPayamakDriver;
use VendorPlugin\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class SmsGateway implements ModuleInterface {

	private ?SmsDriverInterface $driver = null;

	public function id(): string {
		return 'sms-gateway';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
	}

	public function boot(): void {
	}

	public function driver(): SmsDriverInterface {
		if ( null !== $this->driver ) {
			return $this->driver;
		}

		$driver_id = (string) Settings::get( 'sms_driver', 'kavenegar' );
		$api_key   = (string) Settings::get( 'sms_api_key', '' );
		$sender    = (string) Settings::get( 'sms_sender', '' );

		$drivers = [
			'kavenegar'   => static fn (): SmsDriverInterface => new KavenegarDriver( $api_key, $sender ),
			'melipayamak' => static fn (): SmsDriverInterface => new MeliPayamakDriver( $api_key, $sender ),
		];

		/**
		 * Filters the map of available SMS drivers: driver id => factory
		 * closure returning a SmsDriverInterface. Lets glue code add
		 * further gateways without modifying this module.
		 *
		 * @param array<string,callable():SmsDriverInterface> $drivers
		 */
		$drivers = (array) apply_filters( '{{PREFIX}}_sms_driver', $drivers );

		$factory = $drivers[ $driver_id ] ?? $drivers['kavenegar'];

		$this->driver = $factory();

		return $this->driver;
	}

	/**
	 * Sends a single SMS through the configured driver. Never throws;
	 * returns false and logs a redacted error on failure.
	 */
	public function send( string $to, string $message ): bool {
		/**
		 * Fires before an SMS is sent, e.g. for rate limiting or audit
		 * logging in glue code.
		 *
		 * @param string $to
		 * @param string $message
		 */
		do_action( '{{PREFIX}}_sms_before_send', $to, $message );

		$ok = $this->driver()->send( $to, $message );

		if ( ! $ok ) {
			\VendorPlugin\Logger::error(
				'SMS send failed.',
				[
					'driver' => $this->driver()->id(),
					'reason' => $this->driver()->last_error(),
				]
			);
		}

		return $ok;
	}
}
