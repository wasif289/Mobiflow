<?php
declare(strict_types=1);

namespace App\Modules\Reporting\Presentation;

use App\Shared\Http\ListResponse as L;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

final class DashboardController
{
    public function __invoke(Request $r, TenantContext $ctx): JsonResponse
    {
        $t = $ctx->tenantId();
        $b = $ctx->branchId();
        $admin = $r->user()->seesAllBranches();
        $today = now()->toDateString();
        $from = $r->query('from') ?: $today;
        $to = $r->query('to') ?: $today;

        // phones sold in the period, excluding lines that were returned
        $lines = DB::table('sale_items as i')->join('sales as s', 's.id', '=', 'i.sale_id')->where('s.tenant_id', $t)
            ->when($b, fn ($q) => $q->where('s.branch_id', $b))->whereBetween('s.sale_date', [$from, $to])
            ->whereNotExists(fn ($e) => $e->selectRaw('1')->from('sale_return_items as x')->whereColumn('x.sale_item_id', 'i.id'))
            ->selectRaw('count(*) q, coalesce(sum(i.price_minor),0) amt, coalesce(sum(i.cost_minor),0) cost')->first();

        $bought = (int) DB::table('purchases')->where('tenant_id', $t)->when($b, fn ($q) => $q->where('branch_id', $b))->whereBetween('purchase_date', [$from, $to])->sum('total_minor')
            - (int) DB::table('purchase_returns')->where('tenant_id', $t)->when($b, fn ($q) => $q->where('branch_id', $b))->whereBetween('return_date', [$from, $to])->sum('total_minor');
        $spent = (int) DB::table('expenses')->where('tenant_id', $t)->when($b, fn ($q) => $q->where('branch_id', $b))->whereBetween('expense_date', [$from, $to])->sum('amount_minor');
        $stock = DB::table('stock_items')->where('tenant_id', $t)->where('status', 'in_stock')->when($b, fn ($q) => $q->where('branch_id', $b))->count();
        $recv = (int) DB::table('ledger_entries')->where('tenant_id', $t)->where('party_type', 'customer')->sum(DB::raw('debit_minor - credit_minor'));
        $pay = (int) DB::table('ledger_entries')->where('tenant_id', $t)->where('party_type', 'supplier')->sum(DB::raw('credit_minor - debit_minor'));

        $recent = DB::table('sales as s')->leftJoin('customers as c', 'c.id', '=', 's.customer_id')->where('s.tenant_id', $t)
            ->when($b, fn ($q) => $q->where('s.branch_id', $b))->orderByDesc('s.sale_date')->orderByDesc('s.id')->limit(6)
            ->get(['s.id', 's.invoice_no', 's.sale_date', 'c.name as customer', 's.total_minor'])
            ->map(fn ($x) => ['id' => $x->id, 'invoice_no' => $x->invoice_no, 'date' => $x->sale_date, 'customer' => $x->customer ?? 'Walk-in', 'total' => L::m($x->total_minor)]);

        $profit = (int) $lines->amt - (int) $lines->cost;
        return response()->json([
            'from' => $from, 'to' => $to, 'sales' => L::m($lines->amt), 'qty_sold' => (int) $lines->q, 'purchases' => L::m($bought),
            'expenses' => L::m($spent), 'in_stock' => $stock, 'receivable' => L::m($recv), 'payable' => L::m($pay), 'recent' => $recent,
        ] + ($admin ? ['profit' => L::m($profit), 'net_profit' => L::m($profit - $spent)] : []));
    }
}
