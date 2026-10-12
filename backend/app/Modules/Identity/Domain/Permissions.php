<?php
declare(strict_types=1);

namespace App\Modules\Identity\Domain;

/** Single source of truth for what staff can be allowed to do. Owner/admin always can; "admin" area is never delegable. */
final class Permissions
{
    public const MODULES = [
        'dashboard' => ['view'],
        'catalog'   => ['manage'],
        'purchases' => ['view', 'create'],
        'sales'     => ['view', 'create'],
        'returns'   => ['create'],
        'inventory' => ['view'],
<<<<<<< HEAD
        'transfers' => ['view', 'create'],
=======
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
        'accounts'  => ['view', 'create'],
        'expenses'  => ['view', 'create', 'delete'],
    ];

    public const PRESETS = [
        'Cashier'      => ['dashboard.view', 'sales.view', 'sales.create', 'inventory.view'],
<<<<<<< HEAD
        'Stock keeper' => ['dashboard.view', 'purchases.view', 'purchases.create', 'inventory.view', 'catalog.manage', 'transfers.view', 'transfers.create'],
=======
        'Stock keeper' => ['dashboard.view', 'purchases.view', 'purchases.create', 'inventory.view', 'catalog.manage'],
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
        'View only'    => ['dashboard.view', 'purchases.view', 'sales.view', 'inventory.view', 'accounts.view', 'expenses.view'],
    ];

    /** @return list<string> */
    public static function all(): array
    {
        $out = [];
        foreach (self::MODULES as $module => $actions) {
            foreach ($actions as $a) {
                $out[] = "{$module}.{$a}";
            }
        }
        return $out;
    }
}
