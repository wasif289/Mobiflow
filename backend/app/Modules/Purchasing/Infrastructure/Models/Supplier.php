<?php
declare(strict_types=1);

namespace App\Modules\Purchasing\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

final class Supplier extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'phone', 'address'];
}
