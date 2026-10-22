<?php

declare(strict_types=1);

use App\Modules\Platform\Infrastructure\SuperAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature');

/** Valid (Luhn) test IMEIs. */
const IMEIS = ['490154203237518', '490154203237526', '490154203237534', '490154203237542', '490154203237559'];

/** Registers a shop through the real API. @return array{tenant:string,token:string,branch:int,id:int} */
function registerShop(string $slug = 'shop-a'): array
{
    $r = test()->postJson('/api/v1/auth/register', ['shop_name' => strtoupper($slug), 'slug' => $slug, 'name' => 'Owner', 'username' => 'owner', 'password' => 'Str0ng-pass-1'])->assertCreated();
    return ['tenant' => $slug, 'token' => $r['token'], 'branch' => $r['user']['branches'][0]['id']];
}

/** Signs in as an existing shop user. */
function loginAs(string $tenant, string $username, string $password = 'Str0ng-pass-1'): array
{
    $r = test()->flushHeaders()->withHeaders(['X-Tenant' => $tenant])->postJson('/api/v1/auth/login', ['username' => $username, 'password' => $password])->assertOk();
    return ['tenant' => $tenant, 'token' => $r['token'], 'branch' => $r['user']['branches'][0]['id'] ?? 0];
}

/** One API call as a shop user. The auth guard caches the user between calls inside a test, so reset it. */
function call(array $shop, string $method, string $uri, array $data = [], ?int $branch = null)
{
    app('auth')->forgetGuards();
    $h = ['X-Tenant' => $shop['tenant'], 'Authorization' => 'Bearer ' . $shop['token']];
    ($branch ?? $shop['branch']) && $h['X-Branch-Id'] = (string) ($branch ?? $shop['branch']);
    return test()->flushHeaders()->withHeaders($h)->json($method, '/api/v1' . $uri, $data);
}

/** One API call as a super admin. */
function platform(string $token, string $method, string $uri, array $data = [])
{
    app('auth')->forgetGuards();
    return test()->flushHeaders()->withHeaders(['Authorization' => 'Bearer ' . $token])->json($method, '/api/v1/platform' . $uri, $data);
}

function platformAdmin(): string
{
    SuperAdmin::create(['name' => 'Root', 'email' => 'root@example.com', 'password' => 'Str0ng-pass-1']);
    return test()->flushHeaders()->postJson('/api/v1/platform/auth/login', ['email' => 'root@example.com', 'password' => 'Str0ng-pass-1'])->assertOk()['token'];
}

/** Move a shop to the unlimited plan so tests are not blocked by Starter limits. */
function unlimited(string $slug): void
{
    DB::table('tenants')->where('slug', $slug)->update(['plan_id' => DB::table('plans')->where('code', 'pro')->value('id')]);
}

/** Buys phones from a new supplier. @return array{supplier:int,model:int,purchase:int} */
function buy(array $shop, array $imeis, string $cost = '1000', string $paid = '0'): array
{
    $brand = call($shop, 'POST', '/catalog/brands', ['name' => 'Samsung ' . count($imeis)])->assertCreated()['id'];
    $model = call($shop, 'POST', '/catalog/models', ['brand_id' => $brand, 'name' => 'A15'])->assertCreated()['id'];
    $supplier = call($shop, 'POST', '/suppliers', ['name' => 'Supplier ' . count($imeis)])->assertCreated()['id'];
    $purchase = call($shop, 'POST', '/purchases', [
        'supplier_id' => $supplier,
        'purchase_date' => today()->toDateString(),
        'paid' => $paid,
        'items' => array_map(fn($i) => ['imei' => $i, 'device_model_id' => $model, 'cost' => $cost], $imeis),
    ])->assertCreated()['id'];
    return ['supplier' => $supplier, 'model' => $model, 'purchase' => $purchase];
}
