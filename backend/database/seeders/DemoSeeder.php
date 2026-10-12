<?php
declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Identity\Infrastructure\Models\{Branch, User};
use App\Shared\Tenancy\TenantContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Local demo data. Login: shop "demo" / user "admin" / password "admin12345". */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('DemoSeeder refuses to run in production.');
            return;
        }
        if (DB::table('tenants')->where('slug', 'demo')->exists()) {
            return;
        }

        DB::table('plans')->updateOrInsert(['code' => 'starter'], [
            'name' => 'Starter', 'max_branches' => 3, 'max_users' => 5, 'price_minor' => 0,
            'features' => '{}', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $tenantId = DB::table('tenants')->insertGetId([
            'public_id' => (string) Str::ulid(), 'name' => 'Demo Mobile Shop', 'slug' => 'demo',
            'plan_id' => DB::table('plans')->where('code', 'starter')->value('id'),
            'status' => 'trial', 'trial_ends_at' => now()->addDays(14),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $ctx = app(TenantContext::class);
        $ctx->set($tenantId); // RLS requires tenant context for every tenant table write
        try {
            Branch::create(['code' => 'MAIN', 'name' => 'Main Branch', 'is_main' => true]);
            Branch::create(['code' => 'CITY', 'name' => 'City Branch']);

            User::create([
                'public_id' => (string) Str::ulid(), 'name' => 'Demo Owner', 'username' => 'admin',
                'password' => 'admin12345', 'role' => 'owner',
            ]);
            $staff = User::create([
                'public_id' => (string) Str::ulid(), 'name' => 'Demo Staff', 'username' => 'staff',
                'password' => 'staff12345', 'role' => 'staff',
            ]);
            $staff->branches()->attach(Branch::where('code', 'CITY')->value('id'), ['tenant_id' => $tenantId]);
        } finally {
            $ctx->clear();
        }
    }
}
