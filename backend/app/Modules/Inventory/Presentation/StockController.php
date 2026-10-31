<?php
declare(strict_types=1);

namespace App\Modules\Inventory\Presentation;

use App\Modules\Inventory\Infrastructure\Models\StockItem;
use App\Shared\Domain\{Imei, Money};
use App\Shared\Exceptions\AppException;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class StockController
{
    /** GET /stock/{imei}: can this phone be sold here? Clear reason when not. */
    public function lookup(Request $request, TenantContext $ctx, string $imei): JsonResponse
    {
        try {
            $imei = (new Imei($imei))->value;
        } catch (InvalidArgumentException) {
            throw new AppException(422, 'INVALID_IMEI', 'This IMEI is not valid. Check the 15 digits.', ['imei' => ['Invalid IMEI']]);
        }

        $s = StockItem::with(['deviceModel.brand', 'variant:id,name', 'color:id,name'])->where('imei', $imei)->orderByDesc('id')->first()
            ?? throw new AppException(404, 'NOT_IN_STOCK', 'This IMEI was never purchased in this shop.');

        if ($s->status === 'sold') {   // tell the cashier which sale it went out on
            $sale = DB::table('sale_items')->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->leftJoin('customers', 'customers.id', '=', 'sales.customer_id')
                ->where('sale_items.stock_item_id', $s->id)->orderByDesc('sale_items.id')
                ->first(['sales.invoice_no', 'sales.sale_date', 'customers.name as customer']);
            throw new AppException(409, 'STOCK_ALREADY_SOLD', 'This IMEI is already sold.', ['imei' => [$imei]] + ($sale ? [
                'sold_invoice' => [(string) $sale->invoice_no],
                'sold_date' => [substr((string) $sale->sale_date, 0, 10)],
                'sold_customer' => [$sale->customer ?? 'Walk-in'],
            ] : []));
        }
        $s->status !== 'in_stock' && throw new AppException(409, 'NOT_AVAILABLE', "This phone is not available for sale ({$s->status}).");
        ($ctx->branchId() && (int) $s->branch_id !== $ctx->branchId())
            && throw new AppException(409, 'IN_OTHER_BRANCH', 'This phone is in another branch.');

        return response()->json($this->row($s, $request));
    }

    private function row(StockItem $s, Request $request): array
    {
        return [
            'imei' => $s->imei, 'status' => $s->status,
            'model' => $s->deviceModel->brand->name . ' ' . $s->deviceModel->name, 'brand' => $s->deviceModel->brand->name,
            'model_name' => $s->deviceModel->name, 'variant' => $s->variant?->name, 'color' => $s->color?->name,
        ] + ($request->user()->seesAllBranches() ? ['cost' => Money::ofMinor($s->cost_minor)->toDecimal()] : []);
    }
}
