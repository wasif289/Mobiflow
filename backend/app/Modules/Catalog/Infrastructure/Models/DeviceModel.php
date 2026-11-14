<?php
declare(strict_types=1);

namespace App\Modules\Catalog\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $brand_id
 * @property string $name
 * @property-read Brand|null $brand
 */
final class DeviceModel extends Model
{
    use BelongsToTenant;

    protected $table = 'device_models';
    protected $fillable = ['brand_id', 'name'];

    public function brand(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
