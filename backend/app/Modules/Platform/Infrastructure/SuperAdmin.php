<?php
declare(strict_types=1);

namespace App\Modules\Platform\Infrastructure;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/** The people who run the SaaS. A completely separate identity from shop users. */
final class SuperAdmin extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'super_admins';
    protected $fillable = ['name', 'email', 'password'];
    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed'];
    }
}
