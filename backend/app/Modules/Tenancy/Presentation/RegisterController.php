<?php
declare(strict_types=1);

namespace App\Modules\Tenancy\Presentation;

use App\Modules\Identity\Presentation\AuthController;
use App\Modules\Tenancy\Application\RegisterShop;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

final class RegisterController
{
    public function __invoke(Request $request, RegisterShop $register, AuthController $auth, TenantContext $ctx): JsonResponse
    {
        $request->merge(['slug' => strtolower((string) $request->input('slug'))]);
        $data = $request->validate([
            'shop_name' => 'required|string|max:100',
            'slug' => ['required', 'alpha_dash:ascii', 'min:3', 'max:30', 'unique:tenants,slug',
                Rule::notIn(['www', 'api', 'app', 'admin', 'billing', 'status'])],
            'name' => 'required|string|max:100',
            'username' => 'required|alpha_dash:ascii|max:50',
            'password' => ['required', Password::min(8)],
        ]);

        $user = $register($data);

        $ctx->set((int) $user->tenant_id); // payload() reads branches, so RLS needs the context again
        try {
            return response()->json([
                'token' => $user->createToken('web')->plainTextToken,
                'user' => $auth->payload($user),
                'tenant' => $data['slug'],
            ], 201);
        } finally {
            $ctx->clear();
        }
    }
}
