<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    private array $tables = ['customers', 'sales', 'sale_items'];

    public function up(): void
    {
        Schema::create('customers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->string('name', 120);
            $t->string('phone', 30)->nullable();
            $t->text('address')->nullable();
            $t->timestamps();
            $t->index(['tenant_id', 'phone']);
        });

        // customer_id NULL = walk-in (no magic id=1 row)
        Schema::create('sales', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->restrictOnDelete();
            $t->foreignId('customer_id')->nullable()->constrained()->restrictOnDelete();
            $t->string('invoice_no', 40);
            $t->date('sale_date');
            $t->bigInteger('total_minor');
            $t->bigInteger('received_minor')->default(0);
            $t->text('note')->nullable();
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->timestamps();
            $t->unique(['tenant_id', 'invoice_no']);
            $t->index(['tenant_id', 'branch_id', 'sale_date']);
        });
        DB::statement('ALTER TABLE sales ADD CONSTRAINT sales_received_chk CHECK (received_minor >= 0 AND received_minor <= total_minor)');
        DB::statement('ALTER TABLE sales ADD CONSTRAINT sales_walkin_paid_chk CHECK (customer_id IS NOT NULL OR received_minor = total_minor)');

        Schema::create('sale_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $t->foreignId('stock_item_id')->constrained('stock_items')->restrictOnDelete();
            $t->bigInteger('price_minor');
            $t->bigInteger('cost_minor'); // frozen at sale time, so profit never changes later
            $t->timestamps();
            $t->index(['tenant_id', 'stock_item_id']);
        });

        foreach ($this->tables as $table) {
            $cond = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint";
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
            DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY");
            DB::statement("CREATE POLICY tenant_isolation ON {$table} USING ({$cond}) WITH CHECK ({$cond})");
        }
    }

    public function down(): void
    {
        foreach (['sale_items', 'sales', 'customers'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
