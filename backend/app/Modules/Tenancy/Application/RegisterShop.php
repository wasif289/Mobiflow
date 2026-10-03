<?php
declare(strict_types=1);

namespace App\Modules\Tenancy\Application;

use App\Modules\Identity\Infrastructure\Models\{Branch, User};
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Use case: self-service signup. Creates tenant + main branch + owner in one transaction, 14-day trial. */
final class RegisterShop
{
    public function __construct(private readonly TenantContext $ctx) {}

    /** @param array{shop_name:string,slug:string,name:string,username:string,password:string} $d */
    public function __invoke(array $d): User
    {
        try {
            return DB::transaction(function () use ($d) {
                $tenantId = DB::table('tenants')->insertGetId([
                    'public_id' => (string) Str::ulid(), 'name' => $d['shop_name'], 'slug' => $d['slug'],
                    'plan_id' => DB::table('plans')->where('code', 'starter')->value('id'),
                    'status' => 'trial', 'trial_ends_at' => now()->addDays(14),
                    'created_at' => now(), 'updated_at' => now(),
                ]);

                $this->ctx->set($tenantId);
                Branch::create(['code' => 'MAIN', 'name' => 'Main Branch', 'is_main' => true]);

                return User::create([
                    'public_id' => (string) Str::ulid(), 'name' => $d['name'], 'username' => $d['username'],
                    'password' => $d['password'], 'role' => 'owner',
                ]);
            });
        } finally {
            $this->ctx->clear();
        }
    }
}
