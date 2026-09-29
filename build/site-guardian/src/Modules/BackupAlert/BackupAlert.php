<?php
/**
 * Backup Freshness Alert module.
 *
 * Reads the last-backup timestamp from an option (updated by your backup
 * tool or glue code via the sguard_backup_last_timestamp filter),
 * compares its age against a configurable threshold on a daily cron tick
 * and alerts the admin by email (via email-notify when bundled) plus an
 * admin notice. Fires sguard_backup_stale so sms-gateway / other
 * integrations can react too.
 *
 * @package AnsariAi\SiteGuardian
 */

declare(strict_types=1);

namespace AnsariAi\SiteGuardian\Modules\BackupAlert;

use AnsariAi\SiteGuardian\Contracts\ModuleInterface;
use AnsariAi\SiteGuardian\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class BackupAlert implements ModuleInterface {

	public const CRON_EVENT = 'sguard_check_backup';
	public const HOOK       = 'sguard_check_backup_age';
	public const NOTICE     = 'sguard_backup_stale_notice';

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
		$option_key = (string) Settings::get( 'backup_time_option', 'sguard_last_backup_at' );
		$ts         = (int) get_option( $option_key, 0 );

		/**
		 * Filters the last-backup timestamp (e.g. read it from UpdraftPlus
		 * or BackWPup's own options instead).
		 *
		 * @param int $ts
		 */
		return (int) apply_filters( 'sguard_backup_last_timestamp', $ts );
	}

	/**
	 * Threshold in days before a backup counts as stale.
	 */
	public function max_age_days(): int {
		$days = (int) Settings::get( 'backup_max_age_days', 7 );

		/** This filter is documented in modules/backup-alert/src/BackupAlert.php */
		return max( 1, (int) apply_filters( 'sguard_backup_max_age_days', $days > 0 ? $days : 7 ) );
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
			? __( 'No backup has been recorded yet.', 'site-guardian' )
			: sprintf(
				/* translators: %d: number of days since last backup. */
				__( 'The most recent backup is %d days old.', 'site-guardian' ),
				(int) floor( ( $age / DAY_IN_SECONDS ) )
			);

		set_transient( self::NOTICE, $message, DAY_IN_SECONDS );

		/**
		 * Fires when the backup was found to be stale, e.g. for SMS alerts.
		 *
		 * @param string|null $message Human-readable reason.
		 */
		do_action( 'sguard_backup_stale', $message );

		$email = sanitize_email( (string) Settings::get( 'backup_alert_email', '' ) );
		if ( '' !== $email && is_email( $email ) && ! get_transient( 'sguard_backup_alert_sent' ) ) {
			$subject = sprintf(
				/* translators: %s: site name. */
				__( '[%s] Backup is stale', 'site-guardian' ),
				wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES )
			);
			$body    = '<p>' . esc_html( (string) $message ) . '</p>';

			$sent = false;
			if ( class_exists( '\AnsariAi\SiteGuardian\Modules\EmailNotify\EmailNotify' ) ) {
				/** @var \AnsariAi\SiteGuardian\Modules\EmailNotify\EmailNotify $mailer */
				$mailer = \AnsariAi\SiteGuardian\Plugin::instance()->module( 'email-notify' );
				if ( null !== $mailer ) {
					$sent = $mailer->send( $email, $subject, $body );
				}
			}
			if ( ! $sent ) {
				$sent = wp_mail( $email, $subject, $body );
			}

			if ( $sent ) {
				set_transient( 'sguard_backup_alert_sent', 1, $max );
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
			esc_html__( 'Site Guardian:', 'site-guardian' ),
			esc_html( $message )
		);
	}
}
