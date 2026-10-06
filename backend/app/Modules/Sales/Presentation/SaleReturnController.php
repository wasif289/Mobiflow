<?php
declare(strict_types=1);

namespace App\Modules\Sales\Presentation;

use App\Modules\Sales\Application\CreateSaleReturn;
use App\Shared\Exceptions\AppException;
use Illuminate\Http\{JsonResponse, Request};

final class SaleReturnController
{
    public function __invoke(Request $request, int $id, CreateSaleReturn $create): JsonResponse
    {
        $d = $request->validate([
            'imeis' => 'required|array|min:1|max:100', 'imeis.*' => 'required|string|max:20',
            'reason' => 'required|string|max:200', 'return_date' => 'required|date',
        ]);

        return response()->json($create($id, $d, (int) $request->user()->id), 201);
    }
}
