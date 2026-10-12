<?php
declare(strict_types=1);

namespace App\Shared\Exceptions;

final class ImeiAlreadySold extends AppException
{
    public function __construct(string $imei)
    {
        parent::__construct(409, 'STOCK_ALREADY_SOLD', 'This IMEI is already sold.', ['imei' => [$imei]]);
    }
}
