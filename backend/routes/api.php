<?php
declare(strict_types=1);

use App\Modules\Billing\Presentation\{BillingController, WebhookController};
use App\Modules\Platform\Presentation\{EnsureSuperAdmin, PlatformAuthController, PlatformController};
use App\Modules\Accounting\Presentation\{AccountController, BalanceListController};
use App\Modules\Catalog\Presentation\{CatalogController, TacController};
use App\Modules\Expenses\Presentation\ExpenseController;
use App\Modules\Identity\Presentation\{AdminController, AuthController, RequirePermission};
use App\Modules\Inventory\Presentation\{InventoryListController, StockController};
use App\Modules\Purchasing\Presentation\{PurchaseController, PurchaseListController, PurchaseReturnController};
use App\Modules\Reporting\Presentation\DashboardController;
use App\Modules\Sales\Presentation\{SaleController, SaleListController, SaleReturnController};
use App\Modules\Transfers\Presentation\TransferController;
use App\Modules\Tenancy\Presentation\RegisterController;
use App\Shared\Tenancy\{IdentifyTenant, ResolveTenantAndBranch};
use Illuminate\Support\Facades\Route;

$can = fn (string $p): string => RequirePermission::class . ':' . $p;

Route::prefix('v1')->group(function () use ($can) {
    Route::post('auth/register', RegisterController::class)->middleware('throttle:5,10');

    Route::middleware(IdentifyTenant::class)->group(function () use ($can) {
        Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

        Route::middleware(['auth:sanctum', ResolveTenantAndBranch::class])->group(function () use ($can) {
            Route::get('auth/me', [AuthController::class, 'me']);
            Route::post('auth/logout', [AuthController::class, 'logout']);
            Route::get('imei/{imei}', [TacController::class, 'lookup']);

            Route::get('dashboard', DashboardController::class)->middleware($can('dashboard.view'));

            Route::post('tac-mappings', [TacController::class, 'store'])->middleware($can('catalog.manage'));
            Route::prefix('catalog/{resource}')->whereIn('resource', ['brands', 'models', 'variants', 'colors'])->group(function () use ($can) {
                Route::get('/', [CatalogController::class, 'index']);
                Route::middleware($can('catalog.manage'))->group(function () {
                    Route::post('/', [CatalogController::class, 'store']);
                    Route::put('{id}', [CatalogController::class, 'update'])->whereNumber('id');
                    Route::delete('{id}', [CatalogController::class, 'destroy'])->whereNumber('id');
                });
            });

            Route::get('suppliers', [PurchaseController::class, 'suppliers'])->middleware($can('purchases.view'));
            Route::post('suppliers', [PurchaseController::class, 'storeSupplier'])->middleware($can('purchases.create'));
            Route::get('purchases', PurchaseListController::class)->middleware($can('purchases.view'));
            Route::post('purchases', [PurchaseController::class, 'store'])->middleware($can('purchases.create'));
            Route::get('purchases/{id}', [PurchaseController::class, 'show'])->whereNumber('id')->middleware($can('purchases.view'));
            Route::post('purchases/{id}/returns', PurchaseReturnController::class)->whereNumber('id')->middleware($can('returns.create'));

            Route::get('customers', [SaleController::class, 'customers'])->middleware($can('sales.view'));
            Route::post('customers', [SaleController::class, 'storeCustomer'])->middleware($can('sales.create'));
            Route::get('stock/{imei}', [StockController::class, 'lookup'])->middleware($can('sales.create'));
            Route::get('sales', SaleListController::class)->middleware($can('sales.view'));
            Route::post('sales', [SaleController::class, 'store'])->middleware($can('sales.create'));
            Route::get('sales/{id}', [SaleController::class, 'show'])->whereNumber('id')->middleware($can('sales.view'));
            Route::post('sales/{id}/returns', SaleReturnController::class)->whereNumber('id')->middleware($can('returns.create'));

            Route::get('inventory', InventoryListController::class)->middleware($can('inventory.view'));

            Route::post('vouchers', [AccountController::class, 'storeVoucher'])->middleware($can('accounts.create'));
            Route::prefix('accounts/{type}')->whereIn('type', ['supplier', 'customer'])->middleware($can('accounts.view'))->group(function () {
                Route::get('/', BalanceListController::class);
                Route::get('{id}', [AccountController::class, 'statement'])->whereNumber('id');
            });

            Route::get('expense-heads', [ExpenseController::class, 'heads'])->middleware($can('expenses.view'));
            Route::post('expense-heads', [ExpenseController::class, 'storeHead'])->middleware($can('expenses.create'));
            Route::get('expenses', [ExpenseController::class, 'index'])->middleware($can('expenses.view'));
            Route::post('expenses', [ExpenseController::class, 'store'])->middleware($can('expenses.create'));
            Route::delete('expenses/{id}', [ExpenseController::class, 'destroy'])->whereNumber('id')->middleware($can('expenses.delete'));

            Route::get('transfers/branches', [TransferController::class, 'branches'])->middleware($can('transfers.view'));
            Route::get('transfers/lookup/{imei}', [StockController::class, 'lookup'])->middleware($can('transfers.create'));
            Route::get('transfers', [TransferController::class, 'index'])->middleware($can('transfers.view'));
            Route::post('transfers', [TransferController::class, 'store'])->middleware($can('transfers.create'));
            Route::get('transfers/{id}', [TransferController::class, 'show'])->whereNumber('id')->middleware($can('transfers.view'));
            Route::post('transfers/{id}/receive', [TransferController::class, 'receive'])->whereNumber('id')->middleware($can('transfers.create'));
            Route::post('transfers/{id}/cancel', [TransferController::class, 'cancel'])->whereNumber('id')->middleware($can('transfers.create'));

            Route::prefix('admin')->middleware($can('admin'))->group(function () {
                Route::get('permissions-meta', [AdminController::class, 'meta']);
                Route::get('users', [AdminController::class, 'users']);
                Route::post('users', [AdminController::class, 'storeUser']);
                Route::get('users/{id}', [AdminController::class, 'showUser'])->whereNumber('id');
                Route::put('users/{id}', [AdminController::class, 'updateUser'])->whereNumber('id');
                Route::get('branches', [AdminController::class, 'branches']);
                Route::post('branches', [AdminController::class, 'storeBranch']);
                Route::put('branches/{id}', [AdminController::class, 'updateBranch'])->whereNumber('id');
                Route::get('settings', [AdminController::class, 'settings']);
                Route::put('settings', [AdminController::class, 'saveSettings']);
            });
        });
    });
});

