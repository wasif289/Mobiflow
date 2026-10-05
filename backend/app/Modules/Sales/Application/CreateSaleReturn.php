<?php
declare(strict_types=1);

namespace App\Modules\Sales\Application;

use App\Modules\Accounting\Application\LedgerWriter;
use App\Modules\Inventory\Infrastructure\Models\StockItem;
use App\Modules\Sales\Infrastructure\Models\{Sale, SaleItem};
use App\Shared\Application\ParseImeis;
use App\Shared\Domain\Money;
use App\Shared\Exceptions\AppException;
use App\Shared\Numbering\NumberSequence;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/**
 * Use case: customer brings phones back. Phones return to stock in THIS branch at their original cost.
 * Named customer: ledger credit (settle later with a voucher). Walk-in: cash refund, no ledger.
 */
final class CreateSaleReturn
{
    public function __construct(
        private readonly TenantContext $ctx,
        private readonly NumberSequence $numbers,
        private readonly LedgerWriter $ledger,
    ) {}

    /** @param array{imeis:array,reason:string,return_date:string} $d */
    public function __invoke(int $saleId, array $d, int $userId): array
    {
        $branchId = $this->ctx->branchId() ?? throw new AppException(422, 'BRANCH_REQUIRED', 'Select a branch first.');
        $imeis = ParseImeis::from($d['imeis']);

        return DB::transaction(function () use ($saleId, $d, $userId, $branchId, $imeis) {
            $sale = Sale::findOrFail($saleId);
            $items = SaleItem::with('stockItem')->where('sale_id', $sale->id)->get()->keyBy(fn ($i) => $i->stockItem->imei);
            $stock = StockItem::whereIn('id', $items->pluck('stock_item_id'))->lockForUpdate()->get()->keyBy('id');
            $done = DB::table('sale_return_items')->whereIn('sale_item_id', $items->pluck('id'))->pluck('sale_item_id')->all();

            $bad = [];
            $lines = [];
            foreach ($imeis as $imei) {
                $item = $items->get($imei);
                if (! $item) { $bad[] = "{$imei}: not part of this sale"; }
                elseif (in_array($item->id, $done, true)) { $bad[] = "{$imei}: already returned"; }
                elseif ($stock->get($item->stock_item_id)?->status !== 'sold') { $bad[] = "{$imei}: is not marked as sold"; }
                else { $lines[] = $item; }
            }
            $bad && throw new AppException(409, 'ITEMS_NOT_RETURNABLE', 'Some phones cannot be returned.', ['imei' => $bad]);

            $total = Money::ofMinor((int) collect($lines)->sum('price_minor'));
            $no = $this->numbers->next('sale_return', 'SR', $branchId);
            $id = DB::table('sale_returns')->insertGetId([
                'tenant_id' => $this->ctx->tenantId(), 'branch_id' => $branchId, 'sale_id' => $sale->id, 'return_no' => $no,
                'total_minor' => $total->minor, 'reason' => $d['reason'], 'return_date' => $d['return_date'],
                'created_by' => $userId, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('sale_return_items')->insert(array_map(fn (SaleItem $i) => [
                'tenant_id' => $this->ctx->tenantId(), 'sale_return_id' => $id, 'sale_item_id' => $i->id,
                'stock_item_id' => $i->stock_item_id, 'amount_minor' => $i->price_minor,
            ], $lines));

            StockItem::whereIn('id', collect($lines)->pluck('stock_item_id'))
                ->update(['status' => 'in_stock', 'branch_id' => $branchId, 'updated_at' => now()]);

            if ($sale->customer_id) {
                $this->ledger->post('customer', (int) $sale->customer_id, 'credit', $total, 'sale_return', $id,
                    "Sale return {$no}", $d['return_date'], $branchId, $userId);
            }

            return ['id' => $id, 'return_no' => $no, 'total' => $total->toDecimal(), 'refund' => $sale->customer_id ? 'ledger' : 'cash'];
        });
    }
}
