<?php
declare(strict_types=1);

namespace App\Shared\Tenancy;

use Illuminate\Database\Eloquent\Builder;

/** Add to every tenant-owned Eloquent model. Postgres RLS is the safety net. */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $q) {
            $id = app(TenantContext::class)->tenantId();
            $id === null
                ? $q->whereRaw('1 = 0') // fail closed: no tenant, no rows
                : $q->where($q->getModel()->getTable() . '.tenant_id', $id);
        });

        static::creating(function ($model) {
            $model->tenant_id ??= app(TenantContext::class)->tenantId();
        });
    }
}
