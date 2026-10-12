<?php

declare(strict_types=1);

use App\Modules\Identity\Infrastructure\Models\Branch;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function makeTenant(string $slug): int
{
    return DB::table('tenants')->insertGetId([
        'public_id' => (string) Str::ulid(),
        'name' => strtoupper($slug),
        'slug' => $slug,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

it('never shows one tenant\'s branches to another', function () {
    $ctx = app(TenantContext::class);
    $a = makeTenant('shop-a');
    $b = makeTenant('shop-b');

    $ctx->set($a);
    Branch::create(['code' => 'A1', 'name' => 'A main', 'is_main' => true]);
    $ctx->set($b);
    Branch::create(['code' => 'B1', 'name' => 'B main', 'is_main' => true]);

    expect(Branch::count())->toBe(1)->and(Branch::first()->code)->toBe('B1');

    $ctx->clear(); // fail closed
    expect(Branch::count())->toBe(0);
});
