<?php
/**
 * Recurring Report module.
 *
 * Hard-depends on `scheduler` (declared in module.json "requires") to run a
 * recurring job. Softly integrates with `email-notify` and `csv-export`
 * when those modules are also selected in the spec, without hard-requiring
 * either — so a spec can use cron-report purely to fire
 * 'sguard_report_ready' for fully custom glue-code handling.
 *
 * @package AnsariAi\SiteGuardian
 */

declare(strict_types=1);

namespace AnsariAi\SiteGuardian\Modules\CronReport;

use AnsariAi\SiteGuardian\Contracts\ModuleInterface;
use AnsariAi\SiteGuardian\Plugin;
use AnsariAi\SiteGuardian\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CronReport implements ModuleInterface {

	public const HOOK = 'sguard_run_report';

	public function id(): string {
		return 'cron-report';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
		add_action( self::HOOK, [ $this, 'run' ] );
	}

	public function boot(): void {
		$scheduler = Plugin::instance()->module( 'scheduler' );

		if ( null === $scheduler ) {
			return;
		}

		/**
		 * Filters the report interval in seconds. Defaults to once a day.
		 *
		 * @param int $interval_seconds
		 */
		$interval = (int) apply_filters( 'sguard_report_interval', DAY_IN_SECONDS );

		$scheduler->schedule_recurring( self::HOOK, $interval );

		add_action(
			'sguard_deactivate',
			static function () use ( $scheduler ): void {
				$scheduler->unschedule( CronReport::HOOK );
			}
		);
	}

	/**
	 * Runs the report: gathers data, optionally emails it, optionally
	 * stores a CSV snapshot, and always fires 'sguard_report_ready' so
	 * glue code can do anything else with the data.
	 */
	public function run(): void {
		/**
		 * Filters the report data. Modules/glue code should build the
		 * actual metrics here (e.g. WooCommerce order counts via
		 * wc_get_orders(), never raw postmeta queries).
		 *
		 * @param array<string,mixed> $data
		 */
		$data = (array) apply_filters( 'sguard_report_data', [] );

		$email_notify = Plugin::instance()->module( 'email-notify' );
		$recipient    = (string) Settings::get( 'report_email', '' );

		if ( null !== $email_notify && is_email( $recipient ) ) {
			$email_notify->send(
				$recipient,
				sprintf(
					/* translators: %s: site name. */
					__( 'Site Guardian report — %s', 'site-guardian' ),
					get_bloginfo( 'name' )
				),
				$email_notify->wrap_template(
					__( 'Site Guardian report', 'site-guardian' ),
					self::render_html( $data )
				),
				$data
			);
		}

		$csv_export_class = 'AnsariAi\SiteGuardian\\Modules\\CsvExport\\CsvExport';

		if ( class_exists( $csv_export_class ) && isset( $data['rows'] ) && is_array( $data['rows'] ) ) {
			$upload_dir = wp_upload_dir();
			$path       = trailingslashit( $upload_dir['basedir'] ) . 'site-guardian-report-' . gmdate( 'Y-m-d' ) . '.csv';
			$csv_export_class::write_to_file( $path, $data['rows'] );
		}

		/**
		 * Fires after the report has been generated (and optionally
		 * emailed/exported), with the full report data payload.
		 *
		 * @param array<string,mixed> $data
		 */
		do_action( 'sguard_report_ready', $data );
	}

	/**
	 * @param array<string,mixed> $data
	 */
	private static function render_html( array $data ): string {
		$html = '<ul>';

		foreach ( $data as $key => $value ) {
			if ( is_scalar( $value ) ) {
				$html .= sprintf( '<li><strong>%1$s:</strong> %2$s</li>', esc_html( (string) $key ), esc_html( (string) $value ) );
			}
		}

		$html .= '</ul>';

		return $html;
	}
}
