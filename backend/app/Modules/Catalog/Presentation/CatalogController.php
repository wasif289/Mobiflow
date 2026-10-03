<?php
declare(strict_types=1);

namespace App\Modules\Catalog\Presentation;

use App\Modules\Catalog\Infrastructure\Models\{Brand, Color, DeviceModel, Variant};
use App\Shared\Exceptions\AppException;
use Illuminate\Http\{JsonResponse, Request};

/** One controller for the four simple lookup resources. Writes: owner/admin only (until permissions land). */
final class CatalogController
{
    private const RESOURCES = [
        'brands'   => [Brand::class,       ['name' => 'required|string|max:80'], null],
        'models'   => [DeviceModel::class, ['brand_id' => 'required|integer|exists:brands,id', 'name' => 'required|string|max:120'], 'brand'],
        'variants' => [Variant::class,     ['device_model_id' => 'required|integer|exists:device_models,id', 'name' => 'required|string|max:60'], 'deviceModel'],
        'colors'   => [Color::class,       ['name' => 'required|string|max:40'], null],
    ];

    public function index(Request $request, string $resource): JsonResponse
    {
        [$model, , $with] = self::RESOURCES[$resource];
        $q = $model::query()->orderBy('name');
        $with && $q->with($with);
        if ($s = trim((string) $request->query('q'))) {
            $q->where('name', 'ilike', '%' . addcslashes($s, '%_\\') . '%');
        }
        return response()->json($q->paginate(50));
    }

    public function store(Request $request, string $resource): JsonResponse
    {
        $this->authorizeWrite($request);
        [$model, $rules] = self::RESOURCES[$resource];
        return response()->json($model::create($request->validate($rules)), 201);
    }

    public function update(Request $request, string $resource, int $id): JsonResponse
    {
        $this->authorizeWrite($request);
        [$model, $rules] = self::RESOURCES[$resource];
        $row = $model::findOrFail($id);
        $row->update($request->validate($rules));
        return response()->json($row);
    }

    public function destroy(Request $request, string $resource, int $id): JsonResponse
    {
        $this->authorizeWrite($request);
        [$model] = self::RESOURCES[$resource];
        $model::findOrFail($id)->delete(); // FK restrict -> 409 RESOURCE_IN_USE via ProblemDetails
        return response()->json(null, 204);
    }

    private function authorizeWrite(Request $request): void
    {
        $request->user()->seesAllBranches()
            || throw new AppException(403, 'FORBIDDEN', 'Only the owner or an admin can change the catalog.');
    }
}
