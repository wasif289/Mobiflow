<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    public function up(): void
    {
        Schema::create('expense_heads', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->string('name', 80);
            $t->timestamps();
        });
        DB::statement('CREATE UNIQUE INDEX expense_heads_name_uq ON expense_heads (tenant_id, lower(name))');

        Schema::create('expenses', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->restrictOnDelete();
            $t->foreignId('expense_head_id')->constrained('expense_heads')->restrictOnDelete();
            $t->bigInteger('amount_minor');
            $t->date('expense_date');
            $t->string('notes', 300)->nullable();
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->timestamps();
            $t->index(['tenant_id', 'branch_id', 'expense_date']);
        });
        DB::statement('ALTER TABLE expenses ADD CONSTRAINT expenses_amount_chk CHECK (amount_minor > 0)');

        foreach (['expense_heads', 'expenses'] as $table) {
            $cond = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint";
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
            DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY");
            DB::statement("CREATE POLICY tenant_isolation ON {$table} USING ({$cond}) WITH CHECK ({$cond})");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('expense_heads');
    }
};
