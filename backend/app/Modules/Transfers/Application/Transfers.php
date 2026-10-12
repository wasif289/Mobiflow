<?php
declare(strict_types=1);

namespace App\Modules\Transfers\Application;

use App\Modules\Identity\Infrastructure\Models\Branch;
use App\Modules\Inventory\Infrastructure\Models\StockItem;
use App\Shared\Application\ParseImeis;
use App\Shared\Exceptions\AppException;
use App\Shared\Numbering\NumberSequence;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/**
 * Branch-to-branch stock movement. Send: phones become in_transit (nobody can sell them).
 * Receive (at the destination branch): they become in_stock there. Cancel (at the sending branch): they go back to in_stock.
 */
final class Transfers
{
    public function __construct(private readonly TenantContext $ctx, private readonly NumberSequence $numbers) {}

    /** @param array{to_branch_id:int,imeis:array,note?:?string} $d */
    public function send(array $d, int $userId): array
    {
        $from = $this->ctx->branchId() ?? throw new AppException(422, 'BRANCH_REQUIRED', 'Select a branch first.');
        (int) $d['to_branch_id'] !== $from || throw new AppException(422, 'SAME_BRANCH', 'Pick a different branch to send to.', ['to_branch_id' => ['Same as the sending branch']]);
        Branch::where('id', $d['to_branch_id'])->where('is_active', true)->exists()
            || throw new AppException(422, 'INVALID_BRANCH', 'That branch does not exist or is inactive.', ['to_branch_id' => ['Invalid branch']]);
        $imeis = ParseImeis::from($d['imeis']);

        return DB::transaction(function () use ($d, $userId, $from, $imeis) {
            $stock = StockItem::whereIn('imei', $imeis)->where('status', 'in_stock')->lockForUpdate()->get()->keyBy('imei');
            $bad = [];
            foreach ($imeis as $imei) {
                $s = $stock->get($imei);
                if (! $s) { $bad[] = "{$imei}: not in stock"; }
                elseif ((int) $s->branch_id !== $from) { $bad[] = "{$imei}: is in another branch"; }
            }
            $bad && throw new AppException(409, 'ITEMS_NOT_AVAILABLE', 'Some phones cannot be transferred.', ['imei' => $bad]);

            $no = $this->numbers->next('transfer', 'TR', $from);
            $id = DB::table('stock_transfers')->insertGetId([
                'tenant_id' => $this->ctx->tenantId(), 'from_branch_id' => $from, 'to_branch_id' => $d['to_branch_id'], 'transfer_no' => $no,
                'note' => $d['note'] ?? null, 'created_by' => $userId, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('stock_transfer_items')->insert($stock->map(fn (StockItem $s) => ['tenant_id' => $this->ctx->tenantId(), 'transfer_id' => $id, 'stock_item_id' => $s->id])->values()->all());
            StockItem::whereIn('id', $stock->pluck('id'))->update(['status' => 'in_transit', 'updated_at' => now()]);

            return ['id' => $id, 'transfer_no' => $no, 'count' => $stock->count()];
        });
    }

    public function receive(int $id, int $userId): void
    {
        DB::transaction(function () use ($id, $userId) {
            $t = $this->pending($id);
            $this->ctx->branchId() === (int) $t->to_branch_id
                || throw new AppException(403, 'WRONG_BRANCH', 'Switch to the receiving branch to receive this transfer.');
            StockItem::whereIn('id', $this->itemIds($id))->where('status', 'in_transit')
                ->update(['branch_id' => $t->to_branch_id, 'status' => 'in_stock', 'updated_at' => now()]);
            DB::table('stock_transfers')->where('id', $id)->update(['status' => 'received', 'received_by' => $userId, 'received_at' => now(), 'updated_at' => now()]);
        });
    }

    public function cancel(int $id): void
    {
        DB::transaction(function () use ($id) {
            $t = $this->pending($id);
            $this->ctx->branchId() === (int) $t->from_branch_id
                || throw new AppException(403, 'WRONG_BRANCH', 'Only the sending branch can cancel this transfer.');
            StockItem::whereIn('id', $this->itemIds($id))->where('status', 'in_transit')->update(['status' => 'in_stock', 'updated_at' => now()]);
            DB::table('stock_transfers')->where('id', $id)->update(['status' => 'cancelled', 'updated_at' => now()]);
        });
    }

    private function pending(int $id): object
    {
        $t = DB::table('stock_transfers')->where('tenant_id', $this->ctx->tenantId())->where('id', $id)->lockForUpdate()->first()
            ?? throw new AppException(404, 'NOT_FOUND', 'The requested resource was not found.');
        $t->status === 'pending' || throw new AppException(409, 'NOT_PENDING', "This transfer is already {$t->status}.");
        return $t;
    }

    private function itemIds(int $id): array
    {
        return DB::table('stock_transfer_items')->where('transfer_id', $id)->pluck('stock_item_id')->all();
    }
}
