<?php
declare(strict_types=1);

namespace App\Shared\Domain;

use InvalidArgumentException;

/** Immutable money in minor units (paisa). Never use floats for currency. */
final readonly class Money
{
    private function __construct(public int $minor, public string $currency = 'PKR') {}

    public static function ofMinor(int $minor, string $currency = 'PKR'): self
    {
        return new self($minor, $currency);
    }

    public static function parse(string $amount, string $currency = 'PKR'): self
    {
        if (! preg_match('/^-?\d+(\.\d{1,2})?$/', $amount)) {
            throw new InvalidArgumentException("Invalid amount: {$amount}");
        }
        return new self((int) round(((float) $amount) * 100), $currency);
    }

    public function add(self $o): self { return new self($this->minor + $this->same($o)->minor, $this->currency); }
    public function sub(self $o): self { return new self($this->minor - $this->same($o)->minor, $this->currency); }
    public function isNegative(): bool { return $this->minor < 0; }
    public function toDecimal(): string { return number_format($this->minor / 100, 2, '.', ''); }

    private function same(self $o): self
    {
        $o->currency === $this->currency || throw new InvalidArgumentException('Currency mismatch');
        return $o;
    }
}
