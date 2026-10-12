<?php
declare(strict_types=1);

namespace App\Modules\Platform\Presentation;

use App\Modules\Billing\Application\{ActivateSubscription, PlatformSettings};
use App\Shared\Domain\Money;
use App\Shared\Exceptions\AppException;
use App\Shared\Http\ListResponse as L;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\{DB, Storage};
use Illuminate\Support\Carbon;

final class PlatformController
{
    public function overview(): JsonResponse
    {
        $by = DB::table('tenants')->whereNull('deleted_at')->selectRaw('status, count(*) c')->groupBy('status')->pluck('c', 'status');
        $revenue = (int) DB::table('payments')->where('status', 'succeeded')->where('reviewed_at', '>=', now()->startOfMonth())->sum('amount_minor');
        $mrr = (int) DB::table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->where('t.status', 'active')->whereNull('t.deleted_at')->sum('p.price_minor');
        return response()->json([
            'shops' => ['total' => (int) $by->sum(), 'trial' => (int) ($by['trial'] ?? 0), 'active' => (int) ($by['active'] ?? 0),
                'past_due' => (int) ($by['past_due'] ?? 0), 'suspended' => (int) ($by['suspended'] ?? 0), 'cancelled' => (int) ($by['cancelled'] ?? 0)],
            'pending_payments' => DB::table('payments')->where('status', 'pending')->count(),
            'revenue_this_month' => L::m($revenue), 'mrr_estimate' => L::m($mrr),
        ]);
    }

    // ---------- shops ----------
    public function tenants(Request $r)
    {
        $base = DB::table('tenants as t')->leftJoin('plans as p', 'p.id', '=', 't.plan_id')->whereNull('t.deleted_at')
            ->when($r->query('status'), fn ($q, $v) => $q->where('t.status', $v))
            ->when($r->query('plan_id'), fn ($q, $v) => $q->where('t.plan_id', (int) $v))
            ->when(trim((string) $r->query('q')), fn ($q, $s) => $q->where(fn ($w) => $w->where('t.name', 'ilike', L::like($s))->orWhere('t.slug', 'ilike', L::like($s))))
            ->selectRaw('t.id, t.name, t.slug, t.status, t.plan_id, p.name as plan, t.trial_ends_at, t.current_period_ends_at, t.created_at');

        return L::make($base, $r, ['name' => 't.name', 'created' => 't.created_at', 'status' => 't.status', 'plan' => 'p.name', 'period' => 't.current_period_ends_at'], 'created',
            'count(*) c', fn ($x) => ['id' => $x->id, 'name' => $x->name, 'slug' => $x->slug, 'status' => $x->status, 'plan_id' => $x->plan_id, 'plan' => $x->plan,
                'trial_ends_at' => $x->trial_ends_at, 'period_ends_at' => $x->current_period_ends_at, 'created' => substr((string) $x->created_at, 0, 10)],
            fn ($t) => ['count' => (int) $t->c], 'shops');
    }

    public function setStatus(Request $r, int $id): JsonResponse
    {
        $d = $r->validate(['status' => 'required|in:active,suspended,cancelled']);
        DB::table('tenants')->where('id', $id)->whereNull('deleted_at')->update(['status' => $d['status'], 'updated_at' => now()]) || throw new AppException(404, 'NOT_FOUND', 'Shop not found.');
        return response()->json(['ok' => true]);
    }

    public function extend(Request $r, int $id): JsonResponse
    {
        $d = $r->validate(['days' => 'required|integer|min:1|max:365']);
        $t = DB::table('tenants')->where('id', $id)->whereNull('deleted_at')->first() ?? throw new AppException(404, 'NOT_FOUND', 'Shop not found.');
        $col = $t->status === 'trial' ? 'trial_ends_at' : 'current_period_ends_at';
        $cur = $t->{$col} ? Carbon::parse($t->{$col}) : null;
        $update = [$col => ($cur?->isFuture() ? $cur : now())->copy()->addDays((int) $d['days']), 'updated_at' => now()];
        in_array($t->status, ['past_due', 'suspended'], true) && $update['status'] = 'active';
        DB::table('tenants')->where('id', $id)->update($update);
        return response()->json(['ok' => true]);
    }

    public function setPlan(Request $r, int $id): JsonResponse
    {
        $d = $r->validate(['plan_id' => 'required|integer|exists:plans,id']);
        DB::table('tenants')->where('id', $id)->update(['plan_id' => $d['plan_id'], 'updated_at' => now()]);
        return response()->json(['ok' => true]);
    }

    // ---------- payments ----------
    public function payments(Request $r)
    {
        $base = DB::table('payments as pay')->join('tenants as t', 't.id', '=', 'pay.tenant_id')->join('subscription_invoices as i', 'i.id', '=', 'pay.invoice_id')
            ->join('plans as p', 'p.id', '=', 'i.plan_id')
            ->when($r->query('status'), fn ($q, $v) => $q->where('pay.status', $v))
            ->when($r->query('provider'), fn ($q, $v) => $q->where('pay.provider', $v))
            ->when($r->query('from'), fn ($q, $v) => $q->whereDate('pay.created_at', '>=', $v))
            ->when($r->query('to'), fn ($q, $v) => $q->whereDate('pay.created_at', '<=', $v))
            ->when(trim((string) $r->query('q')), fn ($q, $s) => $q->where(fn ($w) => $w->where('t.name', 'ilike', L::like($s))->orWhere('i.invoice_no', 'ilike', L::like($s))->orWhere('pay.reference', 'ilike', L::like($s))))
            ->selectRaw('pay.id, pay.created_at, t.name as shop, i.invoice_no, p.name as plan, i.period_months, pay.amount_minor, pay.method, pay.provider, pay.reference, pay.status, pay.review_note, (pay.proof_path is not null) as has_proof');

        return L::make($base, $r, ['date' => 'pay.created_at', 'shop' => 't.name', 'amount' => 'pay.amount_minor', 'status' => 'pay.status'], 'date',
            "count(*) c, coalesce(sum(amount_minor),0) amt, count(*) filter (where status = 'pending') pend",
            fn ($x) => ['id' => $x->id, 'date' => substr((string) $x->created_at, 0, 16), 'shop' => $x->shop, 'invoice_no' => $x->invoice_no, 'plan' => $x->plan, 'months' => $x->period_months,
                'amount' => L::m($x->amount_minor), 'method' => $x->method, 'provider' => $x->provider, 'reference' => $x->reference, 'status' => $x->status, 'review_note' => $x->review_note, 'has_proof' => (bool) $x->has_proof],
            fn ($t) => ['count' => (int) $t->c, 'amount' => L::m($t->amt), 'pending' => (int) $t->pend], 'payments');
    }

