<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    private array $tables = ['suppliers', 'number_sequences', 'purchases', 'stock_items'];

    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->string('name', 120);
            $t->string('phone', 30)->nullable();
            $t->text('address')->nullable();
            $t->timestamps();
        });
        DB::statement('CREATE UNIQUE INDEX suppliers_name_uq ON suppliers (tenant_id, lower(name))');

        Schema::create('number_sequences', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $t->string('type', 20);
            $t->unsignedBigInteger('last')->default(0);
            $t->unique(['tenant_id', 'branch_id', 'type']);
        });

        Schema::create('purchases', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->restrictOnDelete();
            $t->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $t->string('invoice_no', 40);
            $t->date('purchase_date');
            $t->bigInteger('total_minor');
            $t->bigInteger('paid_minor')->default(0);
            $t->text('note')->nullable();
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->timestamps();
            $t->unique(['tenant_id', 'invoice_no']);
            $t->index(['tenant_id', 'branch_id', 'purchase_date']);
        });
        DB::statement('ALTER TABLE purchases ADD CONSTRAINT purchases_paid_chk CHECK (paid_minor >= 0 AND paid_minor <= total_minor)');

        // One row per physical phone (IMEI). Also the inventory table.
        Schema::create('stock_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->restrictOnDelete(); // where it is now
            $t->foreignId('purchase_id')->constrained()->restrictOnDelete();
            $t->foreignId('device_model_id')->constrained('device_models')->restrictOnDelete();
            $t->foreignId('variant_id')->nullable()->constrained('variants')->restrictOnDelete();
            $t->foreignId('color_id')->nullable()->constrained('colors')->restrictOnDelete();
            $t->string('imei', 15);
            $t->bigInteger('cost_minor');
            $t->string('status', 20)->default('in_stock');
            $t->timestamps();
            $t->index(['tenant_id', 'branch_id', 'status']);
        });
        DB::statement("ALTER TABLE stock_items ADD CONSTRAINT stock_status_chk CHECK (status IN ('in_stock','sold','in_transit','returned_to_supplier'))");
        // an IMEI can be owned by the shop only once at a time, but may come back after being sold/returned
        DB::statement("CREATE UNIQUE INDEX stock_imei_active_uq ON stock_items (tenant_id, imei) WHERE status IN ('in_stock','in_transit')");
        DB::statement('CREATE INDEX stock_imei_trgm ON stock_items USING gin (imei gin_trgm_ops)');

        foreach ($this->tables as $table) {
            $cond = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint";
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
            DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY");
            DB::statement("CREATE POLICY tenant_isolation ON {$table} USING ({$cond}) WITH CHECK ({$cond})");
        }
    }

    public function down(): void
    {
        foreach (['stock_items', 'purchases', 'number_sequences', 'suppliers'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
