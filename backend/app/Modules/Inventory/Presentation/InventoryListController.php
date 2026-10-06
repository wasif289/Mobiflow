<?php
declare(strict_types=1);

namespace App\Modules\Inventory\Presentation;

use App\Shared\Http\ListResponse as L;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class InventoryListController
{
    public function __invoke(Request $r, TenantContext $ctx)
    {
        $admin = $r->user()->seesAllBranches();
        $base = DB::table('stock_items as si')
            ->join('device_models as dm', 'dm.id', '=', 'si.device_model_id')->join('brands as b', 'b.id', '=', 'dm.brand_id')
            ->leftJoin('colors as col', 'col.id', '=', 'si.color_id')
            ->join('purchases as p', 'p.id', '=', 'si.purchase_id')->join('suppliers as s', 's.id', '=', 'p.supplier_id')
            ->leftJoinLateral(DB::table('sale_items as sit')->whereColumn('sit.stock_item_id', 'si.id')->orderByDesc('sit.id')->limit(1)
                ->select('sit.price_minor', 'sit.sale_id'), 'li')
            ->leftJoin('sales as sl', 'sl.id', '=', 'li.sale_id')->leftJoin('customers as cu', 'cu.id', '=', 'sl.customer_id')
            ->where('si.tenant_id', $ctx->tenantId())
            ->when($ctx->branchId(), fn ($q, $x) => $q->where('si.branch_id', $x))
            ->when($r->query('status'), fn ($q, $v) => $q->where('si.status', $v))
            ->when($r->query('brand_id'), fn ($q, $v) => $q->where('b.id', (int) $v))
            ->when($r->query('supplier_id'), fn ($q, $v) => $q->where('s.id', (int) $v))
            ->when($r->query('from'), fn ($q, $v) => $q->whereDate('p.purchase_date', '>=', $v))
            ->when($r->query('to'), fn ($q, $v) => $q->whereDate('p.purchase_date', '<=', $v))
            ->when(trim((string) $r->query('q')), function ($q, $s) {
                $like = L::like($s);
                $q->where(fn ($w) => $w->where('si.imei', 'like', $like)->orWhere('b.name', 'ilike', $like)->orWhere('dm.name', 'ilike', $like)
                    ->orWhere('p.invoice_no', 'ilike', $like)->orWhere('s.name', 'ilike', $like)->orWhere('sl.invoice_no', 'ilike', $like));
            })
            ->selectRaw("si.id, si.imei, si.status, b.name as brand, dm.name as model, col.name as color, si.cost_minor,
                p.invoice_no as entry_no, p.purchase_date, s.name as supplier,
                case when si.status = 'sold' then li.price_minor end as sale_minor,
                case when si.status = 'sold' then li.price_minor - si.cost_minor end as profit_minor,
                case when si.status = 'sold' then sl.invoice_no end as sale_invoice,
                case when si.status = 'sold' then coalesce(cu.name, 'Walk-in') end as customer");

        $sorts = ['imei' => 'si.imei', 'brand' => 'b.name', 'model' => 'dm.name', 'entry' => 'p.invoice_no', 'date' => 'p.purchase_date',
            'supplier' => 's.name', 'sale' => 'sale_minor'];
        $admin && $sorts += ['cost' => 'si.cost_minor', 'profit' => 'profit_minor'];

        return L::make($base, $r, $sorts, 'date',
            'count(*) c, coalesce(sum(cost_minor),0) cost, coalesce(sum(sale_minor),0) sale, coalesce(sum(profit_minor),0) profit',
            fn ($x) => ['id' => $x->id, 'imei' => $x->imei, 'brand' => $x->brand, 'model' => $x->model, 'color' => $x->color, 'status' => $x->status,
                'entry_no' => $x->entry_no, 'date' => $x->purchase_date, 'supplier' => $x->supplier,
                'sale' => $x->sale_minor === null ? null : L::m($x->sale_minor), 'sale_invoice' => $x->sale_invoice, 'customer' => $x->customer]
                + ($admin ? ['cost' => L::m($x->cost_minor), 'profit' => $x->profit_minor === null ? null : L::m($x->profit_minor)] : []),
            fn ($t) => ['count' => (int) $t->c, 'sale' => L::m($t->sale)] + ($admin ? ['cost' => L::m($t->cost), 'profit' => L::m($t->profit)] : []),
            'inventory');
    }
}
