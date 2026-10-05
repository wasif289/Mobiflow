<?php
declare(strict_types=1);

namespace App\Modules\Inventory\Presentation;

use App\Modules\Inventory\Infrastructure\Models\StockItem;
use App\Shared\Domain\{Imei, Money};
use App\Shared\Exceptions\{AppException, ImeiAlreadySold};
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};
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

        $s = StockItem::with(['deviceModel.brand', 'color:id,name'])->where('imei', $imei)->orderByDesc('id')->first()
            ?? throw new AppException(404, 'NOT_IN_STOCK', 'This IMEI was never purchased in this shop.');

        $s->status === 'sold' && throw new ImeiAlreadySold($imei);
        $s->status !== 'in_stock' && throw new AppException(409, 'NOT_AVAILABLE', "This phone is not available for sale ({$s->status}).");
        ($ctx->branchId() && (int) $s->branch_id !== $ctx->branchId())
            && throw new AppException(409, 'IN_OTHER_BRANCH', 'This phone is in another branch.');

        return response()->json($this->row($s, $request));
    }

    public function index(Request $request, TenantContext $ctx): JsonResponse
    {
        $digits = preg_replace('/\D/', '', (string) $request->query('q'));
        $page = StockItem::with(['deviceModel.brand', 'color:id,name'])
            ->when($ctx->branchId(), fn ($q, $b) => $q->where('branch_id', $b))
            ->when($request->query('status'), fn ($q, $st) => $q->where('status', $st))
            ->when($digits, fn ($q, $d) => $q->where('imei', 'like', "%{$d}%"))
            ->orderByDesc('id')->paginate(50);

        return response()->json($page->through(fn ($s) => $this->row($s, $request)));
    }

    private function row(StockItem $s, Request $request): array
    {
        return [
            'imei' => $s->imei, 'status' => $s->status,
            'model' => $s->deviceModel->brand->name . ' ' . $s->deviceModel->name, 'color' => $s->color?->name,
        ] + ($request->user()->seesAllBranches() ? ['cost' => Money::ofMinor($s->cost_minor)->toDecimal()] : []);
    }
}
