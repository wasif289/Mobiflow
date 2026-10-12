<?php
declare(strict_types=1);

namespace App\Modules\Expenses\Presentation;

use App\Shared\Domain\Money;
use App\Shared\Exceptions\AppException;
use App\Shared\Http\ListResponse as L;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

final class ExpenseController
{
    public function heads(TenantContext $ctx): JsonResponse
    {
        return response()->json(DB::table('expense_heads')->where('tenant_id', $ctx->tenantId())->orderBy('name')->get(['id', 'name']));
    }

    public function storeHead(Request $r, TenantContext $ctx): JsonResponse
    {
        $d = $r->validate(['name' => 'required|string|max:80']);
        $id = DB::table('expense_heads')->insertGetId(['tenant_id' => $ctx->tenantId(), 'name' => $d['name'], 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(['id' => $id, 'name' => $d['name']], 201);
    }

    public function index(Request $r, TenantContext $ctx)
    {
        $base = DB::table('expenses as e')->join('expense_heads as h', 'h.id', '=', 'e.expense_head_id')->join('users as u', 'u.id', '=', 'e.created_by')
            ->where('e.tenant_id', $ctx->tenantId())
            ->when($ctx->branchId(), fn ($q, $b) => $q->where('e.branch_id', $b))
            ->when($r->query('head_id'), fn ($q, $v) => $q->where('e.expense_head_id', (int) $v))
            ->when($r->query('from'), fn ($q, $v) => $q->whereDate('e.expense_date', '>=', $v))
            ->when($r->query('to'), fn ($q, $v) => $q->whereDate('e.expense_date', '<=', $v))
            ->when(trim((string) $r->query('q')), fn ($q, $s) => $q->where(fn ($w) => $w->where('e.notes', 'ilike', L::like($s))->orWhere('h.name', 'ilike', L::like($s))))
            ->selectRaw('e.id, e.expense_date, h.name as head, e.notes, e.amount_minor, u.name as by');

        return L::make($base, $r, ['date' => 'e.expense_date', 'head' => 'h.name', 'amount' => 'e.amount_minor'], 'date',
            'count(*) c, coalesce(sum(amount_minor),0) total',
            fn ($x) => ['id' => $x->id, 'date' => $x->expense_date, 'head' => $x->head, 'notes' => $x->notes, 'amount' => L::m($x->amount_minor), 'by' => $x->by],
            fn ($t) => ['count' => (int) $t->c, 'total' => L::m($t->total)], 'expenses');
    }

    public function store(Request $r, TenantContext $ctx): JsonResponse
    {
        $d = $r->validate([
            'expense_head_id' => 'required|integer', 'amount' => ['required', 'regex:/^\d+(\.\d{1,2})?$/'],
            'expense_date' => 'required|date', 'notes' => 'nullable|string|max:300',
        ]);
        $branch = $ctx->branchId() ?? throw new AppException(422, 'BRANCH_REQUIRED', 'Select a branch first.');
        $amount = Money::parse($d['amount']);
        $amount->minor > 0 || throw new AppException(422, 'INVALID_AMOUNT', 'Amount must be more than zero.', ['amount' => ['Must be more than zero']]);
        DB::table('expense_heads')->where('tenant_id', $ctx->tenantId())->where('id', $d['expense_head_id'])->exists()
            || throw new AppException(422, 'HEAD_NOT_FOUND', 'Pick a valid expense head.', ['expense_head_id' => ['Not found']]);

        $id = DB::table('expenses')->insertGetId([
            'tenant_id' => $ctx->tenantId(), 'branch_id' => $branch, 'expense_head_id' => $d['expense_head_id'], 'amount_minor' => $amount->minor,
            'expense_date' => $d['expense_date'], 'notes' => $d['notes'] ?? null, 'created_by' => $r->user()->id, 'created_at' => now(), 'updated_at' => now(),
        ]);
        return response()->json(['id' => $id], 201);
    }

    public function destroy(Request $r, TenantContext $ctx, int $id): JsonResponse
    {
        DB::table('expenses')->where('tenant_id', $ctx->tenantId())->where('id', $id)->delete() || throw new AppException(404, 'NOT_FOUND', 'The requested resource was not found.');
        return response()->json(null, 204);
    }
}
