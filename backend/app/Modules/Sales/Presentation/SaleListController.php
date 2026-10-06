<?php
declare(strict_types=1);

namespace App\Modules\Sales\Presentation;

use App\Shared\Http\ListResponse as L;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class SaleListController
{
    public function __invoke(Request $r, TenantContext $ctx)
    {
        $admin = $r->user()->seesAllBranches(); // cost and profit are owner/admin only
        $cust = (string) $r->query('customer_id');
        $base = DB::table('sales as s')->leftJoin('customers as c', 'c.id', '=', 's.customer_id')
            ->where('s.tenant_id', $ctx->tenantId())
            ->when($ctx->branchId(), fn ($q, $b) => $q->where('s.branch_id', $b))
            ->when($r->query('from'), fn ($q, $v) => $q->whereDate('s.sale_date', '>=', $v))
            ->when($r->query('to'), fn ($q, $v) => $q->whereDate('s.sale_date', '<=', $v))
            ->when($cust === 'walkin', fn ($q) => $q->whereNull('s.customer_id'))
            ->when(ctype_digit($cust), fn ($q) => $q->where('s.customer_id', (int) $cust))
            ->when($r->query('status') === 'due', fn ($q) => $q->whereColumn('s.received_minor', '<', 's.total_minor'))
            ->when($r->query('status') === 'paid', fn ($q) => $q->whereColumn('s.received_minor', '=', 's.total_minor'))
            ->when(trim((string) $r->query('q')), function ($q, $s) {
                $like = L::like($s);
                $q->where(fn ($w) => $w->where('s.invoice_no', 'ilike', $like)->orWhere('c.name', 'ilike', $like)
                    ->orWhereExists(fn ($e) => $e->selectRaw('1')->from('sale_items as i')->join('stock_items as si', 'si.id', '=', 'i.stock_item_id')
                        ->whereColumn('i.sale_id', 's.id')->where('si.imei', 'like', $like)));
            })
            ->selectRaw('s.id, s.invoice_no, s.sale_date, c.name as customer, s.total_minor, s.received_minor,
                (s.total_minor - s.received_minor) as due_minor,
                (select count(*) from sale_items x where x.sale_id = s.id) as qty,
                (select coalesce(sum(x.cost_minor),0) from sale_items x where x.sale_id = s.id) as cost_minor');

        $sorts = ['invoice' => 's.invoice_no', 'date' => 's.sale_date', 'customer' => 'c.name', 'qty' => 'qty',
            'total' => 's.total_minor', 'received' => 's.received_minor', 'due' => '(s.total_minor - s.received_minor)'];
        $admin && $sorts['profit'] = '(s.total_minor - (select coalesce(sum(y.cost_minor),0) from sale_items y where y.sale_id = s.id))';

        return L::make($base, $r, $sorts, 'date',
            'count(*) c, coalesce(sum(total_minor),0) total, coalesce(sum(received_minor),0) received, coalesce(sum(due_minor),0) due, coalesce(sum(qty),0) qty, coalesce(sum(total_minor - cost_minor),0) profit',
            fn ($x) => ['id' => $x->id, 'invoice_no' => $x->invoice_no, 'date' => $x->sale_date, 'customer' => $x->customer ?? 'Walk-in',
                'qty' => (int) $x->qty, 'total' => L::m($x->total_minor), 'received' => L::m($x->received_minor), 'due' => L::m($x->due_minor)]
                + ($admin ? ['profit' => L::m($x->total_minor - $x->cost_minor)] : []),
            fn ($t) => ['count' => (int) $t->c, 'qty' => (int) $t->qty, 'total' => L::m($t->total), 'received' => L::m($t->received), 'due' => L::m($t->due)]
                + ($admin ? ['profit' => L::m($t->profit)] : []),
            'sales');
    }
}
