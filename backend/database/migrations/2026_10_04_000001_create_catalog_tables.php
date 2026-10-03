<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    private array $tables = ['brands', 'device_models', 'variants', 'colors', 'tac_mappings'];

    public function up(): void
    {
        Schema::create('brands', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->string('name', 80);
            $t->timestamps();
        });
        Schema::create('device_models', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('brand_id')->constrained('brands')->restrictOnDelete();
            $t->string('name', 120);
            $t->timestamps();
        });
        Schema::create('variants', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('device_model_id')->constrained('device_models')->restrictOnDelete();
            $t->string('name', 60); // e.g. 8GB/128GB
            $t->timestamps();
        });
        Schema::create('colors', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->string('name', 40);
            $t->timestamps();
        });
        Schema::create('tac_mappings', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->char('tac', 8);
            $t->foreignId('device_model_id')->constrained('device_models')->restrictOnDelete();
            $t->timestamps();
            $t->unique(['tenant_id', 'tac']);
        });

        // case-insensitive uniqueness per tenant
        DB::statement('CREATE UNIQUE INDEX brands_name_uq ON brands (tenant_id, lower(name))');
        DB::statement('CREATE UNIQUE INDEX models_name_uq ON device_models (tenant_id, brand_id, lower(name))');
        DB::statement('CREATE UNIQUE INDEX variants_name_uq ON variants (tenant_id, device_model_id, lower(name))');
        DB::statement('CREATE UNIQUE INDEX colors_name_uq ON colors (tenant_id, lower(name))');
        DB::statement('CREATE INDEX models_name_trgm ON device_models USING gin (name gin_trgm_ops)');

        foreach ($this->tables as $table) {
            $cond = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint";
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
            DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY");
            DB::statement("CREATE POLICY tenant_isolation ON {$table} USING ({$cond}) WITH CHECK ({$cond})");
        }
    }

    public function down(): void
    {
        foreach (array_reverse($this->tables) as $t) {
            Schema::dropIfExists($t);
        }
    }
};
