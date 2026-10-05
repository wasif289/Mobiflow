<?php
declare(strict_types=1);

namespace App\Modules\Purchasing\Application;

use App\Modules\Inventory\Infrastructure\Models\StockItem;
use App\Modules\Purchasing\Infrastructure\Models\Purchase;
use App\Modules\Accounting\Application\LedgerWriter;
use App\Shared\Domain\{Imei, Money};
use App\Shared\Exceptions\AppException;
use App\Shared\Numbering\NumberSequence;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Use case: stock-in phones from a supplier. All-or-nothing: either the purchase and every
 * IMEI are saved, or nothing is.
 */
final class CreatePurchase
{
    public function __construct(
        private readonly TenantContext $ctx,
        private readonly NumberSequence $numbers,
        private readonly LedgerWriter $ledger,
    ) {}

    /** @param array{supplier_id:int,purchase_date:string,paid?:?string,note?:?string,items:array<int,array>} $d */
    public function __invoke(array $d, int $userId): Purchase
    {
        $branchId = $this->ctx->branchId() ?? throw new AppException(422, 'BRANCH_REQUIRED', 'Select a branch first.');

        [$items, $total] = $this->prepareItems($d['items']);
        $paid = Money::parse($d['paid'] ?? '0');
        $paid->minor <= $total->minor
            || throw new AppException(422, 'OVERPAID', 'Paid amount is more than the purchase total.', ['paid' => ['Cannot exceed the total']]);

        $taken = StockItem::whereIn('imei', array_keys($items))->whereIn('status', StockItem::ACTIVE)->pluck('imei')->all();
        if ($taken) {
            throw new AppException(409, 'IMEI_ALREADY_IN_STOCK', 'Some IMEIs are already in stock.', ['imei' => $taken]);
        }

        return DB::transaction(function () use ($d, $userId, $branchId, $items, $total, $paid) {
            $purchase = Purchase::create([
                'branch_id' => $branchId, 'supplier_id' => $d['supplier_id'], 'invoice_no' => $this->numbers->next('purchase', 'PI', $branchId),
                'purchase_date' => $d['purchase_date'], 'total_minor' => $total->minor, 'paid_minor' => $paid->minor,
                'note' => $d['note'] ?? null, 'created_by' => $userId,
            ]);

            $now = now();
            StockItem::insert(array_map(fn (array $i) => [
                'tenant_id' => $this->ctx->tenantId(), 'branch_id' => $branchId, 'purchase_id' => $purchase->id,
                'device_model_id' => $i['device_model_id'], 'variant_id' => $i['variant_id'] ?? null,
                'color_id' => $i['color_id'] ?? null, 'imei' => $i['imei'], 'cost_minor' => $i['cost']->minor,
                'status' => 'in_stock', 'created_at' => $now, 'updated_at' => $now,
            ], array_values($items)));

            $this->ledger->purchase((int) $d['supplier_id'], $total, $paid, $purchase->id, $purchase->invoice_no, $d['purchase_date'], $branchId, $userId);

            return $purchase;
        });
    }

    /** @return array{0: array<string,array>, 1: Money} items keyed by IMEI */
    private function prepareItems(array $rows): array
    {
        $items = [];
        $problems = [];
        $total = Money::ofMinor(0);

        foreach ($rows as $row) {
            try {
                $imei = new Imei((string) $row['imei']);
            } catch (InvalidArgumentException) {
                $problems[] = "{$row['imei']}: not a valid IMEI";
                continue;
            }
            if (isset($items[$imei->value])) {
                $problems[] = "{$imei->value}: entered twice";
                continue;
            }
            $cost = Money::parse((string) $row['cost']);
            $items[$imei->value] = [...$row, 'imei' => $imei->value, 'cost' => $cost];
            $total = $total->add($cost);
        }

        if ($problems) {
            throw new AppException(422, 'INVALID_ITEMS', 'Please fix the IMEIs listed.', ['imei' => $problems]);
        }
        return [$items, $total];
    }
}
