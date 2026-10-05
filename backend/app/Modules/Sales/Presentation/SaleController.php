<?php
declare(strict_types=1);

namespace App\Modules\Sales\Presentation;

use App\Modules\Sales\Application\CreateSale;
use App\Modules\Sales\Infrastructure\Models\{Customer, Sale};
use App\Shared\Domain\Money;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

final class SaleController
{
    public function index(Request $request, TenantContext $ctx): JsonResponse
    {
        $page = Sale::with('customer:id,name')->withSum('items as cost_sum', 'cost_minor')
            ->when($ctx->branchId(), fn ($q, $b) => $q->where('branch_id', $b))
            ->orderByDesc('sale_date')->orderByDesc('id')->paginate(25);

        return response()->json($page->through(fn (Sale $s) => $this->row($s, $request)));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $s = Sale::with(['customer:id,name', 'items.stockItem.deviceModel.brand'])->withSum('items as cost_sum', 'cost_minor')->findOrFail($id);
        $admin = $request->user()->seesAllBranches();
        $returned = DB::table('sale_return_items')->whereIn('sale_item_id', $s->items->pluck('id'))->pluck('sale_item_id')->flip();
        $items = $s->items->map(fn ($i) => [
            'imei' => $i->stockItem->imei, 'model' => $i->stockItem->deviceModel->brand->name . ' ' . $i->stockItem->deviceModel->name,
            'price' => Money::ofMinor($i->price_minor)->toDecimal(), 'returned' => $returned->has($i->id),
        ] + ($admin ? ['cost' => Money::ofMinor($i->cost_minor)->toDecimal()] : []));

        return response()->json($this->row($s, $request) + ['items' => $items]);
    }

    public function store(Request $request, CreateSale $create): JsonResponse
    {
        $money = 'regex:/^\d+(\.\d{1,2})?$/';
        $data = $request->validate([
            'customer_id' => 'nullable|integer|exists:customers,id',
            'sale_date' => 'required|date',
            'received' => ['nullable', $money],
            'note' => 'nullable|string|max:500',
            'items' => 'required|array|min:1|max:100',
            'items.*.imei' => 'required|string|max:20',
            'items.*.price' => ['required', $money],
        ]);

        $sale = $create($data, (int) $request->user()->id)->load('customer:id,name');
        $sale->cost_sum = $sale->items()->sum('cost_minor');
        return response()->json($this->row($sale, $request), 201);
    }

    public function customers(): JsonResponse
    {
        return response()->json(Customer::orderBy('name')->limit(500)->get(['id', 'name', 'phone']));
    }

    public function storeCustomer(Request $request): JsonResponse
    {
        $d = $request->validate(['name' => 'required|string|max:120', 'phone' => 'nullable|string|max:30']);
        return response()->json(Customer::create($d), 201);
    }

    /** Profit and cost are only visible to owner/admin. */
    private function row(Sale $s, Request $request): array
    {
        $total = Money::ofMinor($s->total_minor);
        $received = Money::ofMinor($s->received_minor);
        $row = [
            'id' => $s->id, 'invoice_no' => $s->invoice_no, 'sale_date' => $s->sale_date->toDateString(),
            'customer' => $s->customer?->name, 'total' => $total->toDecimal(),
            'received' => $received->toDecimal(), 'due' => $total->sub($received)->toDecimal(),
        ];
        if ($request->user()->seesAllBranches()) {
            $row['profit'] = $total->sub(Money::ofMinor((int) $s->cost_sum))->toDecimal();
        }
        return $row;
    }
}
