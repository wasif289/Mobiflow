<?php
declare(strict_types=1);

namespace App\Modules\Accounting\Presentation;

use App\Modules\Accounting\Application\CreateVoucher;
use App\Shared\Domain\Money;
use App\Shared\Exceptions\AppException;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;

final class AccountController
{
    private const SIGNED = [
        'supplier' => 'credit_minor - debit_minor',
        'customer' => 'debit_minor - credit_minor',
    ];

    /** Every supplier (or customer) with their current balance. */
    public function balances(string $type): JsonResponse
    {
        $expr = self::SIGNED[$type];
        $rows = DB::table(($type === 'supplier' ? 'suppliers' : 'customers') . ' as p')
            ->leftJoin('ledger_entries as l', fn ($j) => $j->on('l.party_id', '=', 'p.id')->where('l.party_type', '=', $type))
            ->groupBy('p.id', 'p.name', 'p.phone')->orderBy('p.name')
            ->selectRaw("p.id, p.name, p.phone, COALESCE(SUM(l.{$expr}), 0) AS balance_minor")->get();

        return response()->json([
            'total' => Money::ofMinor((int) $rows->sum('balance_minor'))->toDecimal(),
            'rows' => $rows->map(fn ($r) => ['id' => $r->id, 'name' => $r->name, 'phone' => $r->phone,
                'balance' => Money::ofMinor((int) $r->balance_minor)->toDecimal()]),
        ]);
    }

    /** Statement with running balance. The window runs over ALL entries, so filtering dates keeps balances correct. */
    public function statement(Request $request, string $type, int $id): JsonResponse
    {
        $party = DB::table($type === 'supplier' ? 'suppliers' : 'customers')->where('id', $id)->first(['id', 'name', 'phone'])
            ?? throw new AppException(404, 'NOT_FOUND', 'The requested resource was not found.');
        $from = $request->query('from') ?: null;
        $to = $request->query('to') ?: null;
        $expr = self::SIGNED[$type];

        $rows = DB::select("SELECT * FROM (
                SELECT id, entry_date, ref_type, description, debit_minor, credit_minor,
                       SUM({$expr}) OVER (ORDER BY entry_date, id) AS balance_minor
                FROM ledger_entries WHERE party_type = ? AND party_id = ?
            ) t WHERE (?::date IS NULL OR entry_date >= ?::date) AND (?::date IS NULL OR entry_date <= ?::date)
            ORDER BY entry_date, id", [$type, $id, $from, $from, $to, $to]);

        $balance = (int) DB::table('ledger_entries')->where('party_type', $type)->where('party_id', $id)
            ->selectRaw("COALESCE(SUM({$expr}), 0) AS b")->value('b');

        return response()->json([
            'party' => $party, 'balance' => Money::ofMinor($balance)->toDecimal(),
            'rows' => array_map(fn ($r) => [
                'id' => $r->id, 'date' => $r->entry_date, 'ref' => $r->ref_type, 'description' => $r->description,
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
            'notes' => 'nullable|string|max:300', 'voucher_date' => 'required|date',
        ]);
        return response()->json($create($d, (int) $request->user()->id), 201);
    }
}
