<?php
declare(strict_types=1);

namespace App\Modules\Identity\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

final class Branch extends Model
{
    use BelongsToTenant;

    protected $fillable = ['code', 'name', 'address', 'phone', 'is_main', 'is_active'];
    protected $casts = ['is_main' => 'boolean', 'is_active' => 'boolean'];
}
