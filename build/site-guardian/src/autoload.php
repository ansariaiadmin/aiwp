<?php
/**
 * GENERATED FILE — do not edit by hand.
 *
 * Minimal PSR-4 classmap autoloader for the composed plugin. Generated plugins
 * do not ship vendor/autoload.php: this classmap is produced once at build
 * time by tools/compose.php, so activating the plugin never requires running
 * `composer install` on the target site.
 *
 * phpcs:disable -- the $map array below is machine-generated data; WordPress
 * Coding Standards array-formatting/alignment rules are not meaningful for it.
 *
 * @package AnsariAi\SiteGuardian
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

spl_autoload_register(
	static function ( string $class ): void {
		$map = [
		'AnsariAi\\SiteGuardian\\Activator' => __DIR__ . '/../src/Activator.php',
		'AnsariAi\\SiteGuardian\\Assets' => __DIR__ . '/../src/Assets.php',
		'AnsariAi\\SiteGuardian\\Contracts\\ModuleInterface' => __DIR__ . '/../src/Contracts/ModuleInterface.php',
		'AnsariAi\\SiteGuardian\\Installer' => __DIR__ . '/../src/Installer.php',
		'AnsariAi\\SiteGuardian\\Logger' => __DIR__ . '/../src/Logger.php',
		'AnsariAi\\SiteGuardian\\Modules\\BackupAlert\\BackupAlert' => __DIR__ . '/../src/Modules/BackupAlert/BackupAlert.php',
		'AnsariAi\\SiteGuardian\\Modules\\CronReport\\CronReport' => __DIR__ . '/../src/Modules/CronReport/CronReport.php',
		'AnsariAi\\SiteGuardian\\Modules\\CsvExport\\CsvExport' => __DIR__ . '/../src/Modules/CsvExport/CsvExport.php',
		'AnsariAi\\SiteGuardian\\Modules\\EmailNotify\\EmailNotify' => __DIR__ . '/../src/Modules/EmailNotify/EmailNotify.php',
		'AnsariAi\\SiteGuardian\\Modules\\HealthScan\\HealthScan' => __DIR__ . '/../src/Modules/HealthScan/HealthScan.php',
		'AnsariAi\\SiteGuardian\\Modules\\RestApi\\RestApi' => __DIR__ . '/../src/Modules/RestApi/RestApi.php',
		'AnsariAi\\SiteGuardian\\Modules\\Scheduler\\Scheduler' => __DIR__ . '/../src/Modules/Scheduler/Scheduler.php',
		'AnsariAi\\SiteGuardian\\Modules\\SettingsPage\\SettingsPage' => __DIR__ . '/../src/Modules/SettingsPage/SettingsPage.php',
		'AnsariAi\\SiteGuardian\\Plugin' => __DIR__ . '/../src/Plugin.php',
		'AnsariAi\\SiteGuardian\\Settings' => __DIR__ . '/../src/Settings.php',
		'AnsariAi\\SiteGuardian\\Support\\Guard' => __DIR__ . '/../src/Support/Guard.php',
		'AnsariAi\\SiteGuardian\\Manifest' => __DIR__ . '/../src/module-manifest.php',
	];

		if ( isset( $map[ $class ] ) ) {
			require $map[ $class ];
		}
	}
);

