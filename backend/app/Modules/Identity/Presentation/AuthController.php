<?php
declare(strict_types=1);

namespace App\Modules\Identity\Presentation;

use App\Modules\Identity\Infrastructure\Models\{Branch, User};
use App\Shared\Exceptions\AppException;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\Hash;

final class AuthController
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['username' => 'required|string|max:50', 'password' => 'required|string']);

        $user = User::where('username', $data['username'])->first();
        // same message for unknown user / wrong password / inactive: no account enumeration
        if (! $user || ! $user->is_active || ! Hash::check($data['password'], $user->password)) {
            throw new AppException(401, 'INVALID_CREDENTIALS', 'Wrong username or password.');
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'token' => $user->createToken('web')->plainTextToken,
            'user' => $this->payload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->payload($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(null, 204);
    }

    public function payload(User $user): array
    {
        $branches = ($user->seesAllBranches()
            ? Branch::where('is_active', true)
            : $user->branches()->where('is_active', true))
            ->orderByDesc('is_main')->orderBy('name')->get(['branches.id', 'code', 'name', 'is_main']);

        return [
            'name' => $user->name, 'username' => $user->username, 'role' => $user->role,
            'branches' => $branches,
        ];
    }
}
