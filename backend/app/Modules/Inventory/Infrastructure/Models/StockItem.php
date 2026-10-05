<?php
declare(strict_types=1);

namespace App\Modules\Inventory\Infrastructure\Models;

use App\Modules\Catalog\Infrastructure\Models\{Color, DeviceModel};
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class StockItem extends Model
{
    use BelongsToTenant;

    public const ACTIVE = ['in_stock', 'in_transit'];

    protected $casts = ['cost_minor' => 'integer'];

    public function deviceModel(): BelongsTo
    {
        return $this->belongsTo(DeviceModel::class);
    }

    public function color(): BelongsTo
    {
        return $this->belongsTo(Color::class);
    }
}
