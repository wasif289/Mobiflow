<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

function makeStaff(array $owner, array $permissions): array
{
    call($owner, 'POST', '/admin/users', ['name' => 'Cashier', 'username' => 'cashier', 'password' => 'Str0ng-pass-1', 'role' => 'staff',
        'branch_ids' => [$owner['branch']], 'permissions' => $permissions])->assertCreated();
    return loginAs($owner['tenant'], 'cashier');
}

it('lets staff do only what they were given', function () {
    $owner = registerShop();
    $staff = makeStaff($owner, ['sales.view', 'sales.create']);

    call($staff, 'GET', '/sales')->assertOk();
    call($staff, 'GET', '/purchases')->assertForbidden()->assertJsonPath('code', 'FORBIDDEN');
    call($staff, 'GET', '/inventory')->assertForbidden();
    call($staff, 'GET', '/admin/users')->assertForbidden();
    call($staff, 'GET', '/billing')->assertForbidden();
    call($staff, 'POST', '/catalog/brands', ['name' => 'X'])->assertForbidden();
});

it('hides cost from staff everywhere', function () {
    $owner = registerShop();
    buy($owner, [IMEIS[0]], '1000');
    $staff = makeStaff($owner, ['inventory.view']);

    call($owner, 'GET', '/inventory')->assertJsonPath('data.0.cost', '1000.00');
    $row = call($staff, 'GET', '/inventory')->assertOk()->json('data.0');
    expect($row)->not->toHaveKey('cost')->not->toHaveKey('profit');
});

it('signs a user out everywhere when they are deactivated', function () {
    $owner = registerShop();
    $staff = makeStaff($owner, ['sales.view']);
    $id = DB::table('users')->where('username', 'cashier')->value('id');

    call($staff, 'GET', '/sales')->assertOk();
    call($owner, 'PUT', "/admin/users/{$id}", ['is_active' => false])->assertOk();
    call($staff, 'GET', '/sales')->assertUnauthorized();
});

it('only lets the owner create admins and never demotes the owner', function () {
    $owner = registerShop();
    call($owner, 'POST', '/admin/users', ['name' => 'Boss 2', 'username' => 'boss2', 'password' => 'Str0ng-pass-1', 'role' => 'admin'])->assertCreated();
    $admin = loginAs($owner['tenant'], 'boss2');
    $admin['branch'] = $owner['branch'];

    call($admin, 'POST', '/admin/users', ['name' => 'Boss 3', 'username' => 'boss3', 'password' => 'Str0ng-pass-1', 'role' => 'admin'])->assertForbidden();
    $ownerId = DB::table('users')->where('username', 'owner')->value('id');
    call($owner, 'PUT', "/admin/users/{$ownerId}", ['role' => 'staff', 'is_active' => false])->assertOk();
    expect(DB::table('users')->where('id', $ownerId)->first(['role', 'is_active']))->role->toBe('owner')->is_active->toBeTrue();
});
