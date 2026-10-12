<?php

declare(strict_types=1);

it('holds phones in transit until the destination branch receives them', function () {
    $shop = registerShop();
    unlimited('shop-a');
    $city = call($shop, 'POST', '/admin/branches', ['code' => 'CITY', 'name' => 'City'])->assertCreated()['id'];
    buy($shop, [IMEIS[0]]);

    $t = call($shop, 'POST', '/transfers', ['to_branch_id' => $city, 'imeis' => [IMEIS[0]]])->assertCreated()['id'];
    call($shop, 'POST', '/sales', ['sale_date' => today()->toDateString(), 'received' => '100', 'items' => [['imei' => IMEIS[0], 'price' => '100']]])
        ->assertStatus(409); // in transit: cannot be sold
    call($shop, 'POST', "/transfers/{$t}/receive")->assertForbidden()->assertJsonPath('code', 'WRONG_BRANCH');

    call($shop, 'POST', "/transfers/{$t}/receive", [], $city)->assertOk();
    call($shop, 'GET', '/inventory?status=in_stock', [], $city)->assertJsonPath('meta.total', 1);
    call($shop, 'GET', '/inventory?status=in_stock')->assertJsonPath('meta.total', 0);
    call($shop, 'POST', "/transfers/{$t}/cancel")->assertStatus(409)->assertJsonPath('code', 'NOT_PENDING');
});

it('returns phones to stock when the sender cancels', function () {
    $shop = registerShop();
    unlimited('shop-a');
    $city = call($shop, 'POST', '/admin/branches', ['code' => 'CITY', 'name' => 'City'])->assertCreated()['id'];
    buy($shop, [IMEIS[0]]);
    $t = call($shop, 'POST', '/transfers', ['to_branch_id' => $city, 'imeis' => [IMEIS[0]]])->assertCreated()['id'];

    call($shop, 'POST', "/transfers/{$t}/cancel")->assertOk();
    call($shop, 'GET', '/inventory?status=in_stock')->assertJsonPath('meta.total', 1);
});
