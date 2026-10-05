<?php
declare(strict_types=1);

use App\Modules\Catalog\Presentation\{CatalogController, TacController};
use App\Modules\Accounting\Presentation\AccountController;
use App\Modules\Identity\Presentation\AuthController;
use App\Modules\Reporting\Presentation\DashboardController;
use App\Modules\Inventory\Presentation\StockController;
use App\Modules\Sales\Presentation\{SaleController, SaleReturnController};
use App\Modules\Purchasing\Presentation\{PurchaseController, PurchaseReturnController};
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
            Route::get('suppliers', [PurchaseController::class, 'suppliers']);
            Route::post('suppliers', [PurchaseController::class, 'storeSupplier']);
            Route::get('purchases', [PurchaseController::class, 'index']);
            Route::post('purchases', [PurchaseController::class, 'store']);
            Route::get('purchases/{id}', [PurchaseController::class, 'show'])->whereNumber('id');
            Route::get('stock/{imei}', [StockController::class, 'lookup']);
            Route::get('inventory', [StockController::class, 'index']);
            Route::get('customers', [SaleController::class, 'customers']);
            Route::post('customers', [SaleController::class, 'storeCustomer']);
            Route::get('sales', [SaleController::class, 'index']);
            Route::post('sales', [SaleController::class, 'store']);
            Route::get('sales/{id}', [SaleController::class, 'show'])->whereNumber('id');
            Route::get('dashboard', DashboardController::class);
            Route::post('vouchers', [AccountController::class, 'storeVoucher']);
            Route::prefix('accounts/{type}')->whereIn('type', ['supplier', 'customer'])->group(function () {
                Route::get('/', [AccountController::class, 'balances']);
                Route::get('{id}', [AccountController::class, 'statement'])->whereNumber('id');
            });
            Route::post('purchases/{id}/returns', PurchaseReturnController::class)->whereNumber('id');
            Route::post('sales/{id}/returns', SaleReturnController::class)->whereNumber('id');
            // Next: expenses, stock transfer, print
        });
    });
});
