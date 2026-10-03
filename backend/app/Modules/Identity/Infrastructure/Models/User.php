<?php
declare(strict_types=1);

namespace App\Modules\Identity\Infrastructure\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

final class User extends Authenticatable
{
    use HasApiTokens, BelongsToTenant;

    protected $fillable = ['name', 'username', 'email', 'password', 'role', 'is_active', 'last_login_at'];
    protected $hidden = ['password', 'remember_token'];

    protected static function booted(): void
    {
        // Public, non-guessable id; always generated here, never trusted from input.
        static::creating(fn (self $user) => $user->public_id ??= (string) Str::ulid());
    }

    protected function casts(): array
    {
        return ['password' => 'hashed', 'is_active' => 'boolean', 'last_login_at' => 'datetime'];
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class, 'branch_user');
    }

    public function seesAllBranches(): bool
    {
        return in_array($this->role, ['owner', 'admin'], true);
    }
}