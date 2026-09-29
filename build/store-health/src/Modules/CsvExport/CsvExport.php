<?php
/**
 * CSV Export module.
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

namespace AnsariAi\StoreHealth\Modules\CsvExport;

use AnsariAi\StoreHealth\Contracts\ModuleInterface;
use AnsariAi\StoreHealth\Support\Guard;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CsvExport implements ModuleInterface {

	public function id(): string {
		return 'csv-export';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
		add_action( 'admin_post_ansariai_sh_export_csv', [ $this, 'handle_download' ] );
	}

	public function boot(): void {
	}

	/**
	 * Handles a nonce + capability guarded CSV download request.
	 */
	public function handle_download(): void {
		Guard::verify_write( 'ansariai_sh_export_csv', '_wpnonce', 'manage_options' );

		/**
		 * Filters the rows to export. Each row is an associative array;
		 * the header row is derived from the keys of the first row.
		 *
		 * @param array<int,array<string,mixed>> $rows
		 */
		$rows = (array) apply_filters( 'ansariai_sh_csv_export_rows', [] );

		$filename = sanitize_file_name( 'store-health-export-' . gmdate( 'Y-m-d' ) . '.csv' );

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );

		echo self::to_csv_string( $rows ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- raw CSV payload, not HTML.
		exit;
	}

	/**
	 * Builds a CSV string in memory. Suitable for small/medium datasets or
	 * as an email attachment payload.
	 *
	 * @param array<int,array<string,mixed>> $rows
	 */
	public static function to_csv_string( array $rows ): string {
		if ( [] === $rows ) {
			return '';
		}

		// WP_Filesystem has no equivalent of an in-memory php://temp stream
		// with fputcsv()'s CSV-escaping semantics, so a raw stream handle is
		// used here; nothing is written to a persistent, user-reachable path.
		$handle = fopen( 'php://temp', 'r+' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( false === $handle ) {
			return '';
		}

		fputcsv( $handle, array_keys( $rows[0] ) );

		foreach ( $rows as $row ) {
			fputcsv( $handle, array_map( static fn ( $value ): string => is_scalar( $value ) ? (string) $value : wp_json_encode( $value ), $row ) );
		}

		rewind( $handle );
		$csv = stream_get_contents( $handle );
		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		return false === $csv ? '' : $csv;
	}

	/**
	 * Writes rows directly to a file path (e.g. a private uploads
	 * sub-directory) without holding the whole CSV in memory, for larger
	 * exports produced by cron-report snapshots.
	 *
	 * @param array<int,array<string,mixed>> $rows
	 */
	public static function write_to_file( string $path, array $rows ): bool {
		if ( [] === $rows ) {
			return false;
		}

		// fputcsv() requires a native stream resource; WP_Filesystem does not
		// expose one, so a raw handle is used. $path is always built from
		// wp_upload_dir()['basedir'] plus a hardcoded, sanitized filename by
		// callers (see cron-report), never from unsanitized user input.
		$handle = fopen( $path, 'w' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( false === $handle ) {
			return false;
		}

		fputcsv( $handle, array_keys( $rows[0] ) );

		foreach ( $rows as $row ) {
			fputcsv( $handle, array_map( static fn ( $value ): string => is_scalar( $value ) ? (string) $value : wp_json_encode( $value ), $row ) );
		}

		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		return true;
	}
}
