<?php
/**
 * Kavenegar (kavenegar.com) SMS driver.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\SmsGateway\Drivers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class KavenegarDriver extends AbstractHttpDriver {

	public function id(): string {
		return 'kavenegar';
	}

	public function send( string $to, string $message ): bool {
		if ( '' === $this->api_key ) {
			$this->last_error = 'Missing API key.';

			return false;
		}

		$url = sprintf(
			'https://api.kavenegar.com/v1/%s/sms/send.json',
			rawurlencode( $this->api_key )
		);

		$body = [
			'receptor' => $to,
			'message'  => $message,
		];

		if ( '' !== $this->sender ) {
			$body['sender'] = $this->sender;
		}

		$result = $this->post( $url, $body );

		if ( null === $result ) {
			return false;
		}

		$status = (int) ( $result['return']['status'] ?? 0 );

		if ( 200 !== $status ) {
			$this->last_error = (string) ( $result['return']['message'] ?? 'Unknown Kavenegar error.' );

			return false;
		}

		return true;
	}
}
