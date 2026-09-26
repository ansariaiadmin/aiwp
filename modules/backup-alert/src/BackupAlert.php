<?php
/**
 * Backup Freshness Alert module.
 *
 * Reads the last-backup timestamp from an option (updated by your backup
 * tool or glue code via the {{PREFIX}}_backup_last_timestamp filter),
 * compares its age against a configurable threshold on a daily cron tick
 * and alerts the admin by email (via email-notify when bundled) plus an
 * admin notice. Fires {{PREFIX}}_backup_stale so sms-gateway / other
 * integrations can react too.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\BackupAlert;

use VendorPlugin\Contracts\ModuleInterface;
use VendorPlugin\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class BackupAlert implements ModuleInterface {

	public const CRON_EVENT = '{{PREFIX}}_check_backup';
	public const HOOK       = '{{PREFIX}}_check_backup_age';
	public const NOTICE     = '{{PREFIX}}_backup_stale_notice';

	public function id(): string {
		return 'backup-alert';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
		add_action( self::HOOK, array( $this, 'check' ) );
		add_action( 'admin_notices', array( $this, 'render_notice' ) );
	}

	public function boot(): void {
		if ( ! wp_next_scheduled( self::CRON_EVENT ) ) {
			wp_schedule_event( time() + MINUTE_IN_SECONDS, 'daily', self::CRON_EVENT );
		}
		add_action( self::CRON_EVENT, array( $this, 'check' ) );
	}

	/**
	 * Unix timestamp of the last known good backup, 0 when unknown.
	 */
	public function last_backup_at(): int {
		$option_key = (string) Settings::get( 'backup_time_option', '{{PREFIX}}_last_backup_at' );
		$ts         = (int) get_option( $option_key, 0 );

		/**
		 * Filters the last-backup timestamp (e.g. read it from UpdraftPlus
		 * or BackWPup's own options instead).
		 *
		 * @param int $ts
		 */
		return (int) apply_filters( '{{PREFIX}}_backup_last_timestamp', $ts );
	}

	/**
	 * Threshold in days before a backup counts as stale.
	 */
	public function max_age_days(): int {
		$days = (int) Settings::get( 'backup_max_age_days', 7 );

		/** This filter is documented in modules/backup-alert/src/BackupAlert.php */
		return max( 1, (int) apply_filters( '{{PREFIX}}_backup_max_age_days', $days > 0 ? $days : 7 ) );
	}

	/**
	 * Runs the staleness check; returns true when an alert fired.
	 */
	public function check(): bool {
		$last = $this->last_backup_at();
		$age  = $last > 0 ? ( time() - $last ) : null;
		$max  = $this->max_age_days() * DAY_IN_SECONDS;

		$stale = ( null === $age ) || ( $age > $max );

		if ( ! $stale ) {
			delete_transient( self::NOTICE );
			return false;
		}

		$message = null === $age
			? __( 'No backup has been recorded yet.', '{{TEXT_DOMAIN}}' )
			: sprintf(
				/* translators: %d: number of days since last backup. */
				__( 'The most recent backup is %d days old.', '{{TEXT_DOMAIN}}' ),
				(int) floor( ( $age / DAY_IN_SECONDS ) )
			);

		set_transient( self::NOTICE, $message, DAY_IN_SECONDS );

		/**
		 * Fires when the backup was found to be stale, e.g. for SMS alerts.
		 *
		 * @param string|null $message Human-readable reason.
		 */
		do_action( '{{PREFIX}}_backup_stale', $message );

		$email = sanitize_email( (string) Settings::get( 'backup_alert_email', '' ) );
		if ( '' !== $email && is_email( $email ) && ! get_transient( '{{PREFIX}}_backup_alert_sent' ) ) {
			$subject = sprintf(
				/* translators: %s: site name. */
				__( '[%s] Backup is stale', '{{TEXT_DOMAIN}}' ),
				wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES )
			);
			$body    = '<p>' . esc_html( (string) $message ) . '</p>';

			$sent = false;
			if ( class_exists( '\VendorPlugin\Modules\EmailNotify\EmailNotify' ) ) {
				/** @var \VendorPlugin\Modules\EmailNotify\EmailNotify $mailer */
				$mailer = \VendorPlugin\Plugin::instance()->module( 'email-notify' );
				if ( null !== $mailer ) {
					$sent = $mailer->send( $email, $subject, $body );
				}
			}
			if ( ! $sent ) {
				$sent = wp_mail( $email, $subject, $body );
			}

			if ( $sent ) {
				set_transient( '{{PREFIX}}_backup_alert_sent', 1, $max );
			}
		}

		return true;
	}

	public function render_notice(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$message = get_transient( self::NOTICE );
		if ( ! is_string( $message ) || '' === $message ) {
			return;
		}
		printf(
			'<div class="notice notice-warning"><p><strong>%s</strong> %s</p></div>',
			esc_html__( '{{PLUGIN_NAME}}:', '{{TEXT_DOMAIN}}' ),
			esc_html( $message )
		);
	}
}
