<?php
declare(strict_types=1);

namespace App\Modules\Identity\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

final class User extends Authenticatable
{
    use HasApiTokens, BelongsToTenant;

    protected $fillable = ['name', 'username', 'email', 'password', 'role', 'is_active', 'last_login_at', 'permissions'];
    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'is_active' => 'boolean', 'last_login_at' => 'datetime', 'permissions' => 'array'];
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class, 'branch_user');
    }

    public function sees(string $role): bool { return $this->role === $role; }
    public function seesAllBranches(): bool { return in_array($this->role, ['owner', 'admin'], true); }

    /** Owner/admin can do everything. Staff need the exact permission; any permission on a module also lets them view it. */
    public function allows(string $permission): bool
    {
        if ($this->seesAllBranches()) {
            return true;
        }
        if ($permission === 'admin') {
            return false;
        }
        $have = $this->permissions ?? [];
        if (in_array($permission, $have, true)) {
            return true;
        }
        if (str_ends_with($permission, '.view')) {
            $prefix = substr($permission, 0, -4);
            foreach ($have as $p) {
                if (str_starts_with($p, $prefix)) {
                    return true;
                }
            }
        }
        return false;
    }
}
