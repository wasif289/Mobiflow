<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    private array $tables = ['purchase_returns', 'purchase_return_items', 'sale_returns', 'sale_return_items'];

    public function up(): void
    {
        foreach (['purchase' => 'purchases', 'sale' => 'sales'] as $kind => $parent) {
            Schema::create("{$kind}_returns", function (Blueprint $t) use ($kind, $parent) {
                $t->id();
                $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $t->foreignId('branch_id')->constrained()->restrictOnDelete();
                $t->foreignId("{$kind}_id")->constrained($parent)->restrictOnDelete();
                $t->string('return_no', 40);
                $t->bigInteger('total_minor');
                $t->string('reason', 200);
                $t->date('return_date');
                $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
                $t->timestamps();
                $t->unique(['tenant_id', 'return_no']);
            });
        }

        // one line per phone; the unique key makes a double return impossible even under a race
        Schema::create('purchase_return_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('purchase_return_id')->constrained('purchase_returns')->cascadeOnDelete();
            $t->foreignId('stock_item_id')->constrained('stock_items')->restrictOnDelete();
            $t->bigInteger('amount_minor');
            $t->unique(['tenant_id', 'stock_item_id']);
        });
        Schema::create('sale_return_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('sale_return_id')->constrained('sale_returns')->cascadeOnDelete();
            $t->foreignId('sale_item_id')->constrained('sale_items')->restrictOnDelete();
            $t->foreignId('stock_item_id')->constrained('stock_items')->restrictOnDelete();
            $t->bigInteger('amount_minor');
            $t->unique(['tenant_id', 'sale_item_id']);
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
        foreach (array_reverse($this->tables) as $t) {
            Schema::dropIfExists($t);
        }
    }
};
