<?php
/**
 * Site Health Scanner module.
 *
 * Runs real, dependency-free environment checks on the host site, scores
 * them 0-100 (weighted), caches the result in a non-autoloaded option,
 * refreshes it on a WP-Cron schedule, exposes it via a REST route and
 * renders an admin dashboard widget.
 *
 * @package AnsariAi\SiteGuardian
 */

declare(strict_types=1);

namespace AnsariAi\SiteGuardian\Modules\HealthScan;

use AnsariAi\SiteGuardian\Contracts\ModuleInterface;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class HealthScan implements ModuleInterface {

	public const CACHE_KEY  = 'sguard_last_scan';
	public const HOOK       = 'sguard_run_health_scan';
	public const CRON_EVENT = 'sguard_health_scan';

	public function id(): string {
		return 'health-scan';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
		add_action( self::HOOK, array( $this, 'scan_and_cache' ) );
		add_action( 'rest_api_init', array( $this, 'register_rest_route' ) );
		add_action( 'wp_dashboard_setup', array( $this, 'register_widget' ) );
	}

	public function boot(): void {
		if ( ! wp_next_scheduled( self::CRON_EVENT ) ) {
			wp_schedule_event( time() + MINUTE_IN_SECONDS, 'daily', self::CRON_EVENT );
		}
		add_action( self::CRON_EVENT, array( $this, 'scan_and_cache' ) );
	}

	/**
	 * Individual checks. Each returns slug/status(pass|warn|fail)/label/
	 * message/weight. Filterable so glue code can add domain checks.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public function checks(): array {
		$checks = array();

		$php_ok   = version_compare( PHP_VERSION, '8.1.0', '>=' );
		$checks[] = array(
			'slug'    => 'php_version',
			'status'  => $php_ok ? 'pass' : ( version_compare( PHP_VERSION, '7.4.0', '>=' ) ? 'warn' : 'fail' ),
			'label'   => __( 'PHP version', 'site-guardian' ),
			'message' => sprintf( /* translators: %s: PHP version. */ __( 'Server is running PHP %s.', 'site-guardian' ), PHP_VERSION ),
			'weight'  => 20,
		);

		$wp_version = get_bloginfo( 'version' );
		$checks[]   = array(
			'slug'    => 'wp_version',
			'status'  => version_compare( (string) $wp_version, '6.0', '>=' ) ? 'pass' : 'warn',
			'label'   => __( 'WordPress version', 'site-guardian' ),
			/* translators: %s: WordPress version. */
			'message' => sprintf( __( 'Running WordPress %s.', 'site-guardian' ), (string) $wp_version ),
			'weight'  => 15,
		);

		$debug_on = defined( 'WP_DEBUG' ) && WP_DEBUG;
		$checks[] = array(
			'slug'    => 'wp_debug',
			'status'  => $debug_on ? 'warn' : 'pass',
			'label'   => __( 'Debug mode', 'site-guardian' ),
			'message' => $debug_on
				? __( 'WP_DEBUG is enabled - disable it on production sites.', 'site-guardian' )
				: __( 'WP_DEBUG is off.', 'site-guardian' ),
			'weight'  => 10,
		);

		$uploads  = wp_upload_dir();
		$writable = is_writable( (string) ( $uploads['basedir'] ?? '' ) );
		$checks[] = array(
			'slug'    => 'uploads_writable',
			'status'  => $writable ? 'pass' : 'fail',
			'label'   => __( 'Uploads directory', 'site-guardian' ),
			'message' => $writable
				? __( 'The uploads directory is writable.', 'site-guardian' )
				: __( 'The uploads directory is NOT writable.', 'site-guardian' ),
			'weight'  => 15,
		);

		global $wpdb;
		$table_count = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery
		$checks[]    = array(
			'slug'    => 'db_tables',
			'status'  => $table_count > 5000 ? 'warn' : 'pass',
			'label'   => __( 'Database size', 'site-guardian' ),
			/* translators: %d: number of database tables. */
			'message' => sprintf( __( '%d database tables found.', 'site-guardian' ), $table_count ),
			'weight'  => 10,
		);

		$cron_pending = get_option( 'cron', array() );
		$cron_count   = is_array( $cron_pending ) ? count( $cron_pending ) : 0;
		$checks[]     = array(
			'slug'    => 'cron',
			'status'  => $cron_count > 0 ? 'pass' : 'warn',
			'label'   => __( 'WP-Cron', 'site-guardian' ),
			'message' => $cron_count > 0
				? __( 'Scheduled events are registered.', 'site-guardian' )
				: __( 'No scheduled events found - WP-Cron may be disabled.', 'site-guardian' ),
			'weight'  => 10,
		);

		$checks[] = array(
			'slug'    => 'https',
			'status'  => is_ssl() ? 'pass' : 'warn',
			'label'   => __( 'HTTPS', 'site-guardian' ),
			'message' => is_ssl()
				? __( 'Site is served over HTTPS.', 'site-guardian' )
				: __( 'Site is not using HTTPS.', 'site-guardian' ),
			'weight'  => 20,
		);

		/**
		 * Filters the list of health checks before scoring.
		 *
		 * @param array<int,array<string,mixed>> $checks
		 */
		return (array) apply_filters( 'sguard_health_checks', $checks );
	}

	/**
	 * Runs all checks and computes a weighted 0-100 score.
	 *
	 * @return array{score:int,status:string,checked_at:string,checks:array<int,array<string,mixed>>}
	 */
	public function scan(): array {
		$checks = $this->checks();
		$total  = 0;
		$got    = 0;

		foreach ( $checks as $check ) {
			$weight = (int) ( $check['weight'] ?? 1 );
			$total += $weight;
			$status = (string) ( $check['status'] ?? 'warn' );
			if ( 'pass' === $status ) {
				$got += $weight;
			} elseif ( 'warn' === $status ) {
				$got += (int) round( $weight / 2 );
			}
		}

		$score = $total > 0 ? (int) round( ( $got / $total ) * 100 ) : 0;

		/**
		 * Filters the computed health score (0-100).
		 *
		 * @param int                            $score
		 * @param array<int,array<string,mixed>> $checks
		 */
		$score = max( 0, min( 100, (int) apply_filters( 'sguard_health_score', $score, $checks ) ) );

		$result = array(
			'score'      => $score,
			'status'     => $score >= 80 ? 'good' : ( $score >= 50 ? 'fair' : 'poor' ),
			'checked_at' => gmdate( 'c' ),
			'checks'     => $checks,
		);

		/**
		 * Fires after a scan completed, e.g. for alerting integrations.
		 *
		 * @param array<string,mixed> $result
		 */
		do_action( 'sguard_health_scored', $result );

		return $result;
	}

	/**
	 * Runs a fresh scan and stores it in the cache option.
	 *
	 * @return array<string,mixed>
	 */
	public function scan_and_cache(): array {
		$result = $this->scan();
		update_option( self::CACHE_KEY, wp_json_encode( $result ), false );
		return $result;
	}

	/**
	 * Returns the cached scan, running one if none exists yet.
	 *
	 * @return array<string,mixed>
	 */
	public function cached(): array {
		$raw = (string) get_option( self::CACHE_KEY, '' );
		if ( '' !== $raw ) {
			$decoded = json_decode( $raw, true );
			if ( is_array( $decoded ) ) {
				return $decoded;
			}
		}
		return $this->scan_and_cache();
	}

	public function register_rest_route(): void {
		register_rest_route(
			'site-guardian/v1',
			'/health',
			array(
				'methods'             => 'GET',
				'permission_callback' => static fn (): bool => current_user_can( 'manage_options' ),
				'callback'            => fn (): \WP_REST_Response => rest_ensure_response( $this->cached() ),
			)
		);
	}

	public function register_widget(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		wp_add_dashboard_widget(
			'sguard_health_widget',
			__( 'Site Health', 'site-guardian' ),
			array( $this, 'render_widget' )
		);
	}

	public function render_widget(): void {
		$data = $this->cached();
		echo '<p><strong>';
		/* translators: %d: health score. */
		printf( esc_html__( 'Health score: %d/100', 'site-guardian' ), (int) ( $data['score'] ?? 0 ) );
		echo '</strong></p><ul style="margin:0">';
		foreach ( (array) ( $data['checks'] ?? array() ) as $check ) {
			$icon   = 'pass' === $check['status'] ? '&#x2705;' : ( 'warn' === $check['status'] ? '&#x26A0;&#xFE0F;' : '&#x274C;' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- fixed entity set.
			printf(
				'<li>%1$s %2$s &mdash; %3$s</li>',
				$icon, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- fixed entity set.
				esc_html( (string) $check['label'] ),
				esc_html( (string) $check['message'] )
			);
		}
		echo '</ul>';
	}
}
