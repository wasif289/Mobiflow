<?php
declare(strict_types=1);

namespace App\Modules\Billing\Infrastructure;

use App\Modules\Billing\Domain\PaymentGateway;

final class GatewayRegistry
{
    public function active(): ?PaymentGateway
    {
        return $this->named((string) config('billing.gateway'));
    }

    public function named(string $name): ?PaymentGateway
    {
        return match ($name) {
            'stripe' => filled(config('billing.stripe.secret'))
                ? new StripeGateway((string) config('billing.stripe.secret'), (string) config('billing.stripe.webhook_secret')) : null,
            default => null,
        };
    }
}
