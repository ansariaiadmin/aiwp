<?php
/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by tools/compose.php from the plugin spec. Re-run the build to
 * regenerate after changing the spec's "modules" or "options" arrays.
 *
 * phpcs:disable -- this entire file is machine-generated data (module
 * class map, settings fields and the raw spec array); WordPress Coding
 * Standards array-formatting/alignment rules are not meaningful for it.
 *
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

namespace AnsariAi\StoreHealth;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Manifest {

	/**
	 * Module id => fully-qualified class name, in the exact order modules
	 * were resolved (dependencies before dependents).
	 *
	 * @var array<string,class-string<\AnsariAi\StoreHealth\Contracts\ModuleInterface>>
	 */
	public const MODULE_CLASSES = [
		'settings-page' => 'AnsariAi\\StoreHealth\\Modules\\SettingsPage\\SettingsPage',
		'scheduler' => 'AnsariAi\\StoreHealth\\Modules\\Scheduler\\Scheduler',
		'db-table' => 'AnsariAi\\StoreHealth\\Modules\\DbTable\\DbTable',
		'rest-api' => 'AnsariAi\\StoreHealth\\Modules\\RestApi\\RestApi',
		'email-notify' => 'AnsariAi\\StoreHealth\\Modules\\EmailNotify\\EmailNotify',
		'csv-export' => 'AnsariAi\\StoreHealth\\Modules\\CsvExport\\CsvExport',
		'cron-report' => 'AnsariAi\\StoreHealth\\Modules\\CronReport\\CronReport',
		'license-client' => 'AnsariAi\\StoreHealth\\Modules\\LicenseClient\\LicenseClient',
	];

	/**
	 * Settings fields declared in the plugin spec's "options" array.
	 *
	 * @var array<int,array<string,mixed>>
	 */
	public const SETTINGS_FIELDS = [
		[
			'key' => 'report_email',
			'type' => 'email',
			'label' => 'Report recipient',
			'default' => '',
			'choices' => [
			],
			'tab' => 'general',
		],
		[
			'key' => 'low_stock_threshold',
			'type' => 'number',
			'label' => 'Low stock threshold',
			'default' => 5,
			'choices' => [
			],
			'tab' => 'general',
		],
		[
			'key' => 'enable_daily_digest',
			'type' => 'checkbox',
			'label' => 'Send daily digest',
			'default' => true,
			'choices' => [
			],
			'tab' => 'general',
		],
	];

	/**
	 * Full plugin spec, minified, for modules that need metadata (license
	 * server URL, product id, etc) without re-parsing a spec file at
	 * runtime.
	 *
	 * @var array<string,mixed>
	 */
	public const SPEC = [
		'slug' => 'store-health',
		'name' => 'Store Health Assistant',
		'description' => 'Daily WooCommerce store health digest with configurable alert thresholds.',
		'namespace' => 'AnsariAi\\StoreHealth',
		'prefix' => 'ansariai_sh',
		'textDomain' => 'store-health',
		'version' => '1.0.0',
		'author' => [
			'name' => 'AnsariAi',
			'uri' => 'https://ansariai.ir',
		],
		'requires' => [
			'php' => '8.1',
			'wp' => '6.8',
			'woo' => '9.0',
		],
		'license' => [
			'enabled' => true,
			'server' => 'https://ansariai.ir/api/v1',
			'productId' => 'store-health',
		],
		'modules' => [
			'settings-page',
			'scheduler',
			'db-table',
			'rest-api',
			'email-notify',
			'csv-export',
			'cron-report',
			'license-client',
		],
		'options' => [
			[
				'key' => 'report_email',
				'type' => 'email',
				'label' => 'Report recipient',
				'default' => '',
				'tab' => 'general',
			],
			[
				'key' => 'low_stock_threshold',
				'type' => 'number',
				'label' => 'Low stock threshold',
				'default' => 5,
				'tab' => 'general',
			],
			[
				'key' => 'enable_daily_digest',
				'type' => 'checkbox',
				'label' => 'Send daily digest',
				'default' => true,
				'tab' => 'general',
			],
		],
		'features' => [
			'Once a day, collect order count/revenue for the last 24h, low-stock product count, and failed-payment count, then email the report_email address using the email-notify module and store a CSV snapshot via csv-export.',
			'Expose a read-only REST endpoint (rest-api module) at /wp-json/store-health/v1/summary returning the same metrics as JSON for dashboard widgets, gated by the manage_woocommerce capability.',
		],
	];
}

