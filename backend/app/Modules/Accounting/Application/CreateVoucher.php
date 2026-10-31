<?php
declare(strict_types=1);

namespace App\Modules\Accounting\Application;

use App\Shared\Domain\Money;
use App\Shared\Exceptions\AppException;
use App\Shared\Numbering\NumberSequence;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/**
 * Use case: record money paid out (payment) or received (receipt) against a supplier/customer.
 * Optionally settles one bill (purchase for a payment, sale for a receipt): the bill's paid/received amount moves with it.
 */
final class CreateVoucher
{
    public function __construct(
        private readonly TenantContext $ctx,
        private readonly NumberSequence $numbers,
        private readonly LedgerWriter $ledger,
    ) {}

    public function __invoke(array $d, int $userId): array
    {
        $branchId = $this->ctx->branchId() ?? throw new AppException(422, 'BRANCH_REQUIRED', 'Select a branch first.');
        $amount = Money::parse((string) $d['amount']);
        $amount->minor > 0 || throw new AppException(422, 'INVALID_AMOUNT', 'Amount must be more than zero.', ['amount' => ['Must be more than zero']]);

        DB::table($d['party_type'] === 'supplier' ? 'suppliers' : 'customers')->where('tenant_id', $this->ctx->tenantId())->where('id', $d['party_id'])->exists()
            || throw new AppException(422, 'PARTY_NOT_FOUND', 'That party does not exist.', ['party_id' => ['Not found']]);

        return DB::transaction(function () use ($d, $userId, $branchId, $amount) {
            [$bill, $billNo] = $this->settleBill($d, $amount);
            $d['bill_ref'] = ($d['bill_ref'] ?? null) ?: $billNo;
            $no = $this->numbers->next('voucher', 'VO', $branchId);
            $id = DB::table('vouchers')->insertGetId([
                'tenant_id' => $this->ctx->tenantId(), 'branch_id' => $branchId, 'voucher_no' => $no,
                'party_type' => $d['party_type'], 'party_id' => $d['party_id'], 'direction' => $d['direction'],
                'method' => $d['method'], 'amount_minor' => $amount->minor, 'bill_ref' => $d['bill_ref'] ?? null,
                'notes' => $d['notes'] ?? null, 'voucher_date' => $d['voucher_date'], 'created_by' => $userId,
                'purchase_id' => $bill['purchase'] ?? null, 'sale_id' => $bill['sale'] ?? null,
                'created_at' => now(), 'updated_at' => now(),
            ]);

            // money in = credit, money out = debit (same rule as the old system)
            $this->ledger->post($d['party_type'], (int) $d['party_id'], $d['direction'] === 'receipt' ? 'credit' : 'debit',
                $amount, 'voucher', $id, ($d['direction'] === 'receipt' ? 'Receipt ' : 'Payment ') . $no
                . (! empty($d['bill_ref']) ? " | Ref: {$d['bill_ref']}" : ''), $d['voucher_date'], $branchId, $userId);

            return ['id' => $id, 'voucher_no' => $no];
        });
    }

    /**
     * Locks the bill row and moves its paid amount. A payment can only settle a purchase of the same supplier,
     * a receipt only a sale of the same customer, and never more than what is still due.
     *
     * @return array{0: array<string,int>, 1: ?string} [link columns, invoice number]
     */
    private function settleBill(array $d, Money $amount): array
    {
        $purchaseId = $d['purchase_id'] ?? null;
        $saleId = $d['sale_id'] ?? null;
        if (! $purchaseId && ! $saleId) {
            return [[], null];
        }
        ($purchaseId && $saleId) && throw new AppException(422, 'ONE_BILL_ONLY', 'A voucher can settle one bill at a time.');

        [$field, $table, $paidCol, $partyCol, $wantType, $wantDirection, $id, $label] = $purchaseId
            ? ['purchase_id', 'purchases', 'paid_minor', 'supplier_id', 'supplier', 'payment', (int) $purchaseId, 'purchase']
            : ['sale_id', 'sales', 'received_minor', 'customer_id', 'customer', 'receipt', (int) $saleId, 'sale'];

        ($d['party_type'] === $wantType && $d['direction'] === $wantDirection)
            || throw new AppException(422, 'BILL_MISMATCH', $purchaseId ? 'A purchase bill can only be settled by a supplier payment.' : 'A sale can only be settled by a customer receipt.', [$field => ['Wrong voucher type for this bill']]);

        $bill = DB::table($table)->where('tenant_id', $this->ctx->tenantId())->where('id', $id)->where($partyCol, $d['party_id'])->lockForUpdate()->first()
            ?? throw new AppException(422, 'BILL_NOT_FOUND', 'That bill does not belong to this party.', [$field => ['Not found']]);

        $due = $bill->total_minor - $bill->{$paidCol};
        $amount->minor <= $due || throw new AppException(422, 'OVER_BILL', "That is more than the {$label} still owes (" . Money::ofMinor($due)->toDecimal() . ').', ['amount' => ['More than the bill due ' . Money::ofMinor($due)->toDecimal()]]);

        DB::table($table)->where('id', $id)->update([$paidCol => $bill->{$paidCol} + $amount->minor]);

        return [[($purchaseId ? 'purchase' : 'sale') => $id], $bill->invoice_no];
    }
}
