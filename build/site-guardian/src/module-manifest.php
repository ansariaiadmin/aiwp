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
 * @package AnsariAi\SiteGuardian
 */

declare(strict_types=1);

namespace AnsariAi\SiteGuardian;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Manifest {

	/**
	 * Module id => fully-qualified class name, in the exact order modules
	 * were resolved (dependencies before dependents).
	 *
	 * @var array<string,class-string<\AnsariAi\SiteGuardian\Contracts\ModuleInterface>>
	 */
	public const MODULE_CLASSES = [
		'settings-page' => 'AnsariAi\\SiteGuardian\\Modules\\SettingsPage\\SettingsPage',
		'health-scan' => 'AnsariAi\\SiteGuardian\\Modules\\HealthScan\\HealthScan',
		'backup-alert' => 'AnsariAi\\SiteGuardian\\Modules\\BackupAlert\\BackupAlert',
		'email-notify' => 'AnsariAi\\SiteGuardian\\Modules\\EmailNotify\\EmailNotify',
		'rest-api' => 'AnsariAi\\SiteGuardian\\Modules\\RestApi\\RestApi',
		'scheduler' => 'AnsariAi\\SiteGuardian\\Modules\\Scheduler\\Scheduler',
		'cron-report' => 'AnsariAi\\SiteGuardian\\Modules\\CronReport\\CronReport',
		'csv-export' => 'AnsariAi\\SiteGuardian\\Modules\\CsvExport\\CsvExport',
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
			'label' => 'Digest recipient',
			'default' => '',
			'choices' => [
			],
			'tab' => 'reports',
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
		'slug' => 'site-guardian',
		'name' => 'Site Guardian',
		'description' => 'Real-time site health scoring, backup freshness alerts, scheduled email digests and a REST status API - zero configuration needed.',
		'namespace' => 'AnsariAi\\SiteGuardian',
		'prefix' => 'sguard',
		'textDomain' => 'site-guardian',
		'version' => '1.0.0',
		'author' => [
			'name' => 'Mohammad Ansari',
			'uri' => 'https://ansariai.ir',
		],
		'requires' => [
			'php' => '8.1',
			'wp' => '6.4',
		],
		'license' => [
			'enabled' => false,
			'server' => 'https://ansariai.ir/api/v1',
			'productId' => 'site-guardian',
		],
		'modules' => [
			'settings-page',
			'health-scan',
			'backup-alert',
			'email-notify',
			'rest-api',
			'scheduler',
			'cron-report',
			'csv-export',
		],
		'options' => [
			[
				'key' => 'report_email',
				'type' => 'email',
				'label' => 'Digest recipient',
				'default' => '',
				'tab' => 'reports',
			],
		],
		'features' => [
			'Health score dashboard widget with weighted checks',
			'Backup staleness detection with throttled email alerts and SMS hook',
		],
		'glueClass' => 'Glue',
	];
}

