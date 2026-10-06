<?php
declare(strict_types=1);

namespace App\Modules\Billing\Presentation;

use App\Modules\Billing\Application\PlatformSettings;
use App\Modules\Billing\Infrastructure\GatewayRegistry;
use App\Shared\Exceptions\AppException;
use App\Shared\Http\ListResponse as L;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Shop side of billing. Owner/admin only. Platform tables have no RLS, so every query filters by tenant_id here. */
final class BillingController
{
    public function __construct(private readonly TenantContext $ctx, private readonly GatewayRegistry $gateways) {}

    public function show(): JsonResponse
    {
        $t = $this->ctx->tenantId();
        $s = DB::table('tenants as t')->leftJoin('plans as p', 'p.id', '=', 't.plan_id')->where('t.id', $t)
            ->first(['t.status', 't.trial_ends_at', 't.current_period_ends_at', 'p.name as plan']);
        $plans = DB::table('plans')->where('is_active', true)->orderBy('sort_order')->orderBy('price_minor')->get()->map(fn ($p) => [
            'id' => $p->id, 'name' => $p->name, 'max_users' => $p->max_users, 'max_branches' => $p->max_branches, 'currency' => $p->currency,
            'price' => L::m($p->price_minor), 'yearly_price' => L::m($p->yearly_price_minor ?? $p->price_minor * 12)]);
        $invoices = DB::table('subscription_invoices as i')->join('plans as p', 'p.id', '=', 'i.plan_id')->where('i.tenant_id', $t)->orderByDesc('i.id')->limit(20)
            ->selectRaw('i.id, i.invoice_no, i.created_at, i.status, i.period_months, i.amount_minor, i.currency, p.name as plan,
                (select status from payments x where x.invoice_id = i.id order by x.id desc limit 1) as payment_status,
                (select review_note from payments x where x.invoice_id = i.id order by x.id desc limit 1) as review_note')->get()
            ->map(fn ($i) => ['id' => $i->id, 'invoice_no' => $i->invoice_no, 'date' => substr((string) $i->created_at, 0, 10), 'status' => $i->status, 'months' => $i->period_months,
                'amount' => L::m($i->amount_minor), 'currency' => $i->currency, 'plan' => $i->plan, 'payment_status' => $i->payment_status, 'review_note' => $i->review_note]);

        return response()->json([
            'subscription' => ['status' => $s->status, 'plan' => $s->plan ?? 'No plan', 'trial_ends_at' => $s->trial_ends_at, 'period_ends_at' => $s->current_period_ends_at],
            'plans' => $plans, 'invoices' => $invoices,
            'options' => ['gateway' => $this->gateways->active()?->name(), 'manual' => $this->manualMethods()],
        ]);
    }

    public function createInvoice(Request $r): JsonResponse
    {
        $d = $r->validate(['plan_id' => 'required|integer', 'months' => 'required|in:1,12']);
        $plan = DB::table('plans')->where('id', $d['plan_id'])->where('is_active', true)->first()
            ?? throw new AppException(422, 'PLAN_NOT_FOUND', 'That plan is not available.', ['plan_id' => ['Not available']]);
        $months = (int) $d['months'];
        $amount = $months === 12 ? ($plan->yearly_price_minor ?? $plan->price_minor * 12) : $plan->price_minor;
        $amount > 0 || throw new AppException(422, 'PLAN_NOT_PURCHASABLE', 'This plan has no price set.');

        // drop old unpaid invoices that have no payment under review
        DB::table('subscription_invoices')->where('tenant_id', $this->ctx->tenantId())->where('status', 'pending')
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('payments as p')->whereColumn('p.invoice_id', 'subscription_invoices.id')->where('p.status', 'pending'))
            ->update(['status' => 'cancelled', 'updated_at' => now()]);

        $id = DB::table('subscription_invoices')->insertGetId([
            'tenant_id' => $this->ctx->tenantId(), 'plan_id' => $plan->id, 'invoice_no' => 'INV-' . now()->format('ymd') . '-' . Str::upper(Str::random(5)),
            'period_months' => $months, 'amount_minor' => $amount * ($months === 12 ? 1 : 1), 'currency' => $plan->currency, 'created_at' => now(), 'updated_at' => now(),
        ]);
        return response()->json(['id' => $id], 201);
    }

    public function checkout(int $id): JsonResponse
    {
        $inv = $this->pendingInvoice($id);
        $gw = $this->gateways->active() ?? throw new AppException(422, 'NO_GATEWAY', 'Online payment is not enabled. Please pay manually.');
        $front = rtrim((string) config('billing.frontend_url'), '/');
        $s = $gw->createCheckout(['id' => $inv->id, 'amount_minor' => $inv->amount_minor, 'currency' => $inv->currency, 'description' => "MobiFlow subscription {$inv->invoice_no}"],
            "{$front}/billing?paid=1", "{$front}/billing");

        DB::table('payments')->insert(['tenant_id' => $inv->tenant_id, 'invoice_id' => $inv->id, 'method' => 'gateway', 'provider' => $gw->name(),
            'amount_minor' => $inv->amount_minor, 'reference' => $s['id'], 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(['url' => $s['url']]);
    }

    public function manualPayment(Request $r, int $id): JsonResponse
    {
        $inv = $this->pendingInvoice($id);
        $enabled = collect($this->manualMethods())->pluck('key')->all();
        $d = $r->validate([
            'method' => 'required|in:' . implode(',', $enabled ?: ['none']), 'reference' => 'required|string|max:100',
            'note' => 'nullable|string|max:300', 'proof' => 'required|file|mimes:jpg,jpeg,png,pdf|max:4096',
        ]);
        DB::table('payments')->where('invoice_id', $inv->id)->where('status', 'pending')->exists()
            && throw new AppException(409, 'PAYMENT_PENDING', 'A payment for this invoice is already waiting for review.');

        DB::table('payments')->insert(['tenant_id' => $inv->tenant_id, 'invoice_id' => $inv->id, 'method' => 'manual', 'provider' => $d['method'],
            'amount_minor' => $inv->amount_minor, 'reference' => $d['reference'], 'note' => $d['note'] ?? null,
            'proof_path' => $r->file('proof')->store("proofs/{$inv->tenant_id}"), 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(['status' => 'pending'], 201);
    }

    private function pendingInvoice(int $id): object
    {
        return DB::table('subscription_invoices')->where('id', $id)->where('tenant_id', $this->ctx->tenantId())->where('status', 'pending')->first()
            ?? throw new AppException(404, 'NOT_FOUND', 'That invoice is not open any more.');
    }

    private function manualMethods(): array
    {
        return array_values(array_map(fn ($m) => ['key' => $m['key'], 'label' => $m['label'], 'details' => $m['details']],
            array_filter(PlatformSettings::get('manual_methods', []), fn ($m) => ! empty($m['enabled']))));
    }
}
