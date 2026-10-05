<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->restrictOnDelete();
            $t->string('voucher_no', 40);
            $t->string('party_type', 10);
            $t->unsignedBigInteger('party_id');
            $t->string('direction', 10); // payment = money out, receipt = money in
            $t->string('method', 12);
            $t->bigInteger('amount_minor');
            $t->string('bill_ref', 60)->nullable();
            $t->string('notes', 300)->nullable();
            $t->date('voucher_date');
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->timestamps();
            $t->unique(['tenant_id', 'voucher_no']);
        });
        DB::statement("ALTER TABLE vouchers ADD CONSTRAINT vouchers_chk CHECK (amount_minor > 0
            AND party_type IN ('supplier','customer') AND direction IN ('payment','receipt'))");

        // Append-only party ledger. Balance is always computed from the entries, never stored.
        Schema::create('ledger_entries', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->restrictOnDelete();
            $t->string('party_type', 10);
            $t->unsignedBigInteger('party_id');
            $t->date('entry_date');
            $t->string('ref_type', 20); // purchase, purchase_payment, sale, sale_payment, voucher, ...
            $t->unsignedBigInteger('ref_id');
            $t->string('description', 200);
            $t->bigInteger('debit_minor')->default(0);
            $t->bigInteger('credit_minor')->default(0);
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['tenant_id', 'party_type', 'party_id', 'entry_date', 'id']);
        });
        DB::statement("ALTER TABLE ledger_entries ADD CONSTRAINT ledger_chk CHECK (
            party_type IN ('supplier','customer') AND debit_minor >= 0 AND credit_minor >= 0
            AND ((debit_minor = 0) <> (credit_minor = 0)))");
        DB::unprepared('CREATE FUNCTION ledger_append_only() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION \'ledger_entries is append-only: post a reversing entry instead\'; END;
            $$ LANGUAGE plpgsql');
        DB::unprepared('CREATE TRIGGER ledger_no_change BEFORE UPDATE OR DELETE ON ledger_entries
            FOR EACH ROW EXECUTE FUNCTION ledger_append_only()');

        foreach (['vouchers', 'ledger_entries'] as $table) {
            $cond = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint";
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
            DB::statement("ALTER TABLE {$table} FORCE ROW LEVEL SECURITY");
            DB::statement("CREATE POLICY tenant_isolation ON {$table} USING ({$cond}) WITH CHECK ({$cond})");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('vouchers');
        DB::unprepared('DROP FUNCTION IF EXISTS ledger_append_only()');
    }
};
