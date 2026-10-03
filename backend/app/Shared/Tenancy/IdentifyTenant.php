<?php
declare(strict_types=1);

namespace App\Shared\Tenancy;

use App\Shared\Exceptions\AppException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Runs BEFORE auth: resolves the shop from X-Tenant header (or subdomain) so Sanctum can load the user under RLS. */
final class IdentifyTenant
{
    public function __construct(private readonly TenantContext $ctx) {}

    public function handle(Request $request, Closure $next)
    {
        $slug = $request->header('X-Tenant') ?: explode('.', $request->getHost())[0];
        $tenant = DB::table('tenants')->where('slug', strtolower((string) $slug))->whereNull('deleted_at')->first()
            ?? throw new AppException(404, 'TENANT_NOT_FOUND', 'Shop not found. Check the shop code.');

        if ($tenant->status === 'cancelled' || ($tenant->status === 'suspended' && ! $request->isMethodSafe())) {
            throw new AppException(402, 'SUBSCRIPTION_INACTIVE', 'This subscription is not active. Renew it to continue.');
        }

        $this->ctx->set((int) $tenant->id);
        return $next($request);
    }

    public function terminate(): void
    {
        $this->ctx->clear();
    }
}
