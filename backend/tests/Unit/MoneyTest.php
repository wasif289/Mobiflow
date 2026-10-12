<?php

declare(strict_types=1);

use App\Shared\Domain\Money;

it('parses decimals into minor units and does exact arithmetic', function () {
    expect(Money::parse('12.34')->minor)->toBe(1234)
        ->and(Money::parse('0.10')->add(Money::parse('0.20'))->minor)->toBe(30)
        ->and(Money::parse('5')->sub(Money::parse('7.50'))->toDecimal())->toBe('-2.50');
});

it('rejects bad amounts and mixed currencies', function () {
    expect(fn () => Money::parse('1.234'))->toThrow(InvalidArgumentException::class)
        ->and(fn () => Money::parse('abc'))->toThrow(InvalidArgumentException::class)
        ->and(fn () => Money::ofMinor(1, 'PKR')->add(Money::ofMinor(1, 'USD')))->toThrow(InvalidArgumentException::class);
});
