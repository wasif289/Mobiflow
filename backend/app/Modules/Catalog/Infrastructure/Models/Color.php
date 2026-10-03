<?php
declare(strict_types=1);

namespace App\Modules\Catalog\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

final class Color extends Model
{
    use BelongsToTenant;

    protected $table = 'colors';
    protected $fillable = ['name'];
}