// Shop billing: stays reachable even when a shop is suspended, so it can pay and come back.
Route::prefix('v1/billing')->middleware([IdentifyTenant::class, 'auth:sanctum', ResolveTenantAndBranch::class, $can('admin')])->group(function () {
    Route::get('/', [BillingController::class, 'show']);
    Route::post('invoices', [BillingController::class, 'createInvoice']);
    Route::post('invoices/{id}/checkout', [BillingController::class, 'checkout'])->whereNumber('id');
    Route::post('invoices/{id}/manual-payment', [BillingController::class, 'manualPayment'])->whereNumber('id');
});

Route::post('v1/webhooks/stripe', [WebhookController::class, 'stripe']);

// Platform (super admin): separate identity, no tenant context
Route::prefix('v1/platform')->group(function () {
    Route::post('auth/login', [PlatformAuthController::class, 'login'])->middleware('throttle:5,1');
    Route::middleware(['auth:sanctum', EnsureSuperAdmin::class])->group(function () {
        Route::get('overview', [PlatformController::class, 'overview']);
        Route::get('tenants', [PlatformController::class, 'tenants']);
        Route::post('tenants/{id}/status', [PlatformController::class, 'setStatus'])->whereNumber('id');
        Route::post('tenants/{id}/extend', [PlatformController::class, 'extend'])->whereNumber('id');
        Route::post('tenants/{id}/plan', [PlatformController::class, 'setPlan'])->whereNumber('id');
        Route::get('payments', [PlatformController::class, 'payments']);
        Route::post('payments/{id}/approve', [PlatformController::class, 'approve'])->whereNumber('id');
        Route::post('payments/{id}/reject', [PlatformController::class, 'reject'])->whereNumber('id');
        Route::get('payments/{id}/proof', [PlatformController::class, 'proof'])->whereNumber('id');
        Route::get('plans', [PlatformController::class, 'plans']);
        Route::post('plans', [PlatformController::class, 'savePlan']);
        Route::put('plans/{id}', [PlatformController::class, 'savePlan'])->whereNumber('id');
        Route::get('settings', [PlatformController::class, 'settings']);
        Route::put('settings', [PlatformController::class, 'saveSettings']);
    });
});
