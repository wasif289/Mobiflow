<?php

return [
    'gateway' => env('BILLING_GATEWAY'), // null = manual payments only, or 'stripe'
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),
    'grace_days' => 3,
    'stripe' => ['secret' => env('STRIPE_SECRET'), 'webhook_secret' => env('STRIPE_WEBHOOK_SECRET')],
];
