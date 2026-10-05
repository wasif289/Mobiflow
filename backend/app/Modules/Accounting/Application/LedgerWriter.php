<?php
declare(strict_types=1);

namespace App\Modules\Accounting\Application;

use App\Shared\Domain\Money;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/**
 * The only place that writes ledger rows. Rules (ported from the old system):
 *  supplier balance = credit - debit  (positive: we owe them)
 *  customer balance = debit - credit  (positive: they owe us)
 * Walk-in sales never reach the ledger. Call inside the caller's transaction.
 */
final class LedgerWriter
{
    public function __construct(private readonly TenantContext $ctx) {}

    public function post(string $party, int $partyId, string $side, Money $amount, string $refType, int $refId,
                         string $description, string $date, int $branchId, int $userId): void
    {
        if ($amount->minor === 0) {
            return;
        }
        DB::table('ledger_entries')->insert([
            'tenant_id' => $this->ctx->tenantId(), 'branch_id' => $branchId, 'party_type' => $party, 'party_id' => $partyId,
            'entry_date' => $date, 'ref_type' => $refType, 'ref_id' => $refId, 'description' => $description,
            'debit_minor' => $side === 'debit' ? $amount->minor : 0, 'credit_minor' => $side === 'credit' ? $amount->minor : 0,
            'created_by' => $userId,
        ]);
    }

    public function purchase(int $supplierId, Money $total, Money $paid, int $id, string $invoice, string $date, int $branch, int $user): void
    {
        $this->post('supplier', $supplierId, 'credit', $total, 'purchase', $id, "Purchase {$invoice}", $date, $branch, $user);
        $this->post('supplier', $supplierId, 'debit', $paid, 'purchase_payment', $id, "Paid at purchase {$invoice}", $date, $branch, $user);
    }

    public function sale(int $customerId, Money $total, Money $received, int $id, string $invoice, string $date, int $branch, int $user): void
    {
        $this->post('customer', $customerId, 'debit', $total, 'sale', $id, "Sale {$invoice}", $date, $branch, $user);
        $this->post('customer', $customerId, 'credit', $received, 'sale_payment', $id, "Received at sale {$invoice}", $date, $branch, $user);
    }
}
