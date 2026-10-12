<?php

use App\Shared\Http\ProblemDetails;
use App\Shared\Tenancy\{IdentifyTenant, ResolveTenantAndBranch};
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Tenant must be known BEFORE auth loads the user, and branch check runs AFTER auth.
        $middleware->prependToPriorityList(before: AuthenticatesRequests::class, prepend: IdentifyTenant::class);
        $middleware->appendToPriorityList(after: AuthenticatesRequests::class, append: ResolveTenantAndBranch::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        ProblemDetails::register($exceptions);
    })->create();