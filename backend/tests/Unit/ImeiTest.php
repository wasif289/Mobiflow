<?php
declare(strict_types=1);

use App\Shared\Domain\Imei;

it('accepts a valid IMEI and exposes its TAC', function () {
    $imei = new Imei('490154203237518');
    expect($imei->value)->toBe('490154203237518')->and($imei->tac())->toBe('49015420');
});

it('rejects wrong length or bad checksum', function (string $raw) {
    new Imei($raw);
})->with(['123', '490154203237519'])->throws(InvalidArgumentException::class);
