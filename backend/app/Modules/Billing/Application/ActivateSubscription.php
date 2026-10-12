<?php
declare(strict_types=1);

namespace App\Modules\Billing\Application;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Marks an invoice paid and extends the shop's subscription. Idempotent: safe to call twice (webhook retries, double clicks). */
final class ActivateSubscription
{
    public function __invoke(int $invoiceId): void
    {
        DB::transaction(function () use ($invoiceId) {
            $inv = DB::table('subscription_invoices')->where('id', $invoiceId)->lockForUpdate()->first();
            if (! $inv || $inv->status === 'paid') {
                return;
            }
            $t = DB::table('tenants')->where('id', $inv->tenant_id)->lockForUpdate()->first();
            $current = $t->current_period_ends_at ? Carbon::parse($t->current_period_ends_at) : null;
            // renewing early keeps the remaining days; an expired or trial shop starts from today
            $from = ($t->status === 'active' && $current?->isFuture()) ? $current : now();

            DB::table('tenants')->where('id', $t->id)->update([
                'plan_id' => $inv->plan_id, 'status' => 'active', 'current_period_ends_at' => $from->copy()->addMonths((int) $inv->period_months), 'updated_at' => now(),
            ]);
            DB::table('subscription_invoices')->where('id', $inv->id)->update(['status' => 'paid', 'paid_at' => now(), 'updated_at' => now()]);
        });
    }
}
