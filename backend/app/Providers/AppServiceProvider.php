<?php

namespace App\Providers;

use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
<<<<<<< HEAD
        // One shared context per process; ResolveTenantAndBranch/IdentifyTenant clear it at the end of every request.
=======
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
        $this->app->singleton(TenantContext::class);
    }

    public function boot(): void
    {
        //
    }
}