<?php
/**
 * Email Notifications module.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\EmailNotify;

use VendorPlugin\Contracts\ModuleInterface;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class EmailNotify implements ModuleInterface {

	public function id(): string {
		return 'email-notify';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
	}

	public function boot(): void {
	}

	/**
	 * Sends an HTML email. $to is validated with is_email() before being
	 * handed to wp_mail(); an invalid address never reaches wp_mail() and
	 * the call returns false immediately.
	 *
	 * @param array<string,mixed> $context Arbitrary key/value pairs made available to the
	 *                                     '{{PREFIX}}_email_body' filter for template rendering.
	 */
	public function send( string $to, string $subject, string $body_html, array $context = [] ): bool {
		$to = sanitize_email( $to );

		if ( ! is_email( $to ) ) {
			\VendorPlugin\Logger::warning( 'Refused to send email: invalid recipient address.' );

			return false;
		}

		/**
		 * Filters the email subject before sending.
		 *
		 * @param string $subject
		 * @param array<string,mixed> $context
		 */
		$subject = (string) apply_filters( '{{PREFIX}}_email_subject', $subject, $context );

		/**
		 * Filters the rendered HTML email body. wp_kses_post() is applied
		 * unconditionally afterwards, so filters may not inject scripts.
		 *
		 * @param string $body_html
		 * @param array<string,mixed> $context
		 */
		$body_html = (string) apply_filters( '{{PREFIX}}_email_body', $body_html, $context );
		$body_html = wp_kses_post( $body_html );

		$headers = [ 'Content-Type: text/html; charset=UTF-8' ];

		/**
		 * Filters the wp_mail() headers array.
		 *
		 * @param string[] $headers
		 */
		$headers = (array) apply_filters( '{{PREFIX}}_email_headers', $headers );

		/**
		 * Fires immediately before wp_mail() is called.
		 *
		 * @param string $to
		 * @param string $subject
		 */
		do_action( '{{PREFIX}}_before_email_send', $to, $subject );

		$sent = wp_mail( $to, $subject, $body_html, $headers );

		if ( ! $sent ) {
			\VendorPlugin\Logger::error( 'wp_mail() returned false.', [ 'to_domain' => substr( (string) strrchr( $to, '@' ), 1 ) ] );
		}

		return $sent;
	}

	/**
	 * Wraps arbitrary HTML in a minimal, inline-styled email shell. Kept
	 * intentionally simple; glue code can bypass this and call send()
	 * with fully custom markup.
	 */
	public function wrap_template( string $title, string $inner_html ): string {
		return sprintf(
			'<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">' .
			'<h2 style="color:#23282d;">%1$s</h2><div>%2$s</div>' .
			'<p style="color:#888;font-size:12px;">%3$s</p></div>',
			esc_html( $title ),
			wp_kses_post( $inner_html ),
			esc_html( get_bloginfo( 'name' ) )
		);
	}
}
