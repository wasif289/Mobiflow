<?php
declare(strict_types=1);

namespace App\Modules\Billing\Application;

use Illuminate\Support\Facades\DB;

final class PlatformSettings
{
    public static function get(string $key, mixed $default = null): mixed
    {
        $v = DB::table('platform_settings')->where('key', $key)->value('value');
        return $v === null ? $default : json_decode((string) $v, true);
    }

    public static function put(string $key, mixed $value): void
    {
        DB::table('platform_settings')->upsert([['key' => $key, 'value' => json_encode($value)]], ['key'], ['value']);
    }
}
