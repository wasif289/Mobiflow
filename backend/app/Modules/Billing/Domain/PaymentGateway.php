<?php
declare(strict_types=1);

namespace App\Modules\Billing\Domain;

/** One adapter per provider. Adding a gateway = one new class + one line in GatewayRegistry. */
interface PaymentGateway
{
    public function name(): string;

    /** @param array{id:int,amount_minor:int,currency:string,description:string} $invoice @return array{id:string,url:string} */
    public function createCheckout(array $invoice, string $successUrl, string $cancelUrl): array;

    /** Verify the signature and normalise the event. Throws AppException(400) when it is not authentic.
     *  @return array{event_id:string,paid:bool,session_id:?string} */
    public function parseWebhook(string $payload, ?string $signature): array;
}
