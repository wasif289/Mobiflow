<?php
declare(strict_types=1);

namespace App\Modules\Accounting\Application;

use App\Shared\Domain\Money;
use App\Shared\Exceptions\AppException;
use App\Shared\Numbering\NumberSequence;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/** Use case: record money paid out (payment) or received (receipt) against a supplier/customer. */
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
            $no = $this->numbers->next('voucher', 'VO', $branchId);
            $id = DB::table('vouchers')->insertGetId([
                'tenant_id' => $this->ctx->tenantId(), 'branch_id' => $branchId, 'voucher_no' => $no,
                'party_type' => $d['party_type'], 'party_id' => $d['party_id'], 'direction' => $d['direction'],
                'method' => $d['method'], 'amount_minor' => $amount->minor, 'bill_ref' => $d['bill_ref'] ?? null,
                'notes' => $d['notes'] ?? null, 'voucher_date' => $d['voucher_date'], 'created_by' => $userId,
                'created_at' => now(), 'updated_at' => now(),
            ]);

            // money in = credit, money out = debit (same rule as the old system)
            $this->ledger->post($d['party_type'], (int) $d['party_id'], $d['direction'] === 'receipt' ? 'credit' : 'debit',
                $amount, 'voucher', $id, ($d['direction'] === 'receipt' ? 'Receipt ' : 'Payment ') . $no
                . (! empty($d['bill_ref']) ? " | Ref: {$d['bill_ref']}" : ''), $d['voucher_date'], $branchId, $userId);

            return ['id' => $id, 'voucher_no' => $no];
        });
    }
}
