<?php
declare(strict_types=1);

namespace App\Modules\Platform\Presentation;

use App\Modules\Platform\Infrastructure\SuperAdmin;
use App\Shared\Exceptions\AppException;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\Hash;

final class PlatformAuthController
{
    public function login(Request $r): JsonResponse
    {
        $d = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        $a = SuperAdmin::where('email', strtolower($d['email']))->first();
        if (! $a || ! Hash::check($d['password'], $a->password)) {
            throw new AppException(401, 'INVALID_CREDENTIALS', 'Wrong email or password.');
        }
        return response()->json(['token' => $a->createToken('platform', ['platform'])->plainTextToken, 'admin' => ['name' => $a->name, 'email' => $a->email]]);
    }
}
