<?php
declare(strict_types=1);

namespace App\Modules\Reporting\Presentation;

use App\Shared\Domain\Money;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class DashboardController
{
    public function __invoke(TenantContext $ctx): JsonResponse
    {
        $b = $ctx->branchId();
        $sales = DB::table('sales')->whereDate('sale_date', now()->toDateString())->when($b, fn ($q) => $q->where('branch_id', $b))->sum('total_minor');
        $stock = DB::table('stock_items')->where('status', 'in_stock')->when($b, fn ($q) => $q->where('branch_id', $b))->count();
        $recv = DB::table('ledger_entries')->where('party_type', 'customer')->sum(DB::raw('debit_minor - credit_minor'));
        $pay = DB::table('ledger_entries')->where('party_type', 'supplier')->sum(DB::raw('credit_minor - debit_minor'));

        return response()->json([
            'today_sales' => Money::ofMinor((int) $sales)->toDecimal(), 'in_stock' => $stock,
            'receivable' => Money::ofMinor((int) $recv)->toDecimal(), 'payable' => Money::ofMinor((int) $pay)->toDecimal(),
        ]);
    }
}
