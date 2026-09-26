<?php
/**
 * Contract every module entry class must implement.
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

namespace AnsariAi\StoreHealth\Contracts;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

interface ModuleInterface {

	/**
	 * Stable module id, matching the module's module.json "id".
	 */
	public function id(): string;

	/**
	 * Return a list of unmet-requirement messages, or an empty array when
	 * every requirement (PHP/WP/WooCommerce version, other modules, PHP
	 * extensions, ...) is satisfied.
	 *
	 * MUST NOT throw. A non-empty return causes the module to be skipped
	 * (register()/boot() are never called) and queues an admin notice with
	 * the returned messages, without breaking the rest of the plugin.
	 *
	 * @return string[]
	 */
	public function requirements(): array;

	/**
	 * Register WordPress hooks only (add_action/add_filter/register_*).
	 * Must be idempotent and cheap: this runs on every request for every
	 * module whose requirements() passed.
	 */
	public function register(): void;

	/**
	 * Cross-module boot logic. Called after register() has been called on
	 * every enabled module, so it is safe to assume their hooks are wired.
	 */
	public function boot(): void;
}
