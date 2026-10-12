<?php
declare(strict_types=1);

namespace App\Shared\Numbering;

use App\Modules\Identity\Infrastructure\Models\Branch;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/** Gap-free per-branch document numbers (PI-MAIN-00001). Call inside a transaction: the row lock serialises writers. */
final class NumberSequence
{
    public function __construct(private readonly TenantContext $ctx) {}

    public function next(string $type, string $prefix, int $branchId): string
    {
        $key = ['tenant_id' => $this->ctx->tenantId(), 'branch_id' => $branchId, 'type' => $type];
        DB::table('number_sequences')->insertOrIgnore($key + ['last' => 0]);
        $n = DB::table('number_sequences')->where($key)->lockForUpdate()->value('last') + 1;
        DB::table('number_sequences')->where($key)->update(['last' => $n]);

        return sprintf('%s-%s-%05d', $prefix, Branch::findOrFail($branchId)->code, $n);
    }
}
