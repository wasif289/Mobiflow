<?php

namespace App\Providers;

use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // One shared context per process; ResolveTenantAndBranch/IdentifyTenant clear it at the end of every request.
        $this->app->singleton(TenantContext::class);
    }

    public function boot(): void
    {
        //
    }
}
