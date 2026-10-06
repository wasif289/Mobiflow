<?php
declare(strict_types=1);

namespace App\Modules\Transfers\Presentation;

use App\Modules\Identity\Infrastructure\Models\Branch;
use App\Modules\Transfers\Application\Transfers;
use App\Shared\Exceptions\AppException;
use App\Shared\Http\ListResponse as L;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

final class TransferController
{
    public function __construct(private readonly TenantContext $ctx, private readonly Transfers $transfers) {}

    public function branches(): JsonResponse
    {
        return response()->json(Branch::where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']));
    }

    public function index(Request $r)
    {
        $b = $this->ctx->branchId();
        $dir = $r->query('direction');
        $base = DB::table('stock_transfers as t')->join('branches as f', 'f.id', '=', 't.from_branch_id')->join('branches as d', 'd.id', '=', 't.to_branch_id')
            ->where('t.tenant_id', $this->ctx->tenantId())
            ->when($b && $dir === 'in', fn ($q) => $q->where('t.to_branch_id', $b))
            ->when($b && $dir === 'out', fn ($q) => $q->where('t.from_branch_id', $b))
            ->when($b && ! in_array($dir, ['in', 'out'], true), fn ($q) => $q->where(fn ($w) => $w->where('t.from_branch_id', $b)->orWhere('t.to_branch_id', $b)))
            ->when($r->query('status'), fn ($q, $v) => $q->where('t.status', $v))
            ->when($r->query('from'), fn ($q, $v) => $q->whereDate('t.created_at', '>=', $v))
            ->when($r->query('to'), fn ($q, $v) => $q->whereDate('t.created_at', '<=', $v))
            ->when(trim((string) $r->query('q')), function ($q, $s) {
                $like = L::like($s);
                $q->where(fn ($w) => $w->where('t.transfer_no', 'ilike', $like)->orWhereExists(fn ($e) => $e->selectRaw('1')->from('stock_transfer_items as i')
                    ->join('stock_items as si', 'si.id', '=', 'i.stock_item_id')->whereColumn('i.transfer_id', 't.id')->where('si.imei', 'like', $like)));
            })
            ->selectRaw('t.id, t.transfer_no, t.created_at, t.status, t.note, t.from_branch_id, t.to_branch_id, f.name as from_name, d.name as to_name,
                (select count(*) from stock_transfer_items x where x.transfer_id = t.id) as qty');

        return L::make($base, $r, ['date' => 't.created_at', 'no' => 't.transfer_no', 'qty' => 'qty', 'status' => 't.status'], 'date',
            "count(*) c, coalesce(sum(qty),0) qty, count(*) filter (where status = 'pending') pend",
            fn ($x) => ['id' => $x->id, 'transfer_no' => $x->transfer_no, 'date' => substr((string) $x->created_at, 0, 10), 'from_id' => $x->from_branch_id, 'to_id' => $x->to_branch_id,
                'from' => $x->from_name, 'to' => $x->to_name, 'qty' => (int) $x->qty, 'status' => $x->status, 'note' => $x->note],
            fn ($t) => ['count' => (int) $t->c, 'qty' => (int) $t->qty, 'pending' => (int) $t->pend], 'transfers');
    }

    public function show(int $id): JsonResponse
    {
        DB::table('stock_transfers')->where('tenant_id', $this->ctx->tenantId())->where('id', $id)->exists() || throw new AppException(404, 'NOT_FOUND', 'The requested resource was not found.');
        $items = DB::table('stock_transfer_items as i')->join('stock_items as si', 'si.id', '=', 'i.stock_item_id')->join('device_models as dm', 'dm.id', '=', 'si.device_model_id')
            ->join('brands as b', 'b.id', '=', 'dm.brand_id')->where('i.transfer_id', $id)->where('i.tenant_id', $this->ctx->tenantId())->orderBy('i.id')
            ->get(['si.imei', 'b.name as brand', 'dm.name as model'])->map(fn ($x) => ['imei' => $x->imei, 'model' => "{$x->brand} {$x->model}"]);
        return response()->json(['items' => $items]);
    }

    public function store(Request $r): JsonResponse
    {
        $d = $r->validate(['to_branch_id' => 'required|integer', 'note' => 'nullable|string|max:300', 'imeis' => 'required|array|min:1|max:200', 'imeis.*' => 'required|string|max:20']);
        return response()->json($this->transfers->send($d, (int) $r->user()->id), 201);
    }

    public function receive(Request $r, int $id): JsonResponse
    {
        $this->transfers->receive($id, (int) $r->user()->id);
        return response()->json(['ok' => true]);
    }

    public function cancel(int $id): JsonResponse
    {
        $this->transfers->cancel($id);
        return response()->json(['ok' => true]);
    }
}
