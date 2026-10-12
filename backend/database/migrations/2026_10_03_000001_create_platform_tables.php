<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    /** Tables carrying tenant_id: protected by RLS as a 2nd isolation layer. */
    private array $scoped = ['branches', 'users', 'branch_user'];

    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        Schema::create('plans', function (Blueprint $t) {
            $t->id();
            $t->string('code')->unique();
            $t->string('name');
            $t->unsignedInteger('max_branches')->nullable(); // null = unlimited
            $t->unsignedInteger('max_users')->nullable();
            $t->bigInteger('price_minor')->default(0);
            $t->string('currency', 3)->default('PKR');
            $t->jsonb('features')->default('{}');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('tenants', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->string('name');
            $t->string('slug')->unique(); // subdomain
            $t->foreignId('plan_id')->nullable()->constrained('plans');
            $t->string('status')->default('trial');
            $t->timestampTz('trial_ends_at')->nullable();
            $t->jsonb('settings')->default('{}');
            $t->timestamps();
            $t->softDeletes();
        });
        DB::statement("ALTER TABLE tenants ADD CONSTRAINT tenants_status_chk
            CHECK (status IN ('trial','active','past_due','suspended','cancelled'))");

        Schema::create('branches', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->string('code', 20);
            $t->string('name');
            $t->text('address')->nullable();
            $t->string('phone', 30)->nullable();
            $t->boolean('is_main')->default(false);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->unique(['tenant_id', 'code']);
        });
        // exactly one main branch per tenant
        DB::statement('CREATE UNIQUE INDEX branches_one_main ON branches (tenant_id) WHERE is_main');

        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->string('username', 50);
            $t->string('email')->nullable();
            $t->string('password');
            $t->string('role')->default('staff'); // owner|admin|staff (fine-grained via permissions)
            $t->boolean('is_active')->default(true);
            $t->timestampTz('last_login_at')->nullable();
            $t->rememberToken();
            $t->timestamps();
            $t->unique(['tenant_id', 'username']);
        });

        Schema::create('branch_user', function (Blueprint $t) {
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->primary(['branch_id', 'user_id']);
        });

        foreach ($this->scoped as $table) {
            $cond = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint";
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
            DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY");
            DB::statement("CREATE POLICY tenant_isolation ON {$table} USING ({$cond}) WITH CHECK ({$cond})");
        }
    }

    public function down(): void
    {
        foreach (['branch_user', 'users', 'branches', 'tenants', 'plans'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
