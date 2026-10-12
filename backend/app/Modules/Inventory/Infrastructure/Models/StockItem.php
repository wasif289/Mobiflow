<?php
<<<<<<< HEAD

=======
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
declare(strict_types=1);

namespace App\Modules\Inventory\Infrastructure\Models;

<<<<<<< HEAD
use App\Modules\Catalog\Infrastructure\Models\{Color, DeviceModel, Variant};
use App\Modules\Purchasing\Infrastructure\Models\Purchase;
=======
use App\Modules\Catalog\Infrastructure\Models\{Color, DeviceModel};
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
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

<<<<<<< HEAD
    public function variant(): BelongsTo
    {
        return $this->belongsTo(Variant::class);
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

=======
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
    public function color(): BelongsTo
    {
        return $this->belongsTo(Color::class);
    }
}
