<?php
declare(strict_types=1);

namespace App\Shared\Application;

use App\Shared\Domain\Imei;
use App\Shared\Exceptions\AppException;
use InvalidArgumentException;

final class ParseImeis
{
    /** @return list<string> validated, unique IMEIs; 422 listing every problem otherwise */
    public static function from(array $raw): array
    {
        $ok = [];
        $problems = [];
        foreach ($raw as $r) {
            try {
                $v = (new Imei((string) $r))->value;
            } catch (InvalidArgumentException) {
                $problems[] = "{$r}: not a valid IMEI";
                continue;
            }
            if (in_array($v, $ok, true)) { $problems[] = "{$v}: listed twice"; continue; }
            $ok[] = $v;
        }
        $problems && throw new AppException(422, 'INVALID_ITEMS', 'Please fix the IMEIs listed.', ['imei' => $problems]);
        return $ok;
    }
}
