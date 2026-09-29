<?php
/**
 * Custom DB Table module.
 *
 * Registers this plugin's own dbDelta-managed table (never touches
 * WordPress core or WooCommerce tables) and exposes a small typed
 * repository other modules use instead of writing raw SQL themselves.
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

namespace AnsariAi\StoreHealth\Modules\DbTable;

use AnsariAi\StoreHealth\Contracts\ModuleInterface;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class DbTable implements ModuleInterface {

	public function id(): string {
		return 'db-table';
	}

	public function requirements(): array {
		return [];
	}

	public function register(): void {
		add_filter( 'ansariai_sh_db_schema', [ $this, 'add_schema' ] );
		add_filter( 'ansariai_sh_db_tables', [ $this, 'add_table_name' ] );
	}

	public function boot(): void {
	}

	public static function table_name(): string {
		global $wpdb;

		return $wpdb->prefix . 'ansariai_sh_records';
	}

	/**
	 * @param string[] $statements
	 *
	 * @return string[]
	 */
	public function add_schema( array $statements ): array {
		global $wpdb;

		$table           = self::table_name();
		$charset_collate = $wpdb->get_charset_collate();

		// dbDelta is strict about formatting: two spaces after PRIMARY KEY,
		// KEY/INDEX lines, no backticks around the table name in CREATE TABLE.
		$statements[] = "CREATE TABLE {$table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			record_type VARCHAR(64) NOT NULL DEFAULT '',
			payload LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			KEY record_type (record_type),
			KEY created_at (created_at)
		) {$charset_collate};";

		return $statements;
	}

	/**
	 * @param string[] $tables
	 *
	 * @return string[]
	 */
	public function add_table_name( array $tables ): array {
		$tables[] = self::table_name();

		return $tables;
	}

	/**
	 * Inserts a JSON-encodable record and returns its new id, or 0 on
	 * failure.
	 *
	 * @param array<string,mixed> $payload
	 */
	public static function insert( string $record_type, array $payload ): int {
		global $wpdb;

		$inserted = $wpdb->insert(
			self::table_name(),
			[
				'record_type' => sanitize_key( $record_type ),
				'payload'     => wp_json_encode( $payload ),
				'created_at'  => current_time( 'mysql', true ),
			],
			[ '%s', '%s', '%s' ]
		);

		return false === $inserted ? 0 : (int) $wpdb->insert_id;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function find( int $id ): ?array {
		global $wpdb;

		$table = self::table_name();

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $table is a fixed, non-user-controlled identifier.
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			ARRAY_A
		);

		return null === $row ? null : self::hydrate( $row );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function paginate( string $record_type = '', int $per_page = 20, int $page = 1 ): array {
		global $wpdb;

		$table  = self::table_name();
		$offset = max( 0, ( $page - 1 ) * $per_page );

		if ( '' !== $record_type ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $table is a fixed, non-user-controlled identifier.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT * FROM {$table} WHERE record_type = %s ORDER BY id DESC LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$record_type,
					$per_page,
					$offset
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $table is a fixed, non-user-controlled identifier.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT * FROM {$table} ORDER BY id DESC LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$per_page,
					$offset
				),
				ARRAY_A
			);
		}

		return array_map( [ self::class, 'hydrate' ], (array) $rows );
	}

	public static function delete( int $id ): bool {
		global $wpdb;

		return false !== $wpdb->delete( self::table_name(), [ 'id' => $id ], [ '%d' ] );
	}

	/**
	 * @param array<string,mixed> $row
	 *
	 * @return array<string,mixed>
	 */
	private static function hydrate( array $row ): array {
		$row['payload'] = json_decode( (string) $row['payload'], true ) ?? [];

		return $row;
	}
}
