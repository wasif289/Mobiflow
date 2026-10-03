<?php
declare(strict_types=1);

use App\Modules\Catalog\Presentation\{CatalogController, TacController};
use App\Modules\Identity\Presentation\AuthController;
use App\Modules\Tenancy\Presentation\RegisterController;
use App\Shared\Tenancy\{IdentifyTenant, ResolveTenantAndBranch};
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public: no tenant yet
    Route::post('auth/register', RegisterController::class)->middleware('throttle:5,10');

    // Tenant-scoped
    Route::middleware(IdentifyTenant::class)->group(function () {
        Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

        Route::middleware(['auth:sanctum', ResolveTenantAndBranch::class])->group(function () {
            Route::get('auth/me', [AuthController::class, 'me']);
            Route::post('auth/logout', [AuthController::class, 'logout']);
            Route::get('imei/{imei}', [TacController::class, 'lookup']);
            Route::post('tac-mappings', [TacController::class, 'store']);

            Route::prefix('catalog/{resource}')->whereIn('resource', ['brands', 'models', 'variants', 'colors'])->group(function () {
                Route::get('/', [CatalogController::class, 'index']);
                Route::post('/', [CatalogController::class, 'store']);
                Route::put('{id}', [CatalogController::class, 'update'])->whereNumber('id');
                Route::delete('{id}', [CatalogController::class, 'destroy'])->whereNumber('id');
            });
            // Next: purchases, sales
        });
    });
});
