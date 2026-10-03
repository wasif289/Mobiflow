<?php
declare(strict_types=1);

namespace App\Modules\Catalog\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

final class TacMapping extends Model
{
    use BelongsToTenant;

    protected $table = 'tac_mappings';
    protected $fillable = ['tac', 'device_model_id'];

    public function deviceModel(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(DeviceModel::class);
    }
}
