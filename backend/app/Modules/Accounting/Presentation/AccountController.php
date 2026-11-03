<?php
declare(strict_types=1);

namespace App\Modules\Accounting\Presentation;

use App\Modules\Accounting\Application\CreateVoucher;
use App\Shared\Domain\Money;
use App\Shared\Exceptions\AppException;
use Illuminate\Http\{JsonResponse, Request};
use App\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class AccountController
{
    private const SIGNED = [
        'supplier' => 'credit_minor - debit_minor',
        'customer' => 'debit_minor - credit_minor',
    ];

    /** Statement with running balance. The window runs over ALL entries, so filtering dates keeps balances correct. */
    public function statement(Request $request, TenantContext $ctx, string $type, int $id): JsonResponse
    {
        $tid = $ctx->tenantId();
        $party = DB::table($type === 'supplier' ? 'suppliers' : 'customers')->where('tenant_id', $tid)->where('id', $id)->first(['id', 'name', 'phone'])
            ?? throw new AppException(404, 'NOT_FOUND', 'The requested resource was not found.');
        $from = $request->query('from') ?: null;
        $to = $request->query('to') ?: null;
        $expr = self::SIGNED[$type];

        $rows = DB::select("SELECT * FROM (
                SELECT id, entry_date, ref_type,ref_id, description, debit_minor, credit_minor,
                       SUM({$expr}) OVER (ORDER BY entry_date, id) AS balance_minor
                FROM ledger_entries WHERE tenant_id = ? AND party_type = ? AND party_id = ?
            ) t WHERE (?::date IS NULL OR entry_date >= ?::date) AND (?::date IS NULL OR entry_date <= ?::date)
            ORDER BY entry_date, id", [$tid, $type, $id, $from, $from, $to, $to]);

        $balance = (int) DB::table('ledger_entries')->where('tenant_id', $tid)->where('party_type', $type)->where('party_id', $id)
            ->selectRaw("COALESCE(SUM({$expr}), 0) AS b")->value('b');

        return response()->json([
            'party' => $party, 'balance' => Money::ofMinor($balance)->toDecimal(),
            'rows' => array_map(fn ($r) => [
                'id' => $r->id, 'date' => $r->entry_date, 'ref' => $r->ref_type, 'ref_id' => $r->ref_id, 'description' => $r->description,
                'debit' => Money::ofMinor((int) $r->debit_minor)->toDecimal(), 'credit' => Money::ofMinor((int) $r->credit_minor)->toDecimal(),
                'balance' => Money::ofMinor((int) $r->balance_minor)->toDecimal(),
            ], $rows),
        ]);
    }

    public function storeVoucher(Request $request, CreateVoucher $create): JsonResponse
    {
        $d = $request->validate([
            'party_type' => 'required|in:supplier,customer', 'party_id' => 'required|integer',
            'direction' => 'required|in:payment,receipt', 'method' => 'required|in:cash,bank,jazzcash,easypaisa,cheque',
            'amount' => ['required', 'regex:/^\d+(\.\d{1,2})?$/'], 'bill_ref' => 'nullable|string|max:60',
            'purchase_id' => 'nullable|integer', 'sale_id' => 'nullable|integer',
            'notes' => 'nullable|string|max:300', 'voucher_date' => 'required|date',
        ]);
        return response()->json($create($d, (int) $request->user()->id), 201);
    }

    /** What the voucher form needs for one party: who they are, what is owed, and the unpaid bills a voucher can settle. */
    public function open(TenantContext $ctx, string $type, int $id): JsonResponse
    {
        $tid = $ctx->tenantId();
        $party = DB::table($type === 'supplier' ? 'suppliers' : 'customers')->where('tenant_id', $tid)->where('id', $id)->first(['id', 'name', 'phone'])
            ?? throw new AppException(404, 'NOT_FOUND', 'The requested resource was not found.');
        $balance = (int) DB::table('ledger_entries')->where('tenant_id', $tid)->where('party_type', $type)->where('party_id', $id)
            ->selectRaw('COALESCE(SUM(' . self::SIGNED[$type] . '), 0) AS b')->value('b');

        [$table, $partyCol, $paidCol, $dateCol] = $type === 'supplier' ? ['purchases', 'supplier_id', 'paid_minor', 'purchase_date'] : ['sales', 'customer_id', 'received_minor', 'sale_date'];
        $bills = DB::table($table)->where('tenant_id', $tid)->where($partyCol, $id)->whereRaw("total_minor > {$paidCol}")
            ->orderBy($dateCol)->orderBy('id')->limit(100)->get(['id', 'invoice_no', $dateCol . ' as date', 'total_minor', $paidCol . ' as paid_minor'])
            ->map(fn ($b) => ['id' => $b->id, 'invoice_no' => $b->invoice_no, 'date' => substr((string) $b->date, 0, 10),
                'total' => Money::ofMinor((int) $b->total_minor)->toDecimal(), 'paid' => Money::ofMinor((int) $b->paid_minor)->toDecimal(),
                'due' => Money::ofMinor((int) $b->total_minor - (int) $b->paid_minor)->toDecimal()]);

        return response()->json(['party' => $party, 'balance' => Money::ofMinor($balance)->toDecimal(), 'bills' => $bills]);
    }

    /** Recent vouchers of the selected branch (for the "recent" list in the voucher window). */
    public function vouchers(Request $request, TenantContext $ctx): JsonResponse
    {
        $rows = DB::table('vouchers as v')
            ->leftJoin('suppliers as s', fn ($j) => $j->on('s.id', '=', 'v.party_id')->where('v.party_type', 'supplier'))
            ->leftJoin('customers as c', fn ($j) => $j->on('c.id', '=', 'v.party_id')->where('v.party_type', 'customer'))
            ->where('v.tenant_id', $ctx->tenantId())
            ->when($ctx->branchId(), fn ($q, $b) => $q->where('v.branch_id', $b))
            ->when(in_array($request->query('direction'), ['payment', 'receipt'], true), fn ($q) => $q->where('v.direction', $request->query('direction')))
            ->orderByDesc('v.id')->limit(min(50, max(1, (int) ($request->query('limit') ?: 15))))
            ->get(['v.id', 'v.voucher_no', 'v.voucher_date', 'v.direction', 'v.method', 'v.amount_minor', 'v.bill_ref', DB::raw('COALESCE(s.name, c.name) AS party')]);

        return response()->json($rows->map(fn ($v) => ['id' => $v->id, 'voucher_no' => $v->voucher_no, 'date' => substr((string) $v->voucher_date, 0, 10),
            'direction' => $v->direction, 'method' => $v->method, 'amount' => Money::ofMinor((int) $v->amount_minor)->toDecimal(), 'bill_ref' => $v->bill_ref, 'party' => $v->party]));
    }

    /** Everything the printed slip shows, including the party's balance right after this voucher. */
    public function voucher(TenantContext $ctx, int $id): JsonResponse
    {
        $tid = $ctx->tenantId();
        $v = DB::table('vouchers')->where('tenant_id', $tid)->where('id', $id)->first() ?? throw new AppException(404, 'NOT_FOUND', 'The requested resource was not found.');
        $party = DB::table($v->party_type === 'supplier' ? 'suppliers' : 'customers')->where('tenant_id', $tid)->where('id', $v->party_id)->first(['name', 'phone']);
        $expr = self::SIGNED[$v->party_type];
        $after = DB::selectOne("SELECT bal FROM (SELECT ref_type, ref_id, SUM({$expr}) OVER (ORDER BY entry_date, id) AS bal
            FROM ledger_entries WHERE tenant_id = ? AND party_type = ? AND party_id = ?) t WHERE ref_type = 'voucher' AND ref_id = ?", [$tid, $v->party_type, $v->party_id, $v->id]);

        $bill = null;
        if ($v->purchase_id || $v->sale_id) {
            [$table, $billId, $paidCol, $dateCol] = $v->purchase_id ? ['purchases', $v->purchase_id, 'paid_minor', 'purchase_date'] : ['sales', $v->sale_id, 'received_minor', 'sale_date'];
            $b = DB::table($table)->where('tenant_id', $tid)->where('id', $billId)->first();
            $b && $bill = ['invoice_no' => $b->invoice_no, 'date' => substr((string) $b->{$dateCol}, 0, 10), 'total' => Money::ofMinor((int) $b->total_minor)->toDecimal(),
                'paid' => Money::ofMinor((int) $b->{$paidCol})->toDecimal(), 'due' => Money::ofMinor((int) $b->total_minor - (int) $b->{$paidCol})->toDecimal()];
        }

        return response()->json([
            'kind' => 'party', 'id' => $v->id, 'voucher_no' => $v->voucher_no, 'direction' => $v->direction, 'date' => substr((string) $v->voucher_date, 0, 10),
            'party_type' => $v->party_type, 'party' => $party?->name, 'phone' => $party?->phone, 'method' => $v->method,
            'amount' => Money::ofMinor((int) $v->amount_minor)->toDecimal(), 'bill_ref' => $v->bill_ref, 'notes' => $v->notes, 'bill' => $bill,
            'balance' => $after ? Money::ofMinor((int) $after->bal)->toDecimal() : null,
            'by' => DB::table('users')->where('id', $v->created_by)->value('name'), 'branch' => DB::table('branches')->where('id', $v->branch_id)->value('name'),
            'created_at' => (string) $v->created_at,
        ]);
    }
}
