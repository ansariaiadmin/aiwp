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
			'description' => 'Where the weekly health report is delivered.',
			'help' => 'Enter one or more <b>email addresses</b> that should receive store health reports.<br><ul><li>Separate multiple addresses with a comma.</li><li>Each address must be valid — bounced mail is silently dropped by your host.</li><li>Prefer a group mailbox (e.g. <code>ops@…</code>) so reports survive staff changes.</li></ul>',
			'example' => 'owner@example.com, ops@example.com',
			'illustration' => 'email',
		],
		[
			'key' => 'low_stock_threshold',
			'type' => 'number',
			'label' => 'Low stock threshold',
			'default' => 5,
			'choices' => [
			],
			'tab' => 'general',
			'description' => 'Products at or below this stock level are flagged.',
			'help' => 'A product is reported as <i>low stock</i> when its remaining quantity is <b>less than or equal to</b> this number.<br><ul><li>Use <code>0</code> to flag only out-of-stock items.</li><li>High-turnover stores typically set 5–10; slow luxury stores 1–2.</li></ul>',
			'example' => '5',
			'illustration' => 'chart',
		],
		[
			'key' => 'enable_daily_digest',
			'type' => 'checkbox',
			'label' => 'Send daily digest',
			'default' => true,
			'choices' => [
			],
			'tab' => 'general',
			'description' => 'Send a short summary every morning instead of only the weekly report.',
			'help' => 'When enabled, a compact digest email arrives <b>every day at 07:00 site time</b> summarising overnight orders, low-stock products and failed webhooks.<br><br>Turn this <i>off</i> if you already watch the dashboard daily — too many emails is the #1 reason reports get ignored.',
			'example' => 'On for busy stores, Off for small shops',
			'illustration' => 'bell',
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
			'name' => 'Mohammad Ansari',
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
				'description' => 'Where the weekly health report is delivered.',
				'help' => 'Enter one or more <b>email addresses</b> that should receive store health reports.<br><ul><li>Separate multiple addresses with a comma.</li><li>Each address must be valid — bounced mail is silently dropped by your host.</li><li>Prefer a group mailbox (e.g. <code>ops@…</code>) so reports survive staff changes.</li></ul>',
				'example' => 'owner@example.com, ops@example.com',
				'illustration' => 'email',
			],
			[
				'key' => 'low_stock_threshold',
				'type' => 'number',
				'label' => 'Low stock threshold',
				'default' => 5,
				'tab' => 'general',
				'description' => 'Products at or below this stock level are flagged.',
				'help' => 'A product is reported as <i>low stock</i> when its remaining quantity is <b>less than or equal to</b> this number.<br><ul><li>Use <code>0</code> to flag only out-of-stock items.</li><li>High-turnover stores typically set 5–10; slow luxury stores 1–2.</li></ul>',
				'example' => '5',
				'illustration' => 'chart',
			],
			[
				'key' => 'enable_daily_digest',
				'type' => 'checkbox',
				'label' => 'Send daily digest',
				'default' => true,
				'tab' => 'general',
				'description' => 'Send a short summary every morning instead of only the weekly report.',
				'help' => 'When enabled, a compact digest email arrives <b>every day at 07:00 site time</b> summarising overnight orders, low-stock products and failed webhooks.<br><br>Turn this <i>off</i> if you already watch the dashboard daily — too many emails is the #1 reason reports get ignored.',
				'example' => 'On for busy stores, Off for small shops',
				'illustration' => 'bell',
			],
		],
		'features' => [
			'Once a day, collect order count/revenue for the last 24h, low-stock product count, and failed-payment count, then email the report_email address using the email-notify module and store a CSV snapshot via csv-export.',
			'Expose a read-only REST endpoint (rest-api module) at /wp-json/store-health/v1/summary returning the same metrics as JSON for dashboard widgets, gated by the manage_woocommerce capability.',
		],
	];
}

