<?php
declare(strict_types=1);

namespace App\Shared\Domain;

use InvalidArgumentException;

/** 15-digit IMEI validated with the Luhn checksum. */
final readonly class Imei implements \Stringable
{
    public string $value;

    public function __construct(string $raw)
    {
        $v = preg_replace('/\D/', '', $raw) ?? '';
        if (strlen($v) !== 15 || ! self::luhn($v)) {
            throw new InvalidArgumentException('Invalid IMEI');
        }
        $this->value = $v;
    }

    /** Type Allocation Code: first 8 digits, maps to brand/model. */
    public function tac(): string { return substr($this->value, 0, 8); }
    public function __toString(): string { return $this->value; }

    private static function luhn(string $n): bool
    {
        $sum = 0;
        foreach (array_reverse(str_split($n)) as $i => $d) {
            $d = (int) $d;
            if ($i % 2 === 1 && ($d *= 2) > 9) { $d -= 9; }
            $sum += $d;
        }
        return $sum % 10 === 0;
    }
}
