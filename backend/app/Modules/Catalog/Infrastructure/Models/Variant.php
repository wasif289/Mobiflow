<?php
declare(strict_types=1);

namespace App\Modules\Catalog\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

final class Variant extends Model
{
    use BelongsToTenant;

    protected $table = 'variants';
    protected $fillable = ['device_model_id', 'name'];

    public function deviceModel(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(DeviceModel::class);
    }
}
