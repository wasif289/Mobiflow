<?php
declare(strict_types=1);

namespace App\Modules\Billing\Infrastructure;

use App\Modules\Billing\Domain\PaymentGateway;
use App\Shared\Exceptions\AppException;
use Illuminate\Support\Facades\Http;

final class StripeGateway implements PaymentGateway
{
    public function __construct(private readonly string $secret, private readonly string $webhookSecret) {}

    public function name(): string
    {
        return 'stripe';
    }

    public function createCheckout(array $invoice, string $successUrl, string $cancelUrl): array
    {
        $res = Http::asForm()->withToken($this->secret)->timeout(15)->post('https://api.stripe.com/v1/checkout/sessions', [
            'mode' => 'payment', 'success_url' => $successUrl, 'cancel_url' => $cancelUrl,
            'client_reference_id' => (string) $invoice['id'], 'metadata[invoice_id]' => $invoice['id'],
            'line_items[0][quantity]' => 1,
            'line_items[0][price_data][currency]' => strtolower($invoice['currency']),
            'line_items[0][price_data][unit_amount]' => $invoice['amount_minor'],
            'line_items[0][price_data][product_data][name]' => $invoice['description'],
        ]);
        $res->successful() || throw new AppException(502, 'GATEWAY_ERROR', 'Online payment is unavailable right now. Try again, or pay manually.');

        return ['id' => (string) $res->json('id'), 'url' => (string) $res->json('url')];
    }

    public function parseWebhook(string $payload, ?string $signature): array
    {
        $parts = [];
        foreach (explode(',', (string) $signature) as $kv) {
            [$k, $v] = array_pad(explode('=', trim($kv), 2), 2, '');
            $parts[$k][] = $v;
        }
        $ts = (int) ($parts['t'][0] ?? 0);
        $expected = hash_hmac('sha256', "{$ts}.{$payload}", $this->webhookSecret);
        $valid = $this->webhookSecret !== '' && abs(time() - $ts) <= 300
            && collect($parts['v1'] ?? [])->contains(fn ($s) => hash_equals($expected, $s));
        $valid || throw new AppException(400, 'INVALID_SIGNATURE', 'Webhook signature check failed.');

        $e = json_decode($payload, true) ?: [];
        $obj = $e['data']['object'] ?? [];
        return [
            'event_id' => (string) ($e['id'] ?? ''),
            'paid' => ($e['type'] ?? '') === 'checkout.session.completed' && ($obj['payment_status'] ?? '') === 'paid',
            'session_id' => $obj['id'] ?? null,
        ];
    }
}
