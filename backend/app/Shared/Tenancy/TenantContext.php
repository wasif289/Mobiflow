<?php
declare(strict_types=1);

namespace App\Shared\Tenancy;

use Illuminate\Support\Facades\DB;

/** Register as scoped singleton. Holds current tenant + branch and feeds Postgres RLS. */
final class TenantContext
{
    private ?int $tenantId = null;
    private ?int $branchId = null;

    public function set(int $tenantId, ?int $branchId = null): void
    {
        $this->tenantId = $tenantId;
        $this->branchId = $branchId;
        DB::select("SELECT set_config('app.tenant_id', ?, false)", [(string) $tenantId]);
    }

    public function clear(): void
    {
        $this->tenantId = $this->branchId = null;
        DB::select("SELECT set_config('app.tenant_id', '', false)");
    }

    public function tenantId(): ?int { return $this->tenantId; }
    public function branchId(): ?int { return $this->branchId; }
}
