<?php
declare(strict_types=1);

namespace App\Modules\Purchasing\Presentation;

use App\Modules\Purchasing\Application\CreatePurchaseReturn;
use App\Shared\Exceptions\AppException;
use Illuminate\Http\{JsonResponse, Request};

final class PurchaseReturnController
{
    public function __invoke(Request $request, int $id, CreatePurchaseReturn $create): JsonResponse
    {
        // Money-affecting action: owner/admin only until granular permissions land.
        $request->user()->seesAllBranches()
            || throw new AppException(403, 'FORBIDDEN', 'Only the owner or an admin can process returns.');

        $d = $request->validate([
            'imeis' => 'required|array|min:1|max:100', 'imeis.*' => 'required|string|max:20',
            'reason' => 'required|string|max:200', 'return_date' => 'required|date',
        ]);

        return response()->json($create($id, $d, (int) $request->user()->id), 201);
    }
}
