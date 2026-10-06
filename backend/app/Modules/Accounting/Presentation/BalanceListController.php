<?php
declare(strict_types=1);

namespace App\Modules\Accounting\Presentation;

use App\Shared\Http\ListResponse as L;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class BalanceListController
{
    public function __invoke(Request $r, TenantContext $ctx, string $type)
    {
        // supplier: positive = we owe them. customer: positive = they owe us. Negative = advance.
        $bal = 'COALESCE(SUM(' . ($type === 'supplier' ? 'l.credit_minor - l.debit_minor' : 'l.debit_minor - l.credit_minor') . '), 0)';
        $base = DB::table(($type === 'supplier' ? 'suppliers' : 'customers') . ' as p')
            ->leftJoin('ledger_entries as l', fn ($j) => $j->on('l.party_id', '=', 'p.id')->where('l.party_type', '=', $type)->whereColumn('l.tenant_id', 'p.tenant_id'))
            ->where('p.tenant_id', $ctx->tenantId())
            ->when(trim((string) $r->query('q')), fn ($q, $s) => $q->where(fn ($w) => $w->where('p.name', 'ilike', L::like($s))->orWhere('p.phone', 'ilike', L::like($s))))
            ->groupBy('p.id', 'p.name', 'p.phone')
            ->selectRaw("p.id, p.name, p.phone, {$bal} as balance_minor");

        match ($r->query('balance')) {
            'positive' => $base->havingRaw("{$bal} > 0"),
            'advance' => $base->havingRaw("{$bal} < 0"),
            'zero' => $base->havingRaw("{$bal} = 0"),
            default => null,
        };
        is_numeric($r->query('min_balance')) && $base->havingRaw("{$bal} >= ?", [(int) round((float) $r->query('min_balance') * 100)]);

        return L::make($base, $r, ['name' => 'p.name', 'phone' => 'p.phone', 'balance' => 'balance_minor'], 'name',
            'count(*) c, coalesce(sum(balance_minor),0) total',
            fn ($x) => ['id' => $x->id, 'name' => $x->name, 'phone' => $x->phone, 'balance' => L::m($x->balance_minor)],
            fn ($t) => ['count' => (int) $t->c, 'total' => L::m($t->total)], $type . 's');
    }
}
