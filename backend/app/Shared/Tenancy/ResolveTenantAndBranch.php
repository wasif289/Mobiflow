<?php
declare(strict_types=1);

namespace App\Shared\Tenancy;

use App\Shared\Exceptions\AppException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Run AFTER auth:sanctum. Tenant comes from the user, branch from X-Branch-Id. */
final class ResolveTenantAndBranch
{
    public function __construct(private readonly TenantContext $ctx) {}

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user() ?? throw new AppException(401, 'UNAUTHENTICATED', 'Please sign in.');
        $user instanceof \App\Modules\Identity\Infrastructure\Models\User || throw new AppException(403, 'FORBIDDEN', 'This area is for shop users.');
        $this->ctx->set((int) $user->tenant_id);

        $branchId = $request->header('X-Branch-Id');
        if ($branchId !== null) {
            $allowed = in_array($user->role, ['owner', 'admin'], true)
                || DB::table('branch_user')->where('user_id', $user->id)->where('branch_id', (int) $branchId)->exists();
            $allowed || throw new AppException(403, 'BRANCH_ACCESS_DENIED', 'You do not have access to this branch.');
            $this->ctx->set((int) $user->tenant_id, (int) $branchId);
        }

        return $next($request);
    }

    /** Never leak context to the next request (Octane / pooled connections). */
    public function terminate(): void
    {
        $this->ctx->clear();
    }
}
