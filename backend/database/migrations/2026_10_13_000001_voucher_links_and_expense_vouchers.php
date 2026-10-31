<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

/**
 * Every payment now goes through a voucher:
 *  - a supplier payment / customer receipt can be linked to the bill it settles (purchase_id / sale_id),
 *  - an expense gets its own printable voucher number and payment method.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $t) {
            $t->unsignedBigInteger('purchase_id')->nullable();
            $t->unsignedBigInteger('sale_id')->nullable();
            $t->index(['tenant_id', 'purchase_id']);
            $t->index(['tenant_id', 'sale_id']);
        });
        DB::statement('ALTER TABLE vouchers ADD CONSTRAINT vouchers_one_bill_chk CHECK (purchase_id IS NULL OR sale_id IS NULL)');

        Schema::table('expenses', function (Blueprint $t) {
            $t->string('voucher_no', 40)->nullable();
            $t->string('method', 12)->default('cash');
        });
        DB::statement('CREATE UNIQUE INDEX expenses_voucher_no_uq ON expenses (tenant_id, voucher_no) WHERE voucher_no IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS expenses_voucher_no_uq');
        Schema::table('expenses', fn (Blueprint $t) => $t->dropColumn(['voucher_no', 'method']));
        DB::statement('ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_one_bill_chk');
        Schema::table('vouchers', function (Blueprint $t) {
            $t->dropIndex(['tenant_id', 'purchase_id']);
            $t->dropIndex(['tenant_id', 'sale_id']);
            $t->dropColumn(['purchase_id', 'sale_id']);
        });
    }
};
