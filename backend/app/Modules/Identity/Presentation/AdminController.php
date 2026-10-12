<?php
declare(strict_types=1);

namespace App\Modules\Identity\Presentation;

use App\Modules\Identity\Domain\Permissions;
use App\Modules\Identity\Infrastructure\Models\{Branch, User};
use App\Shared\Exceptions\AppException;
use App\Shared\Http\ListResponse as L;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\{DB, Hash};
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/** Users, branches and shop settings. Route-guarded by the non-delegable "admin" permission. */
final class AdminController
{
    public function __construct(private readonly TenantContext $ctx) {}

    public function meta(): JsonResponse
    {
        return response()->json(['modules' => Permissions::MODULES, 'presets' => Permissions::PRESETS]);
    }

    // ---------- users ----------
    public function users(Request $r)
    {
        $base = DB::table('users as u')->where('u.tenant_id', $this->ctx->tenantId())
            ->when($r->query('role'), fn ($q, $v) => $q->where('u.role', $v))
            ->when($r->query('status') === 'active', fn ($q) => $q->where('u.is_active', true))
            ->when($r->query('status') === 'inactive', fn ($q) => $q->where('u.is_active', false))
            ->when(trim((string) $r->query('q')), fn ($q, $s) => $q->where(fn ($w) => $w->where('u.name', 'ilike', L::like($s))->orWhere('u.username', 'ilike', L::like($s))))
            ->selectRaw("u.id, u.name, u.username, u.role, u.is_active, u.last_login_at,
                (select string_agg(b.name, ', ' order by b.name) from branch_user bu join branches b on b.id = bu.branch_id where bu.user_id = u.id) as branches");

        return L::make($base, $r, ['name' => 'u.name', 'username' => 'u.username', 'role' => 'u.role', 'login' => 'u.last_login_at'], 'name',
            'count(*) c, count(*) filter (where is_active) a',
            fn ($x) => ['id' => $x->id, 'name' => $x->name, 'username' => $x->username, 'role' => $x->role, 'branches' => $x->branches,
                'active' => (bool) $x->is_active, 'last_login' => $x->last_login_at],
            fn ($t) => ['count' => (int) $t->c, 'active' => (int) $t->a], 'users');
    }

    public function showUser(int $id): JsonResponse
    {
        return response()->json($this->detail(User::findOrFail($id)));
    }

    public function storeUser(Request $r): JsonResponse
    {
        $this->limit('users', 'max_users', User::count());
        $d = $r->validate([
            'name' => 'required|string|max:100',
            'username' => ['required', 'alpha_dash:ascii', 'max:50', Rule::unique('users', 'username')->where('tenant_id', $this->ctx->tenantId())],
            'password' => ['required', Password::min(8)],
            'role' => 'required|in:admin,staff',
            'branch_ids' => 'array', 'branch_ids.*' => 'integer',
            'permissions' => 'array', 'permissions.*' => ['string', Rule::in(Permissions::all())],
        ]);
        $d['role'] === 'admin' && $this->ownerOnly($r);
        $branches = $this->branchIds($d['branch_ids'] ?? []);

        $user = DB::transaction(function () use ($d, $branches) {
            $u = User::create(['name' => $d['name'], 'username' => $d['username'], 'password' => $d['password'], 'role' => $d['role'],
                'permissions' => $d['role'] === 'staff' ? array_values(array_unique($d['permissions'] ?? [])) : []]);
            $u->branches()->sync($this->pivot($branches));
            return $u;
        });
        return response()->json($this->detail($user), 201);
    }

    public function updateUser(Request $r, int $id): JsonResponse
    {
        $u = User::findOrFail($id);
        $d = $r->validate([
            'name' => 'sometimes|string|max:100', 'role' => 'sometimes|in:admin,staff', 'is_active' => 'sometimes|boolean',
            'password' => ['nullable', Password::min(8)],
            'branch_ids' => 'array', 'branch_ids.*' => 'integer',
            'permissions' => 'array', 'permissions.*' => ['string', Rule::in(Permissions::all())],
        ]);

        ($u->role === 'admin' || ($d['role'] ?? null) === 'admin') && $this->ownerOnly($r);
        if ($u->role === 'owner' || $u->id === $r->user()->id) { // the owner and yourself can't be demoted or locked out
            unset($d['role']);
            $d['is_active'] = true;
        }

        $branches = array_key_exists('branch_ids', $d) ? $this->branchIds($d['branch_ids']) : null;
        DB::transaction(function () use ($u, $d, $branches) {
            $role = $d['role'] ?? $u->role;
            $u->fill(array_filter([
                'name' => $d['name'] ?? null, 'role' => $d['role'] ?? null,
                'password' => $d['password'] ?? null,
            ], fn ($v) => $v !== null));
            isset($d['is_active']) && $u->is_active = $d['is_active'];
            if ($role === 'staff' && array_key_exists('permissions', $d)) {
                $u->permissions = array_values(array_unique($d['permissions']));
            } elseif ($role !== 'staff') {
                $u->permissions = [];
            }
            $u->save();
            $branches !== null && $u->branches()->sync($this->pivot($branches));
        });
        // changed password or deactivated: kick out every active session
        (! empty($d['password']) || ($d['is_active'] ?? true) === false) && $u->tokens()->delete();

        return response()->json($this->detail($u->refresh()));
    }

    // ---------- branches ----------
    public function branches(): JsonResponse
    {
        return response()->json(Branch::orderByDesc('is_main')->orderBy('name')->get(['id', 'code', 'name', 'phone', 'address', 'is_main', 'is_active']));
    }

    public function storeBranch(Request $r): JsonResponse
    {
        $this->limit('branches', 'max_branches', Branch::where('is_active', true)->count());
        $r->merge(['code' => strtoupper((string) $r->input('code'))]);
        $d = $r->validate([
            'code' => ['required', 'alpha_dash:ascii', 'max:20', Rule::unique('branches', 'code')->where('tenant_id', $this->ctx->tenantId())],
            'name' => 'required|string|max:100', 'phone' => 'nullable|string|max:30', 'address' => 'nullable|string|max:300',
        ]);
        return response()->json(Branch::create($d), 201);
    }

    public function updateBranch(Request $r, int $id): JsonResponse
    {
        $b = Branch::findOrFail($id);
        $d = $r->validate(['name' => 'sometimes|string|max:100', 'phone' => 'nullable|string|max:30', 'address' => 'nullable|string|max:300', 'is_active' => 'sometimes|boolean']);
        if ($b->is_main && ($d['is_active'] ?? true) === false) {
            throw new AppException(422, 'MAIN_BRANCH_REQUIRED', 'The main branch cannot be deactivated.');
        }
        if (($d['is_active'] ?? false) === true && ! $b->is_active) {
            $this->limit('branches', 'max_branches', Branch::where('is_active', true)->count());
        }
        $b->update($d);
        return response()->json($b);
    }

    // ---------- settings + plan usage ----------
    public function settings(): JsonResponse
    {
        return response()->json($this->settingsPayload());
    }

    public function saveSettings(Request $r): JsonResponse
    {
        $d = $r->validate(['name' => 'required|string|max:100', 'phone' => 'nullable|string|max:30', 'address' => 'nullable|string|max:300', 'footer' => 'nullable|string|max:200']);
        $t = DB::table('tenants')->where('id', $this->ctx->tenantId());
        $current = json_decode((string) $t->value('settings'), true) ?: [];
        $t->update(['name' => $d['name'], 'updated_at' => now(),
            'settings' => json_encode(array_merge($current, ['phone' => $d['phone'] ?? null, 'address' => $d['address'] ?? null, 'footer' => $d['footer'] ?? null]))]);
        return response()->json($this->settingsPayload());
    }

    // ---------- helpers ----------
    private function settingsPayload(): array
    {
        $t = DB::table('tenants as t')->leftJoin('plans as p', 'p.id', '=', 't.plan_id')->where('t.id', $this->ctx->tenantId())
            ->first(['t.name', 't.settings', 't.status', 't.trial_ends_at', 'p.name as plan', 'p.max_users', 'p.max_branches']);
        $s = json_decode((string) $t->settings, true) ?: [];
        return [
            'name' => $t->name, 'phone' => $s['phone'] ?? null, 'address' => $s['address'] ?? null, 'footer' => $s['footer'] ?? null,
            'plan' => ['name' => $t->plan ?? 'No plan', 'status' => $t->status, 'trial_ends_at' => $t->trial_ends_at,
                'max_users' => $t->max_users, 'max_branches' => $t->max_branches,
                'users' => User::where('is_active', true)->count(), 'branches' => Branch::where('is_active', true)->count()],
        ];
    }

    private function limit(string $what, string $column, int $count): void
    {
        $max = DB::table('tenants as t')->leftJoin('plans as p', 'p.id', '=', 't.plan_id')->where('t.id', $this->ctx->tenantId())->value("p.{$column}");
        if ($max !== null && $count >= (int) $max) {
            throw new AppException(402, 'PLAN_LIMIT_REACHED', "Your plan allows {$max} {$what}. Upgrade your plan to add more.");
        }
    }

    private function ownerOnly(Request $r): void
    {
        $r->user()->role === 'owner' || throw new AppException(403, 'FORBIDDEN', 'Only the owner can create or change admins.');
    }

    /** @return list<int> only branches that belong to this shop */
    private function branchIds(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        count(Branch::whereIn('id', $ids)->pluck('id')) === count($ids)
            || throw new AppException(422, 'INVALID_BRANCH', 'One of the selected branches does not exist.', ['branch_ids' => ['Invalid branch']]);
        return $ids;
    }

    private function pivot(array $ids): array
    {
        return collect($ids)->mapWithKeys(fn ($i) => [$i => ['tenant_id' => $this->ctx->tenantId()]])->all();
    }

    private function detail(User $u): array
    {
        return ['id' => $u->id, 'name' => $u->name, 'username' => $u->username, 'role' => $u->role, 'is_active' => $u->is_active,
            'branch_ids' => $u->branches()->pluck('branches.id')->all(), 'permissions' => $u->permissions ?? []];
    }
}
