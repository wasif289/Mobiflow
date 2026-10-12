<?php
declare(strict_types=1);

namespace App\Shared\Exceptions;

use RuntimeException;

/** Base for all business-rule errors. Mapped to problem+json centrally. */
class AppException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly ?array $errors = null,
    ) {
        parent::__construct($message);
    }
}
