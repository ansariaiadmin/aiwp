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
 * @package AnsariAi\StoreHealth
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

spl_autoload_register(
	static function ( string $class ): void {
		$map = [
		'AnsariAi\\StoreHealth\\Activator' => __DIR__ . '/../src/Activator.php',
		'AnsariAi\\StoreHealth\\Assets' => __DIR__ . '/../src/Assets.php',
		'AnsariAi\\StoreHealth\\Contracts\\ModuleInterface' => __DIR__ . '/../src/Contracts/ModuleInterface.php',
		'AnsariAi\\StoreHealth\\Installer' => __DIR__ . '/../src/Installer.php',
		'AnsariAi\\StoreHealth\\Logger' => __DIR__ . '/../src/Logger.php',
		'AnsariAi\\StoreHealth\\Modules\\CronReport\\CronReport' => __DIR__ . '/../src/Modules/CronReport/CronReport.php',
		'AnsariAi\\StoreHealth\\Modules\\CsvExport\\CsvExport' => __DIR__ . '/../src/Modules/CsvExport/CsvExport.php',
		'AnsariAi\\StoreHealth\\Modules\\DbTable\\DbTable' => __DIR__ . '/../src/Modules/DbTable/DbTable.php',
		'AnsariAi\\StoreHealth\\Modules\\EmailNotify\\EmailNotify' => __DIR__ . '/../src/Modules/EmailNotify/EmailNotify.php',
		'AnsariAi\\StoreHealth\\Modules\\LicenseClient\\LicenseClient' => __DIR__ . '/../src/Modules/LicenseClient/LicenseClient.php',
		'AnsariAi\\StoreHealth\\Modules\\RestApi\\RestApi' => __DIR__ . '/../src/Modules/RestApi/RestApi.php',
		'AnsariAi\\StoreHealth\\Modules\\Scheduler\\Scheduler' => __DIR__ . '/../src/Modules/Scheduler/Scheduler.php',
		'AnsariAi\\StoreHealth\\Modules\\SettingsPage\\SettingsPage' => __DIR__ . '/../src/Modules/SettingsPage/SettingsPage.php',
		'AnsariAi\\StoreHealth\\Plugin' => __DIR__ . '/../src/Plugin.php',
		'AnsariAi\\StoreHealth\\Settings' => __DIR__ . '/../src/Settings.php',
		'AnsariAi\\StoreHealth\\Support\\Guard' => __DIR__ . '/../src/Support/Guard.php',
		'AnsariAi\\StoreHealth\\Manifest' => __DIR__ . '/../src/module-manifest.php',
	];

		if ( isset( $map[ $class ] ) ) {
			require $map[ $class ];
		}
	}
);

