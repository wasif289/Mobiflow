<?php
declare(strict_types=1);

namespace App\Shared\Http;

use App\Shared\Domain\Money;
use Closure;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** One engine for every list screen: sort (whitelisted), page size, totals over ALL filtered rows, CSV export. */
final class ListResponse
{
    public static function m(int|string|null $minor): string
    {
        return Money::ofMinor((int) $minor)->toDecimal();
    }

    public static function like(string $s): string
    {
        return '%' . addcslashes(trim($s), '%_\\') . '%';
    }

    /**
     * @param array<string,string> $sorts  query key => safe SQL expression
     * @param Closure(object):array $row   DB row -> display values (first key must be "id"; it is dropped from CSV)
     * @param Closure(object):array $totals
     */
    public static function make(Builder $base, Request $r, array $sorts, string $default, string $totalsSql,
                                Closure $row, Closure $totals, string $file): JsonResponse|StreamedResponse
    {
        $expr = $sorts[$r->query('sort')] ?? $sorts[$default];
        $dir = $r->query('dir') === 'asc' ? 'ASC' : 'DESC';
        $ordered = (clone $base)->orderByRaw("{$expr} {$dir} NULLS LAST")->orderByRaw('1 DESC');

        if ($r->query('export') === 'csv') {
            return response()->streamDownload(function () use ($ordered, $row) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel shows Urdu/names correctly
                $head = false;
                foreach ($ordered->cursor() as $rec) {
                    $a = $row($rec);
                    unset($a['id']);
                    $head || fputcsv($out, array_keys($a)) && $head = true;
                    fputcsv($out, array_values($a));
                }
                fclose($out);
            }, $file . '-' . now()->format('Ymd-His') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        $per = in_array((int) $r->query('per_page'), [10, 25, 50, 100], true) ? (int) $r->query('per_page') : 25;
        $page = $ordered->paginate($per);
        $t = DB::query()->fromSub(clone $base, 't')->selectRaw($totalsSql)->first();

        return response()->json([
            'data' => $page->getCollection()->map($row)->values(),
            'meta' => ['page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => $per],
            'totals' => $totals($t),
        ]);
    }
}
