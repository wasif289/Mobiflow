<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

function pay(array $shop, array $over = [])
{
    return call($shop, 'POST', '/vouchers', $over + ['direction' => 'payment', 'method' => 'cash', 'voucher_date' => today()->toDateString()]);
}

it('settles a purchase bill through a payment voucher and keeps the ledger right', function () {
    $shop = registerShop();
    $b = buy($shop, [IMEIS[0], IMEIS[1]], '1000');                       // bill of 2000, nothing paid yet

    $v = pay($shop, ['party_type' => 'supplier', 'party_id' => $b['supplier'], 'purchase_id' => $b['purchase'], 'amount' => '500'])->assertCreated();
    call($shop, 'GET', "/purchases/{$b['purchase']}")->assertJsonPath('paid', '500.00')->assertJsonPath('due', '1500.00')->assertJsonPath('supplier_id', $b['supplier']);
    call($shop, 'GET', '/accounts/supplier')->assertJsonPath('data.0.balance', '1500.00');

    // the slip shows the bill and the balance right after this voucher
    call($shop, 'GET', "/vouchers/{$v['id']}")->assertOk()->assertJsonPath('kind', 'party')->assertJsonPath('direction', 'payment')
        ->assertJsonPath('amount', '500.00')->assertJsonPath('balance', '1500.00')->assertJsonPath('bill.due', '1500.00')
        ->assertJsonPath('bill_ref', DB::table('purchases')->value('invoice_no'));
    $rows = call($shop, 'GET', "/accounts/supplier/{$b['supplier']}")->assertOk()->json('rows');
    $voucherRow = collect($rows)->firstWhere('ref', 'voucher');
    expect($voucherRow['ref_id'])->toBe($v['id'])->and(collect($rows)->firstWhere('ref', 'purchase')['ref_id'])->toBe($b['purchase']);
    pay($shop, ['party_type' => 'supplier', 'party_id' => $b['supplier'], 'purchase_id' => $b['purchase'], 'amount' => '1500'])->assertCreated();
    call($shop, 'GET', "/purchases/{$b['purchase']}")->assertJsonPath('due', '0.00');
    call($shop, 'GET', '/accounts/supplier')->assertJsonPath('data.0.balance', '0.00');
});

it('never lets a voucher overpay a bill or settle the wrong one', function () {
    $shop = registerShop();
    $b = buy($shop, [IMEIS[0]], '1000');
    $other = call($shop, 'POST', '/suppliers', ['name' => 'Other Traders'])->assertCreated()['id'];

    pay($shop, ['party_type' => 'supplier', 'party_id' => $b['supplier'], 'purchase_id' => $b['purchase'], 'amount' => '1000.01'])
        ->assertStatus(422)->assertJsonPath('code', 'OVER_BILL');
    pay($shop, ['party_type' => 'supplier', 'party_id' => $other, 'purchase_id' => $b['purchase'], 'amount' => '100'])
        ->assertStatus(422)->assertJsonPath('code', 'BILL_NOT_FOUND');
    pay($shop, ['party_type' => 'supplier', 'party_id' => $b['supplier'], 'purchase_id' => $b['purchase'], 'sale_id' => 1, 'amount' => '100'])
        ->assertStatus(422)->assertJsonPath('code', 'ONE_BILL_ONLY');
    pay($shop, ['party_type' => 'supplier', 'party_id' => $b['supplier'], 'purchase_id' => $b['purchase'], 'direction' => 'receipt', 'amount' => '100'])
        ->assertStatus(422)->assertJsonPath('code', 'BILL_MISMATCH');
    expect(DB::table('purchases')->value('paid_minor'))->toBe(0)->and(DB::table('vouchers')->count())->toBe(0);
});

