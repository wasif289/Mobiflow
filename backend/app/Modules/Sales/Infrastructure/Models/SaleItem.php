<?php
declare(strict_types=1);

namespace App\Modules\Sales\Infrastructure\Models;

use App\Modules\Inventory\Infrastructure\Models\StockItem;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class SaleItem extends Model
{
    use BelongsToTenant;

    protected $casts = ['price_minor' => 'integer', 'cost_minor' => 'integer'];

    public function stockItem(): BelongsTo { return $this->belongsTo(StockItem::class); }
}
