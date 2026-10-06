<?php
declare(strict_types=1);

namespace App\Modules\Catalog\Presentation;

use App\Modules\Catalog\Infrastructure\Models\TacMapping;
use App\Shared\Domain\Imei;
use App\Shared\Exceptions\AppException;
use Illuminate\Http\{JsonResponse, Request};
use InvalidArgumentException;

final class TacController
{
    /** GET /imei/{imei}: validate (Luhn) and auto-detect brand/model from the first 8 digits. */
    public function lookup(string $imei): JsonResponse
    {
        try {
            $parsed = new Imei($imei);
        } catch (InvalidArgumentException) {
            throw new AppException(422, 'INVALID_IMEI', 'This IMEI is not valid. Check the 15 digits.', ['imei' => ['Invalid IMEI']]);
        }

        $map = TacMapping::with('deviceModel.brand')->where('tac', $parsed->tac())->first();

        return response()->json([
            'imei' => $parsed->value,
            'tac' => $parsed->tac(),
            'model' => $map ? [
                'id' => $map->deviceModel->id, 'name' => $map->deviceModel->name,
                'brand' => $map->deviceModel->brand->name,
            ] : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate([
            'tac' => 'required|digits:8',
            'device_model_id' => 'required|integer|exists:device_models,id',
        ]);
        return response()->json(
            TacMapping::updateOrCreate(['tac' => $d['tac']], ['device_model_id' => $d['device_model_id']]), 201
        );
    }
}
