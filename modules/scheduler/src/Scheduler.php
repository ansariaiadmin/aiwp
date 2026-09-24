<?php
/**
 * Background Scheduler module.
 *
 * Wraps Action Scheduler (as_*() functions) when available and transparently
 * falls back to wp-cron (wp_schedule_event() / wp_schedule_single_event())
 * so other modules never need to care which backend actually runs a job.
 *
 * @package VendorPlugin
 */

declare(strict_types=1);

namespace VendorPlugin\Modules\Scheduler;

use VendorPlugin\Contracts\ModuleInterface;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Scheduler implements ModuleInterface {

	private const GROUP = '{{PREFIX}}';

	public function id(): string {
		return 'scheduler';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
		// Register the wp-cron fallback schedule/hook plumbing unconditionally;
		// it is simply unused when Action Scheduler is doing the work.
		add_filter( 'cron_schedules', [ $this, 'register_custom_intervals' ] ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval
	}

	public function boot(): void {
	}

	/**
	 * @param array<string,array{interval:int,display:string}> $schedules
	 *
	 * @return array<string,array{interval:int,display:string}>
	 */
	public function register_custom_intervals( array $schedules ): array {
		$schedules['{{PREFIX}}_five_minutes'] = [
			'interval' => 5 * MINUTE_IN_SECONDS,
			'display'  => __( 'Every 5 Minutes ({{PLUGIN_NAME}})', '{{TEXT_DOMAIN}}' ),
		];

		return $schedules;
	}

	/**
	 * True when the Action Scheduler library functions are loaded (bundled
	 * by WooCommerce or any other active plugin/library).
	 */
	public function has_action_scheduler(): bool {
		/**
		 * Filters which backend the scheduler should prefer. Returning
		 * 'wp-cron' here forces the fallback even when Action Scheduler is
		 * available (useful for isolated testing).
		 *
		 * @param string $backend 'action-scheduler'|'wp-cron'|'' (auto-detect).
		 */
		$forced = (string) apply_filters( '{{PREFIX}}_scheduler_backend', '' );

		if ( 'wp-cron' === $forced ) {
			return false;
		}

		return function_exists( 'as_schedule_recurring_action' ) && function_exists( 'as_enqueue_async_action' );
	}

	/**
	 * Schedules a recurring job. $hook is fired with $args every $interval
	 * seconds, starting at $start_timestamp (defaults to now + $interval).
	 *
	 * @param array<int,mixed> $args
	 */
	public function schedule_recurring( string $hook, int $interval, array $args = [], ?int $start_timestamp = null ): void {
		$start_timestamp ??= time() + $interval;

		if ( $this->has_action_scheduler() ) {
			if ( false === as_next_scheduled_action( $hook, $args, self::GROUP ) ) {
				as_schedule_recurring_action( $start_timestamp, $interval, $hook, $args, self::GROUP );
			}

			return;
		}

		if ( ! wp_next_scheduled( $hook, $args ) ) {
			$recurrence = $this->closest_wp_cron_recurrence( $interval );
			wp_schedule_event( $start_timestamp, $recurrence, $hook, $args );
		}
	}

	/**
	 * Schedules a single, near-immediate async job (e.g. "send this email
	 * in the background instead of blocking the current request").
	 *
	 * @param array<int,mixed> $args
	 */
	public function schedule_async( string $hook, array $args = [] ): void {
		if ( $this->has_action_scheduler() ) {
			as_enqueue_async_action( $hook, $args, self::GROUP );

			return;
		}

		if ( ! wp_next_scheduled( $hook, $args ) ) {
			wp_schedule_single_event( time() + 1, $hook, $args );
		}
	}

	/**
	 * Cancels every scheduled occurrence of $hook (all backends), typically
	 * called from a module's deactivation handler.
	 *
	 * @param array<int,mixed> $args
	 */
	public function unschedule( string $hook, array $args = [] ): void {
		if ( $this->has_action_scheduler() && function_exists( 'as_unschedule_all_actions' ) ) {
			as_unschedule_all_actions( $hook, $args, self::GROUP );
		}

		$timestamp = wp_next_scheduled( $hook, $args );

		while ( false !== $timestamp ) {
			wp_unschedule_event( $timestamp, $hook, $args );
			$timestamp = wp_next_scheduled( $hook, $args );
		}

		wp_clear_scheduled_hook( $hook, $args );
	}

	/**
	 * Maps an arbitrary interval (in seconds) to the closest available
	 * wp-cron recurrence name, since wp-cron (unlike Action Scheduler)
	 * only supports named recurrences.
	 */
	private function closest_wp_cron_recurrence( int $interval_seconds ): string {
		if ( $interval_seconds <= 5 * MINUTE_IN_SECONDS ) {
			return '{{PREFIX}}_five_minutes';
		}

		if ( $interval_seconds <= HOUR_IN_SECONDS ) {
			return 'hourly';
		}

		if ( $interval_seconds <= DAY_IN_SECONDS ) {
			return 'daily';
		}

		return 'weekly' === $this->has_weekly_schedule() ? 'weekly' : 'daily';
	}

	private function has_weekly_schedule(): string {
		$schedules = wp_get_schedules();

		return isset( $schedules['weekly'] ) ? 'weekly' : 'daily';
	}
}
