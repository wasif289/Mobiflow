<?php
declare(strict_types=1);

namespace App\Modules\Purchasing\Presentation;

use App\Shared\Http\ListResponse as L;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PurchaseListController
{
    public function __invoke(Request $r, TenantContext $ctx)
    {
        $base = DB::table('purchases as p')->join('suppliers as s', 's.id', '=', 'p.supplier_id')
            ->where('p.tenant_id', $ctx->tenantId())
            ->when($ctx->branchId(), fn ($q, $b) => $q->where('p.branch_id', $b))
            ->when($r->query('from'), fn ($q, $v) => $q->whereDate('p.purchase_date', '>=', $v))
            ->when($r->query('to'), fn ($q, $v) => $q->whereDate('p.purchase_date', '<=', $v))
            ->when($r->query('supplier_id'), fn ($q, $v) => $q->where('p.supplier_id', (int) $v))
            ->when($r->query('status') === 'due', fn ($q) => $q->whereColumn('p.paid_minor', '<', 'p.total_minor'))
            ->when($r->query('status') === 'paid', fn ($q) => $q->whereColumn('p.paid_minor', '=', 'p.total_minor'))
            ->when(trim((string) $r->query('q')), function ($q, $s) {
                $like = L::like($s);
                $q->where(fn ($w) => $w->where('p.invoice_no', 'ilike', $like)->orWhere('s.name', 'ilike', $like)
                    ->orWhereExists(fn ($e) => $e->selectRaw('1')->from('stock_items as si')
                        ->whereColumn('si.purchase_id', 'p.id')->where('si.imei', 'like', $like)));
            })
            ->selectRaw('p.id, p.invoice_no, p.purchase_date, s.name as supplier, p.total_minor, p.paid_minor,
                (p.total_minor - p.paid_minor) as due_minor,
                (select count(*) from stock_items x where x.purchase_id = p.id) as qty');

        return L::make($base, $r,
            ['invoice' => 'p.invoice_no', 'date' => 'p.purchase_date', 'supplier' => 's.name', 'qty' => 'qty',
             'total' => 'p.total_minor', 'paid' => 'p.paid_minor', 'due' => '(p.total_minor - p.paid_minor)'], 'date',
            'count(*) c, coalesce(sum(total_minor),0) total, coalesce(sum(paid_minor),0) paid, coalesce(sum(due_minor),0) due, coalesce(sum(qty),0) qty',
            fn ($x) => ['id' => $x->id, 'invoice_no' => $x->invoice_no, 'date' => $x->purchase_date, 'supplier' => $x->supplier,
                'qty' => (int) $x->qty, 'total' => L::m($x->total_minor), 'paid' => L::m($x->paid_minor), 'due' => L::m($x->due_minor)],
            fn ($t) => ['count' => (int) $t->c, 'qty' => (int) $t->qty, 'total' => L::m($t->total), 'paid' => L::m($t->paid), 'due' => L::m($t->due)],
            'purchases');
    }
}
