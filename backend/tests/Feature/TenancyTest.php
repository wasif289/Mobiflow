<?php

declare(strict_types=1);

it('never shows one shop\'s data to another shop', function () {
    $a = registerShop('shop-a');
    $b = registerShop('shop-b');
    $bought = buy($a, [IMEIS[0]]);

    call($b, 'GET', '/catalog/brands')->assertOk()->assertJsonPath('meta.total', 0);
    call($b, 'GET', '/purchases')->assertOk()->assertJsonPath('meta.total', 0);
    call($b, 'GET', "/purchases/{$bought['purchase']}")->assertNotFound();
    call($b, 'GET', '/inventory')->assertOk()->assertJsonPath('meta.total', 0);
    call($a, 'GET', '/inventory')->assertOk()->assertJsonPath('meta.total', 1);
});

it('rejects an unknown shop code', function () {
    $this->flushHeaders()->withHeaders(['X-Tenant' => 'nope'])->postJson('/api/v1/auth/login', ['username' => 'x', 'password' => 'y'])
        ->assertNotFound()->assertJsonPath('code', 'TENANT_NOT_FOUND');
});

it('does not accept a token from another shop', function () {
    $a = registerShop('shop-a');
    registerShop('shop-b');
    call(['tenant' => 'shop-b', 'token' => $a['token'], 'branch' => 0], 'GET', '/auth/me')->assertUnauthorized();
});

it('blocks a second branch on the Starter plan with a clear 402', function () {
    $a = registerShop('shop-a');
    call($a, 'POST', '/admin/branches', ['code' => 'CITY', 'name' => 'City'])->assertStatus(402)->assertJsonPath('code', 'PLAN_LIMIT_REACHED');
    unlimited('shop-a');
    call($a, 'POST', '/admin/branches', ['code' => 'CITY', 'name' => 'City'])->assertCreated();
});
