<?php
declare(strict_types=1);

namespace App\Modules\Purchasing\Presentation;

use App\Modules\Inventory\Infrastructure\Models\StockItem;
use App\Modules\Purchasing\Application\CreatePurchase;
use App\Modules\Purchasing\Infrastructure\Models\{Purchase, Supplier};
use App\Shared\Domain\Money;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};

final class PurchaseController
{
    public function show(Request $request, int $id): JsonResponse
    {
        $p = Purchase::with('supplier:id,name')->findOrFail($id);
        $items = StockItem::with(['deviceModel.brand', 'color:id,name'])->where('purchase_id', $id)->get()
            ->map(fn ($i) => [
                'imei' => $i->imei, 'status' => $i->status,
                'model' => $i->deviceModel->brand->name . ' ' . $i->deviceModel->name, 'color' => $i->color?->name,
            ] + ($request->user()->seesAllBranches() ? ['cost' => Money::ofMinor($i->cost_minor)->toDecimal()] : []));

        return response()->json($this->row($p) + ['items' => $items]);
    }

    public function store(Request $request, CreatePurchase $create): JsonResponse
    {
        $money = 'regex:/^\d+(\.\d{1,2})?$/';
        $data = $request->validate([
            'supplier_id' => 'required|integer|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'paid' => ['nullable', $money],
            'note' => 'nullable|string|max:500',
            'items' => 'required|array|min:1|max:200',
            'items.*.imei' => 'required|string|max:20',
            'items.*.device_model_id' => 'required|integer|exists:device_models,id',
            'items.*.variant_id' => 'nullable|integer|exists:variants,id',
            'items.*.color_id' => 'nullable|integer|exists:colors,id',
            'items.*.cost' => ['required', $money],
        ]);

        $purchase = $create($data, (int) $request->user()->id);
        return response()->json($this->row($purchase->load('supplier:id,name')), 201);
    }

    public function suppliers(): JsonResponse
    {
        return response()->json(Supplier::orderBy('name')->limit(500)->get(['id', 'name', 'phone']));
    }

    public function storeSupplier(Request $request): JsonResponse
    {
        $d = $request->validate(['name' => 'required|string|max:120', 'phone' => 'nullable|string|max:30']);
        return response()->json(Supplier::create($d), 201);
    }

    private function row(Purchase $p): array
    {
        $total = Money::ofMinor($p->total_minor);
        $paid = Money::ofMinor($p->paid_minor);
        return [
            'id' => $p->id, 'invoice_no' => $p->invoice_no, 'purchase_date' => $p->purchase_date->toDateString(),
            'supplier' => $p->supplier?->name, 'total' => $total->toDecimal(), 'paid' => $paid->toDecimal(),
            'due' => $total->sub($paid)->toDecimal(),
        ];
    }
}
