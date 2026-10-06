<?php
declare(strict_types=1);

namespace App\Modules\Billing\Presentation;

use App\Modules\Billing\Application\ActivateSubscription;
use App\Modules\Billing\Infrastructure\GatewayRegistry;
use App\Shared\Exceptions\AppException;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

final class WebhookController
{
    public function stripe(Request $r, GatewayRegistry $gateways, ActivateSubscription $activate): JsonResponse
    {
        $gw = $gateways->named('stripe') ?? throw new AppException(404, 'NOT_FOUND', 'Not found.');
        $e = $gw->parseWebhook($r->getContent(), $r->header('Stripe-Signature'));

        DB::transaction(function () use ($e, $activate) {
            // the unique key makes a retried delivery a no-op
            if (! $e['paid'] || ! $e['session_id'] || DB::table('payment_events')->insertOrIgnore(['provider' => 'stripe', 'event_id' => $e['event_id']]) === 0) {
                return;
            }
            $p = DB::table('payments')->where('provider', 'stripe')->where('reference', $e['session_id'])->lockForUpdate()->first();
            if ($p && $p->status === 'pending') {
                DB::table('payments')->where('id', $p->id)->update(['status' => 'succeeded', 'reviewed_at' => now(), 'updated_at' => now()]);
                $activate($p->invoice_id);
            }
        });
        return response()->json(['ok' => true]);
    }
}
