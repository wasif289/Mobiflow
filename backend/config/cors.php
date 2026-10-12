<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter(explode(',', env('CORS_ORIGINS', 'http://localhost:3000'))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'], // X-Tenant, X-Branch-Id, X-Request-Id
    'exposed_headers' => ['X-Trace-Id'],
    'max_age' => 0,
    'supports_credentials' => false,
];
