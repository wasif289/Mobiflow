<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

function sell(array $shop, array $imeis, string $price, ?int $customer = null, ?string $received = null)
{
    return call($shop, 'POST', '/sales', array_filter([
        'customer_id' => $customer, 'sale_date' => today()->toDateString(), 'received' => $received ?? ($customer ? '0' : (string) ($price * count($imeis))),
        'items' => array_map(fn ($i) => ['imei' => $i, 'price' => $price], $imeis),
    ], fn ($v) => $v !== null));
}

it('posts purchases to the supplier ledger and credit sales to the customer ledger', function () {
    $shop = registerShop();
    buy($shop, [IMEIS[0], IMEIS[1]], '1000', '500'); // owe the supplier 2000 - 500
    $customer = call($shop, 'POST', '/customers', ['name' => 'Ali'])->assertCreated()['id'];
    sell($shop, [IMEIS[0]], '1500', $customer, '1000')->assertCreated();

    call($shop, 'GET', '/accounts/supplier')->assertJsonPath('data.0.balance', '1500.00');
    call($shop, 'GET', '/accounts/customer')->assertJsonPath('data.0.balance', '500.00');
});

it('lets a voucher settle a balance', function () {
    $shop = registerShop();
    $b = buy($shop, [IMEIS[0]], '1000');
    call($shop, 'POST', '/vouchers', ['party_type' => 'supplier', 'party_id' => $b['supplier'], 'direction' => 'payment', 'method' => 'cash',
        'amount' => '1000', 'voucher_date' => today()->toDateString()])->assertCreated();
    call($shop, 'GET', '/accounts/supplier')->assertJsonPath('data.0.balance', '0.00');
});

it('never sells the same phone twice', function () {
    $shop = registerShop();
    buy($shop, [IMEIS[0]]);
    sell($shop, [IMEIS[0]], '1500')->assertCreated();
    sell($shop, [IMEIS[0]], '1500')->assertStatus(409)->assertJsonPath('code', 'ITEMS_NOT_AVAILABLE');
});

it('requires walk-in sales to be paid in full', function () {
    $shop = registerShop();
    buy($shop, [IMEIS[0]]);
    sell($shop, [IMEIS[0]], '1500', null, '0')->assertStatus(422)->assertJsonPath('code', 'CREDIT_NEEDS_CUSTOMER');
});

it('explains every bad IMEI in a purchase', function () {
    $shop = registerShop();
    $b = buy($shop, [IMEIS[0]]);
    call($shop, 'POST', '/purchases', ['supplier_id' => $b['supplier'], 'purchase_date' => today()->toDateString(), 'items' => [
        ['imei' => '123', 'device_model_id' => $b['model'], 'cost' => '1'], ['imei' => IMEIS[1], 'device_model_id' => $b['model'], 'cost' => '1'], ['imei' => IMEIS[1], 'device_model_id' => $b['model'], 'cost' => '1'],
    ]])->assertStatus(422)->assertJsonPath('code', 'INVALID_ITEMS');
    call($shop, 'POST', '/purchases', ['supplier_id' => $b['supplier'], 'purchase_date' => today()->toDateString(),
        'items' => [['imei' => IMEIS[0], 'device_model_id' => $b['model'], 'cost' => '1']]])->assertStatus(409)->assertJsonPath('code', 'IMEI_ALREADY_IN_STOCK');
});

it('puts a returned phone back in stock and credits the customer', function () {
    $shop = registerShop();
    buy($shop, [IMEIS[0], IMEIS[1]]);
    $customer = call($shop, 'POST', '/customers', ['name' => 'Ali'])->assertCreated()['id'];
    $sale = sell($shop, [IMEIS[0]], '1500', $customer)->assertCreated()['id'];
    call($shop, 'GET', '/inventory?status=in_stock')->assertJsonPath('meta.total', 1);

    call($shop, 'POST', "/sales/{$sale}/returns", ['imeis' => [IMEIS[0]], 'reason' => 'Defective', 'return_date' => today()->toDateString()])->assertCreated();
    call($shop, 'GET', '/inventory?status=in_stock')->assertJsonPath('meta.total', 2);
    call($shop, 'GET', '/accounts/customer')->assertJsonPath('data.0.balance', '0.00');
    call($shop, 'POST', "/sales/{$sale}/returns", ['imeis' => [IMEIS[0]], 'reason' => 'Again', 'return_date' => today()->toDateString()])
        ->assertStatus(409)->assertJsonPath('code', 'ITEMS_NOT_RETURNABLE');
});

it('keeps the ledger append-only at the database level', function () {
    $shop = registerShop();
    buy($shop, [IMEIS[0]]);
    app(App\Shared\Tenancy\TenantContext::class)->set((int) DB::table('tenants')->where('slug', 'shop-a')->value('id')); // RLS hides rows without a shop
    expect(fn () => DB::table('ledger_entries')->update(['description' => 'tampered']))->toThrow(Illuminate\Database\QueryException::class);
});