it('settles a credit sale through a receipt voucher and lists the open bills', function () {
    $shop = registerShop();
    buy($shop, [IMEIS[0]], '1000');
    $customer = call($shop, 'POST', '/customers', ['name' => 'Ali', 'phone' => '0300'])->assertCreated()['id'];
    $sale = call($shop, 'POST', '/sales', ['customer_id' => $customer, 'sale_date' => today()->toDateString(), 'received' => '0',
        'items' => [['imei' => IMEIS[0], 'price' => '1500']]])->assertCreated()['id'];

    call($shop, 'GET', "/accounts/customer/{$customer}/open")->assertOk()->assertJsonPath('balance', '1500.00')
        ->assertJsonPath('bills.0.id', $sale)->assertJsonPath('bills.0.due', '1500.00')->assertJsonPath('party.name', 'Ali');

    $v = call($shop, 'POST', '/vouchers', ['party_type' => 'customer', 'party_id' => $customer, 'direction' => 'receipt', 'method' => 'bank',
        'amount' => '1500', 'sale_id' => $sale, 'voucher_date' => today()->toDateString()])->assertCreated();
    call($shop, 'GET', "/sales/{$sale}")->assertJsonPath('received', '1500.00')->assertJsonPath('due', '0.00')->assertJsonPath('customer_id', $customer);
    call($shop, 'GET', "/accounts/customer/{$customer}/open")->assertJsonPath('balance', '0.00')->assertJsonCount(0, 'bills');
    call($shop, 'GET', '/vouchers?direction=receipt')->assertOk()->assertJsonPath('0.voucher_no', $v['voucher_no'])->assertJsonPath('0.party', 'Ali');
});

it('still accepts a plain on-account voucher with no bill', function () {
    $shop = registerShop();
    $b = buy($shop, [IMEIS[0]], '1000');
    pay($shop, ['party_type' => 'supplier', 'party_id' => $b['supplier'], 'amount' => '400'])->assertCreated();
    call($shop, 'GET', '/accounts/supplier')->assertJsonPath('data.0.balance', '600.00');
    call($shop, 'GET', "/purchases/{$b['purchase']}")->assertJsonPath('paid', '0.00');   // not allocated to a bill
});

it('gives every expense a printable voucher number and method', function () {
    $shop = registerShop();
    $head = call($shop, 'POST', '/expense-heads', ['name' => 'Rent'])->assertCreated()['id'];
    $e = call($shop, 'POST', '/expenses', ['expense_head_id' => $head, 'amount' => '25000', 'expense_date' => today()->toDateString(), 'method' => 'bank', 'notes' => 'Oct shop rent'])->assertCreated();
    $f = call($shop, 'POST', '/expenses', ['expense_head_id' => $head, 'amount' => '100', 'expense_date' => today()->toDateString()])->assertCreated();

    expect($e['voucher_no'])->toStartWith('EV-')->and($f['voucher_no'])->not->toBe($e['voucher_no']);
    call($shop, 'GET', "/expenses/{$e['id']}")->assertOk()->assertJsonPath('kind', 'expense')->assertJsonPath('head', 'Rent')
        ->assertJsonPath('method', 'bank')->assertJsonPath('amount', '25000.00')->assertJsonPath('voucher_no', $e['voucher_no']);
    call($shop, 'GET', "/expenses/{$f['id']}")->assertJsonPath('method', 'cash');
    call($shop, 'GET', '/expenses')->assertOk()->assertJsonPath('data.0.voucher_no', $f['voucher_no']);
});

it('keeps vouchers inside the shop that made them', function () {
    $a = registerShop('shop-a');
    $b = registerShop('shop-b');
    $x = buy($a, [IMEIS[0]], '1000');
    $v = pay($a, ['party_type' => 'supplier', 'party_id' => $x['supplier'], 'amount' => '100'])->assertCreated();
    call($b, 'GET', "/vouchers/{$v['id']}")->assertNotFound();
    call($b, 'GET', '/vouchers')->assertOk()->assertJsonCount(0);
    pay($b, ['party_type' => 'supplier', 'party_id' => $x['supplier'], 'purchase_id' => $x['purchase'], 'amount' => '100'])->assertStatus(422);
});

it('lets the print page read the shop name, phone and address', function () {
    $shop = registerShop();
    call($shop, 'GET', '/shop')->assertOk()->assertJsonStructure(['name', 'phone', 'address', 'footer']);
});
