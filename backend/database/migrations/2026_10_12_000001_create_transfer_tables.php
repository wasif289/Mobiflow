<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_transfers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('from_branch_id')->constrained('branches')->restrictOnDelete();
            $t->foreignId('to_branch_id')->constrained('branches')->restrictOnDelete();
            $t->string('transfer_no', 40);
            $t->string('status', 10)->default('pending'); // pending -> received | cancelled
            $t->string('note', 300)->nullable();
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->foreignId('received_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->timestampTz('received_at')->nullable();
            $t->timestamps();
            $t->unique(['tenant_id', 'transfer_no']);
            $t->index(['tenant_id', 'status']);
        });
        DB::statement("ALTER TABLE stock_transfers ADD CONSTRAINT transfers_chk CHECK (from_branch_id <> to_branch_id AND status IN ('pending','received','cancelled'))");

        Schema::create('stock_transfer_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('transfer_id')->constrained('stock_transfers')->cascadeOnDelete();
            $t->foreignId('stock_item_id')->constrained('stock_items')->restrictOnDelete();
            $t->unique(['transfer_id', 'stock_item_id']);
        });

        foreach (['stock_transfers', 'stock_transfer_items'] as $table) {
            $cond = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint";
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
            DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY");
            DB::statement("CREATE POLICY tenant_isolation ON {$table} USING ({$cond}) WITH CHECK ({$cond})");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transfer_items');
        Schema::dropIfExists('stock_transfers');
    }
};
