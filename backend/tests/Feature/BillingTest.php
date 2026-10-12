<?php

declare(strict_types=1);

use App\Modules\Billing\Application\ActivateSubscription;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB, Storage};

function invoiceFor(array $shop, string $plan = 'growth', int $months = 1): int
{
    $planId = DB::table('plans')->where('code', $plan)->value('id');
    return call($shop, 'POST', '/billing/invoices', ['plan_id' => $planId, 'months' => $months])->assertCreated()['id'];
}

it('activates the plan once when a manual payment is approved', function () {
    Storage::fake();
    $shop = registerShop();
    $admin = platformAdmin();
    platform($admin, 'PUT', '/settings', ['manual_methods' => [['key' => 'bank', 'label' => 'Bank', 'details' => 'Acct 123', 'enabled' => true]]])->assertOk();
    $invoice = invoiceFor($shop);

    app('auth')->forgetGuards();
    test()->flushHeaders()->withHeaders(['X-Tenant' => 'shop-a', 'Authorization' => 'Bearer ' . $shop['token'], 'Accept' => 'application/json'])
        ->post("/api/v1/billing/invoices/{$invoice}/manual-payment", ['method' => 'bank', 'reference' => 'TX1', 'proof' => UploadedFile::fake()->image('r.png')])->assertCreated();
    call($shop, 'POST', "/billing/invoices/{$invoice}/manual-payment", [])->assertStatus(422);

    $payment = DB::table('payments')->value('id');
    platform($admin, 'POST', "/payments/{$payment}/approve")->assertOk();
    $tenant = DB::table('tenants')->where('slug', 'shop-a')->first();
    expect($tenant->status)->toBe('active')->and($tenant->plan_id)->toBe(DB::table('plans')->where('code', 'growth')->value('id'));

    platform($admin, 'POST', "/payments/{$payment}/approve")->assertStatus(409);
    app(ActivateSubscription::class)($invoice); // a retry must not extend the period again
    expect(DB::table('tenants')->where('slug', 'shop-a')->value('current_period_ends_at'))->toBe($tenant->current_period_ends_at);
});

it('keeps a suspended shop read-only but lets it reach billing', function () {
    $shop = registerShop();
    DB::table('tenants')->where('slug', 'shop-a')->update(['status' => 'suspended']);

    call($shop, 'GET', '/sales')->assertOk();
    call($shop, 'POST', '/customers', ['name' => 'Ali'])->assertStatus(402)->assertJsonPath('code', 'SUBSCRIPTION_INACTIVE');
    call($shop, 'GET', '/billing')->assertOk();
    invoiceFor($shop);
});

it('verifies stripe webhooks and processes each event once', function () {
    config(['billing.stripe.secret' => 'sk_test_x', 'billing.stripe.webhook_secret' => 'whsec_test']);
    $shop = registerShop();
    $invoice = invoiceFor($shop);
    $tenantId = DB::table('tenants')->where('slug', 'shop-a')->value('id');
    DB::table('payments')->insert(['tenant_id' => $tenantId, 'invoice_id' => $invoice, 'method' => 'gateway', 'provider' => 'stripe', 'amount_minor' => 600000,
        'reference' => 'cs_test_1', 'created_at' => now(), 'updated_at' => now()]);

    $body = json_encode(['id' => 'evt_1', 'type' => 'checkout.session.completed', 'data' => ['object' => ['id' => 'cs_test_1', 'payment_status' => 'paid']]]);
    $post = fn (string $sig) => $this->call('POST', '/api/v1/webhooks/stripe', [], [], [], ['HTTP_STRIPE_SIGNATURE' => $sig, 'CONTENT_TYPE' => 'application/json'], $body);
    $ts = time();
    $good = "t={$ts},v1=" . hash_hmac('sha256', "{$ts}.{$body}", 'whsec_test');

    $post("t={$ts},v1=deadbeef")->assertStatus(400)->assertJsonPath('code', 'INVALID_SIGNATURE');
    expect(DB::table('tenants')->where('id', $tenantId)->value('status'))->toBe('trial');

    $post($good)->assertOk();
    $end = DB::table('tenants')->where('id', $tenantId)->value('current_period_ends_at');
    expect(DB::table('tenants')->where('id', $tenantId)->value('status'))->toBe('active');
    $post($good)->assertOk(); // Stripe retry
    expect(DB::table('tenants')->where('id', $tenantId)->value('current_period_ends_at'))->toBe($end);
});

it('keeps shop tokens and super-admin tokens apart', function () {
    $shop = registerShop();
    $admin = platformAdmin();

    expect(in_array(platform($shop['token'], 'GET', '/overview')->status(), [401, 403], true))->toBeTrue();
    call(['tenant' => 'shop-a', 'token' => $admin, 'branch' => 0], 'GET', '/sales')->assertForbidden();
});

it('moves shops through past due and suspended', function () {
    registerShop();
    DB::table('tenants')->where('slug', 'shop-a')->update(['trial_ends_at' => now()->subDay()]);
    $this->artisan('billing:sweep')->assertSuccessful();
    expect(DB::table('tenants')->where('slug', 'shop-a')->value('status'))->toBe('past_due');

    DB::table('tenants')->where('slug', 'shop-a')->update(['trial_ends_at' => now()->subDays(10)]);
    $this->artisan('billing:sweep')->assertSuccessful();
    expect(DB::table('tenants')->where('slug', 'shop-a')->value('status'))->toBe('suspended');
});