    public function approve(Request $r, int $id, ActivateSubscription $activate): JsonResponse
    {
        DB::transaction(function () use ($r, $id, $activate) {
            $p = DB::table('payments')->where('id', $id)->lockForUpdate()->first() ?? throw new AppException(404, 'NOT_FOUND', 'Payment not found.');
            ($p->status === 'pending' && $p->method === 'manual') || throw new AppException(409, 'NOT_PENDING', 'Only pending manual payments can be approved.');
            DB::table('payments')->where('id', $id)->update(['status' => 'succeeded', 'reviewed_by' => $r->user()->id, 'reviewed_at' => now(), 'updated_at' => now()]);
            $activate($p->invoice_id);
        });
        return response()->json(['ok' => true]);
    }

    public function reject(Request $r, int $id): JsonResponse
    {
        $d = $r->validate(['reason' => 'required|string|max:300']);
        DB::table('payments')->where('id', $id)->where('status', 'pending')->where('method', 'manual')
            ->update(['status' => 'rejected', 'review_note' => $d['reason'], 'reviewed_by' => $r->user()->id, 'reviewed_at' => now(), 'updated_at' => now()])
            || throw new AppException(409, 'NOT_PENDING', 'Only pending manual payments can be rejected.');
        return response()->json(['ok' => true]);
    }

    public function proof(int $id)
    {
        $path = DB::table('payments')->where('id', $id)->value('proof_path');
        return ($path && Storage::exists($path)) ? Storage::response($path) : throw new AppException(404, 'NOT_FOUND', 'No proof was uploaded.');
    }

    // ---------- plans + settings ----------
    public function plans(): JsonResponse
    {
        return response()->json(DB::table('plans')->orderBy('sort_order')->get()->map(fn ($p) => [
            'id' => $p->id, 'code' => $p->code, 'name' => $p->name, 'max_users' => $p->max_users, 'max_branches' => $p->max_branches, 'currency' => $p->currency,
            'price' => L::m($p->price_minor), 'yearly_price' => $p->yearly_price_minor === null ? null : L::m($p->yearly_price_minor), 'is_active' => (bool) $p->is_active, 'sort_order' => $p->sort_order]));
    }

    public function savePlan(Request $r, ?int $id = null): JsonResponse
    {
        $money = 'regex:/^\d+(\.\d{1,2})?$/';
        $d = $r->validate([
            'code' => [$id ? 'prohibited' : 'required', 'alpha_dash:ascii', 'max:30', 'unique:plans,code'], 'name' => 'required|string|max:60',
            'max_users' => 'nullable|integer|min:1', 'max_branches' => 'nullable|integer|min:1', 'price' => ['required', $money], 'yearly_price' => ['nullable', $money],
            'is_active' => 'boolean', 'sort_order' => 'integer|min:0',
        ]);
        $row = ['name' => $d['name'], 'max_users' => $d['max_users'] ?? null, 'max_branches' => $d['max_branches'] ?? null, 'price_minor' => Money::parse($d['price'])->minor,
            'yearly_price_minor' => isset($d['yearly_price']) ? Money::parse($d['yearly_price'])->minor : null, 'is_active' => $d['is_active'] ?? true,
            'sort_order' => $d['sort_order'] ?? 0, 'updated_at' => now()];
        if ($id) {
            DB::table('plans')->where('id', $id)->update($row) || throw new AppException(404, 'NOT_FOUND', 'Plan not found.');
            return response()->json(['id' => $id]);
        }
        return response()->json(['id' => DB::table('plans')->insertGetId($row + ['code' => strtolower($d['code']), 'features' => '{}', 'currency' => 'PKR', 'created_at' => now()])], 201);
    }

    public function settings(): JsonResponse
    {
        return response()->json(['manual_methods' => PlatformSettings::get('manual_methods', [
            ['key' => 'bank', 'label' => 'Bank transfer', 'details' => '', 'enabled' => false],
            ['key' => 'jazzcash', 'label' => 'JazzCash', 'details' => '', 'enabled' => false],
            ['key' => 'easypaisa', 'label' => 'Easypaisa', 'details' => '', 'enabled' => false]])]);
    }

    public function saveSettings(Request $r): JsonResponse
    {
        $d = $r->validate(['manual_methods' => 'required|array|max:10', 'manual_methods.*.key' => 'required|alpha_dash:ascii|max:20', 'manual_methods.*.label' => 'required|string|max:40',
            'manual_methods.*.details' => 'nullable|string|max:500', 'manual_methods.*.enabled' => 'boolean']);
        PlatformSettings::put('manual_methods', array_map(fn ($m) => ['key' => $m['key'], 'label' => $m['label'], 'details' => $m['details'] ?? '', 'enabled' => (bool) ($m['enabled'] ?? false)], $d['manual_methods']));
        return $this->settings();
    }
}
