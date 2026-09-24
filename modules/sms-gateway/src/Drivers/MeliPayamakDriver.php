<?php
/**
 * MeliPayamak (melipayamak.com) SMS driver.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\SmsGateway\Drivers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class MeliPayamakDriver extends AbstractHttpDriver {

	public function id(): string {
		return 'melipayamak';
	}

	public function send( string $to, string $message ): bool {
		if ( '' === $this->api_key ) {
			$this->last_error = 'Missing username/password token.';

			return false;
		}

		if ( '' === $this->sender ) {
			$this->last_error = 'Missing sender number.';

			return false;
		}

		// MeliPayamak's REST API authenticates with a single opaque token
		// (their "username") stored as the driver's api_key; the sender
		// line number is required per-send.
		$url = sprintf(
			'https://rest.payamak-panel.com/api/SendSMS/SendSMS'
		);

		$body = [
			'username' => $this->api_key,
			'password' => $this->sender,
			'to'       => $to,
			'from'     => $this->sender,
			'text'     => $message,
			'isflash'  => false,
		];

		$result = $this->post( $url, $body );

		if ( null === $result ) {
			return false;
		}

		$recipient_id = (int) ( $result['Value'] ?? 0 );

		if ( $recipient_id <= 0 ) {
			$this->last_error = (string) ( $result['RetStatus'] ?? 'Unknown MeliPayamak error.' );

			return false;
		}

		return true;
	}
}
