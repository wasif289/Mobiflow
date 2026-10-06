<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

/** Platform-level tables: deliberately NOT under tenant RLS (the super admin must see all shops). Tenant code filters by tenant_id explicitly. */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $t) {
            $t->bigInteger('yearly_price_minor')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
        });
        Schema::table('tenants', fn (Blueprint $t) => $t->timestampTz('current_period_ends_at')->nullable());

        Schema::create('super_admins', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email')->unique();
            $t->string('password');
            $t->rememberToken();
            $t->timestamps();
        });

        Schema::create('subscription_invoices', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->restrictOnDelete();
            $t->foreignId('plan_id')->constrained('plans')->restrictOnDelete();
            $t->string('invoice_no', 40)->unique();
            $t->unsignedSmallInteger('period_months');
            $t->bigInteger('amount_minor');
            $t->string('currency', 3)->default('PKR');
            $t->string('status', 12)->default('pending');
            $t->timestampTz('paid_at')->nullable();
            $t->timestamps();
            $t->index(['tenant_id', 'status']);
        });
        DB::statement("ALTER TABLE subscription_invoices ADD CONSTRAINT sub_inv_chk CHECK (status IN ('pending','paid','cancelled') AND amount_minor > 0)");

        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->restrictOnDelete();
            $t->foreignId('invoice_id')->constrained('subscription_invoices')->restrictOnDelete();
            $t->string('method', 10);   // gateway | manual
            $t->string('provider', 20); // stripe | bank | jazzcash | easypaisa ...
            $t->bigInteger('amount_minor');
            $t->string('status', 12)->default('pending'); // pending | succeeded | rejected | failed
            $t->string('reference')->nullable();          // customer's transaction ref, or the gateway session id
            $t->string('proof_path')->nullable();
            $t->string('note', 300)->nullable();
            $t->string('review_note', 300)->nullable();
            $t->foreignId('reviewed_by')->nullable()->constrained('super_admins')->nullOnDelete();
            $t->timestampTz('reviewed_at')->nullable();
            $t->timestamps();
            $t->index(['status', 'created_at']);
        });
        DB::statement("ALTER TABLE payments ADD CONSTRAINT payments_chk CHECK (status IN ('pending','succeeded','rejected','failed') AND method IN ('gateway','manual'))");
        DB::statement("CREATE UNIQUE INDEX payments_gateway_ref_uq ON payments (provider, reference) WHERE method = 'gateway'");

        // webhook idempotency: a provider event is processed at most once
        Schema::create('payment_events', function (Blueprint $t) {
            $t->id();
            $t->string('provider', 20);
            $t->string('event_id');
            $t->timestampTz('processed_at')->useCurrent();
            $t->unique(['provider', 'event_id']);
        });
        Schema::create('platform_settings', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->jsonb('value');
        });

        // sample plans (editable by the super admin). "starter" is the trial plan used at signup.
        foreach ([['starter', 'Starter', 1, 3, 250000, 2500000, 1], ['growth', 'Growth', 3, 10, 600000, 6000000, 2], ['pro', 'Pro', null, null, 1200000, 12000000, 3]] as [$code, $name, $br, $us, $m, $y, $o]) {
            DB::table('plans')->insertOrIgnore(['code' => $code, 'name' => $name, 'max_branches' => $br, 'max_users' => $us, 'price_minor' => $m,
                'yearly_price_minor' => $y, 'sort_order' => $o, 'features' => '{}', 'currency' => 'PKR', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        foreach (['platform_settings', 'payment_events', 'payments', 'subscription_invoices', 'super_admins'] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::table('tenants', fn (Blueprint $t) => $t->dropColumn('current_period_ends_at'));
        Schema::table('plans', fn (Blueprint $t) => $t->dropColumn(['yearly_price_minor', 'sort_order']));
    }
};
