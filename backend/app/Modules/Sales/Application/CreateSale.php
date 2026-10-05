<?php
declare(strict_types=1);

namespace App\Modules\Sales\Application;

use App\Modules\Inventory\Infrastructure\Models\StockItem;
use App\Modules\Sales\Infrastructure\Models\Sale;
use App\Modules\Accounting\Application\LedgerWriter;
use App\Shared\Domain\{Imei, Money};
use App\Shared\Exceptions\AppException;
use App\Shared\Numbering\NumberSequence;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/** Use case: sell phones by IMEI. Rows are locked, so one phone can never be sold twice. */
final class CreateSale
{
    public function __construct(
        private readonly TenantContext $ctx,
        private readonly NumberSequence $numbers,
        private readonly LedgerWriter $ledger,
    ) {}

    /** @param array{customer_id?:?int,sale_date:string,received?:?string,note?:?string,items:array<int,array>} $d */
    public function __invoke(array $d, int $userId): Sale
    {
        $branchId = $this->ctx->branchId() ?? throw new AppException(422, 'BRANCH_REQUIRED', 'Select a branch first.');

        [$prices, $total] = $this->parse($d['items']);
        $received = Money::parse($d['received'] ?? '0');
        $received->minor <= $total->minor
            || throw new AppException(422, 'OVERPAID', 'Received amount is more than the sale total.', ['received' => ['Cannot exceed the total']]);
        (! empty($d['customer_id']) || $received->minor === $total->minor)
            || throw new AppException(422, 'CREDIT_NEEDS_CUSTOMER', 'Select a customer to sell on credit.', ['received' => ['Walk-in sales must be paid in full']]);

        return DB::transaction(function () use ($d, $userId, $branchId, $prices, $total, $received) {
            $stock = StockItem::whereIn('imei', array_keys($prices))->where('status', 'in_stock')->lockForUpdate()->get()->keyBy('imei');

            $bad = [];
            foreach (array_keys($prices) as $imei) {
                $s = $stock->get($imei);
                if (! $s) { $bad[] = "{$imei}: not in stock (already sold or never purchased)"; }
                elseif ((int) $s->branch_id !== $branchId) { $bad[] = "{$imei}: is in another branch"; }
            }
            $bad && throw new AppException(409, 'ITEMS_NOT_AVAILABLE', 'Some phones cannot be sold.', ['imei' => $bad]);

            $sale = Sale::create([
                'branch_id' => $branchId, 'customer_id' => $d['customer_id'] ?? null,
                'invoice_no' => $this->numbers->next('sale', 'SI', $branchId), 'sale_date' => $d['sale_date'],
                'total_minor' => $total->minor, 'received_minor' => $received->minor,
                'note' => $d['note'] ?? null, 'created_by' => $userId,
            ]);

            $now = now();
            DB::table('sale_items')->insert($stock->map(fn (StockItem $s, string $imei) => [
                'tenant_id' => $this->ctx->tenantId(), 'sale_id' => $sale->id, 'stock_item_id' => $s->id,
                'price_minor' => $prices[$imei]->minor, 'cost_minor' => $s->cost_minor,
                'created_at' => $now, 'updated_at' => $now,
            ])->values()->all());

            StockItem::whereIn('id', $stock->pluck('id'))->update(['status' => 'sold', 'updated_at' => $now]);

            if (! empty($d['customer_id'])) { // walk-in sales stay out of the ledger
                $this->ledger->sale((int) $d['customer_id'], $total, $received, $sale->id, $sale->invoice_no, $d['sale_date'], $branchId, $userId);
            }

            return $sale;
        });
    }

    /** @return array{0: array<string,Money>, 1: Money} prices keyed by IMEI */
    private function parse(array $rows): array
    {
        $prices = [];
        $problems = [];
        $total = Money::ofMinor(0);
        foreach ($rows as $row) {
            try {
                $imei = (new Imei((string) $row['imei']))->value;
            } catch (InvalidArgumentException) {
                $problems[] = "{$row['imei']}: not a valid IMEI";
                continue;
            }
            if (isset($prices[$imei])) { $problems[] = "{$imei}: entered twice"; continue; }
            $prices[$imei] = Money::parse((string) $row['price']);
            $total = $total->add($prices[$imei]);
        }
        $problems && throw new AppException(422, 'INVALID_ITEMS', 'Please fix the IMEIs listed.', ['imei' => $problems]);
        return [$prices, $total];
    }
}
