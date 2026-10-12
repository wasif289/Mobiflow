<?php
declare(strict_types=1);

namespace App\Modules\Purchasing\Application;

use App\Modules\Accounting\Application\LedgerWriter;
use App\Modules\Inventory\Infrastructure\Models\StockItem;
use App\Modules\Purchasing\Infrastructure\Models\Purchase;
use App\Shared\Application\ParseImeis;
use App\Shared\Domain\Money;
use App\Shared\Exceptions\AppException;
use App\Shared\Numbering\NumberSequence;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/** Use case: send phones back to the supplier. Stock leaves, supplier ledger is debited by the cost. */
final class CreatePurchaseReturn
{
    public function __construct(
        private readonly TenantContext $ctx,
        private readonly NumberSequence $numbers,
        private readonly LedgerWriter $ledger,
    ) {}

    /** @param array{imeis:array,reason:string,return_date:string} $d */
    public function __invoke(int $purchaseId, array $d, int $userId): array
    {
        $branchId = $this->ctx->branchId() ?? throw new AppException(422, 'BRANCH_REQUIRED', 'Select a branch first.');
        $imeis = ParseImeis::from($d['imeis']);

        return DB::transaction(function () use ($purchaseId, $d, $userId, $branchId, $imeis) {
            $purchase = Purchase::findOrFail($purchaseId);
            $stock = StockItem::where('purchase_id', $purchase->id)->whereIn('imei', $imeis)->lockForUpdate()->get()->keyBy('imei');

            $bad = [];
            foreach ($imeis as $imei) {
                $s = $stock->get($imei);
                if (! $s) { $bad[] = "{$imei}: not part of this purchase"; }
                elseif ($s->status !== 'in_stock') { $bad[] = "{$imei}: cannot be returned (it is {$s->status})"; }
                elseif ((int) $s->branch_id !== $branchId) { $bad[] = "{$imei}: is in another branch"; }
            }
            $bad && throw new AppException(409, 'ITEMS_NOT_RETURNABLE', 'Some phones cannot be returned.', ['imei' => $bad]);

            $total = Money::ofMinor((int) $stock->sum('cost_minor'));
            $no = $this->numbers->next('purchase_return', 'PR', $branchId);
            $id = DB::table('purchase_returns')->insertGetId([
                'tenant_id' => $this->ctx->tenantId(), 'branch_id' => $branchId, 'purchase_id' => $purchase->id,
                'return_no' => $no, 'total_minor' => $total->minor, 'reason' => $d['reason'], 'return_date' => $d['return_date'],
                'created_by' => $userId, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('purchase_return_items')->insert($stock->map(fn (StockItem $s) => [
                'tenant_id' => $this->ctx->tenantId(), 'purchase_return_id' => $id, 'stock_item_id' => $s->id, 'amount_minor' => $s->cost_minor,
            ])->values()->all());

            StockItem::whereIn('id', $stock->pluck('id'))->update(['status' => 'returned_to_supplier', 'updated_at' => now()]);
            $this->ledger->post('supplier', (int) $purchase->supplier_id, 'debit', $total, 'purchase_return', $id,
                "Purchase return {$no}", $d['return_date'], $branchId, $userId);

            return ['id' => $id, 'return_no' => $no, 'total' => $total->toDecimal()];
        });
    }
}
