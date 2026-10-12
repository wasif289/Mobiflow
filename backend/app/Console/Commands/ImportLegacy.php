<?php
declare(strict_types=1);

namespace App\Console\Commands;

use App\Modules\Identity\Infrastructure\Models\Branch;
use App\Shared\Tenancy\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\{DB, Hash, Schema};
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Imports the old CodeIgniter MobiFlow MySQL database into ONE fresh shop.
 *  1. .env: LEGACY_DB_HOST / LEGACY_DB_PORT / LEGACY_DB_DATABASE / LEGACY_DB_USERNAME / LEGACY_DB_PASSWORD
 *  2. register a new shop in the app, then:  php artisan mobiflow:import <shop-code> --dry-run   (rolls back, shows the report)
 *  3. run again without --dry-run.
 * The old ledger is REBUILT from the documents (purchases, sales, returns, vouchers, opening balances) and then compared with the old balances.
 */
final class ImportLegacy extends Command
{
    protected $signature = 'mobiflow:import {tenant : shop code of an EMPTY shop (register it first)} {--dry-run : run everything, then roll back}';
    protected $description = 'Import data from the old CodeIgniter MobiFlow MySQL database into one shop';

    /** old module slug => [old action => new permission] */
    private const PERM = [
        'dashboard' => ['view' => 'dashboard.view'], 'purchase' => ['view' => 'purchases.view', 'create' => 'purchases.create'],
        'sales' => ['view' => 'sales.view', 'create' => 'sales.create'], 'inventory' => ['view' => 'inventory.view'],
        'accounts' => ['view' => 'accounts.view', 'create' => 'accounts.create'],
    ];

    private int $t;
    private int $branch;
    private int $owner;
    /** @var array<string,array<int,int>> old id => new id, per entity */
    private array $map = [];
    private array $ledger = [];
    private array $count = [];
    private array $warn = [];
    private array $variantLabel = [];
    private array $variantMade = [];

    public function handle(TenantContext $ctx): int
    {
        config(['database.connections.legacy' => [
            'driver' => 'mysql', 'host' => env('LEGACY_DB_HOST', '127.0.0.1'), 'port' => env('LEGACY_DB_PORT', '3306'),
            'database' => env('LEGACY_DB_DATABASE', 'mobile'), 'username' => env('LEGACY_DB_USERNAME', 'root'), 'password' => env('LEGACY_DB_PASSWORD', ''),
            'charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci', 'prefix' => '',
        ]]);
        try {
            DB::connection('legacy')->getPdo();
        } catch (Throwable $e) {
            $this->error('Cannot connect to the old MySQL database. Check the LEGACY_DB_* values in .env. (' . $e->getMessage() . ')');
            return self::FAILURE;
        }

        $tenant = DB::table('tenants')->where('slug', strtolower((string) $this->argument('tenant')))->whereNull('deleted_at')->first();
        if (! $tenant) {
            $this->error('No shop with that code. Register the shop in the app first.');
            return self::FAILURE;
        }
        $this->t = (int) $tenant->id;
        $ctx->set($this->t);

        try {
            $this->branch = (int) Branch::where('is_main', true)->value('id') ?: throw new RuntimeException('The shop has no main branch.');
            $this->owner = (int) DB::table('users')->where('tenant_id', $this->t)->where('role', 'owner')->value('id') ?: throw new RuntimeException('The shop has no owner.');
            if (DB::table('purchases')->where('tenant_id', $this->t)->exists() || DB::table('sales')->where('tenant_id', $this->t)->exists()) {
                $this->error('This shop already has purchases or sales. Import into a fresh shop.');
                return self::FAILURE;
            }
            if ($issues = $this->preflight()) {
                foreach ($issues as $i) { $this->line(" - {$i}"); }
                $this->error('Fix the problems above in the old database, then run again. Nothing was imported.');
                return self::FAILURE;
            }

            DB::beginTransaction();
            $this->import();
            $this->flushLedger();
            $mismatch = $this->reconcile();

            $this->table(['Imported', 'Count'], collect($this->count)->map(fn ($c, $k) => [$k, $c])->values()->all());
            foreach (array_slice($this->warn, 0, 40) as $w) { $this->warn("  ! {$w}"); }
            count($this->warn) > 40 && $this->warn('  ... and ' . (count($this->warn) - 40) . ' more warnings');
            if ($this->option('dry-run')) {
                DB::rollBack();
                $this->info('DRY RUN: nothing was saved.');
            } else {
                DB::commit();
                $this->info('Import finished and saved.' . ($mismatch ? " {$mismatch} balance difference(s): review them above." : ''));
            }
            return self::SUCCESS;
        } catch (Throwable $e) {
            DB::transactionLevel() > 0 && DB::rollBack();
            $this->error('Import failed and was rolled back: ' . $e->getMessage());
            return self::FAILURE;
        } finally {
            $ctx->clear();
        }
    }

    // ---------------------------------------------------------------- checks
    private function preflight(): array
    {
        $issues = [];
        foreach (['brands', 'models', 'suppliers', 'customers', 'purchases', 'purchase_items', 'sales', 'sale_items', 'vouchers', 'ledger_entries', 'users'] as $tbl) {
            Schema::connection('legacy')->hasTable($tbl) || $issues[] = "Table `{$tbl}` was not found in the old database.";
        }
        if ($issues) { return $issues; }

        $items = fn () => $this->old('purchase_items as i')->join('purchases as p', 'p.id', '=', 'i.purchase_id')->where('p.status', 'confirmed');
        foreach ($items()->where('i.status', 'in_stock')->groupBy('i.imei')->havingRaw('count(*) > 1')->pluck('i.imei') as $imei) { $issues[] = "IMEI {$imei} is in stock twice."; }
        foreach ($items()->whereRaw("(char_length(i.imei) > 15 or i.imei = '')")->pluck('i.imei') as $imei) { $issues[] = "IMEI '{$imei}' is empty or longer than 15 characters."; }
        $items()->whereRaw('coalesce(i.model_id, 0) = 0 and coalesce(i.mobile_id, 0) = 0')->count() && $issues[] = 'Some purchase items have neither a model nor a mobile.';
        $this->old('purchases as p')->leftJoin('suppliers as s', 's.id', '=', 'p.supplier_id')->where('p.status', 'confirmed')->whereNull('s.id')->count() && $issues[] = 'Some purchases point to a supplier that does not exist.';
        return array_slice($issues, 0, 25);
    }

    // ---------------------------------------------------------------- import
    private function import(): void
    {
        $this->importCatalog();
        $this->importParties();
        $this->importUsers();
        $this->importPurchases();
        $this->importSales();
        $this->importVouchers();
        $this->importMisc();
    }

    private function importCatalog(): void
    {
        foreach ($this->old('brands')->orderBy('id')->get() as $b) {
            $this->map['brand'][$b->id] = $this->byName('brands', [], trim($b->name));
            $this->bump('brands');
        }
        $mobiles = $this->old('mobiles')->orderBy('id')->get()->groupBy('model_id');
        foreach ($this->old('models')->orderBy('id')->get() as $m) {
            $brand = $this->map['brand'][$m->brand_id] ?? null;
            if (! $brand) { $this->warn[] = "Model {$m->name}: brand missing, skipped."; continue; }
            $first = $mobiles->get($m->id)?->first(); // old brand > model > mobile collapses into one model
            $id = $this->byName('device_models', ['brand_id' => $brand], trim($first->name ?? $m->name));
            $this->map['model'][$m->id] = $id;
            foreach ($mobiles->get($m->id, []) as $mob) { $this->map['mobile'][$mob->id] = $id; }
            $this->bump('models');
        }
        foreach ($this->old('colors')->get() as $c) { $this->map['color'][$c->id] = $this->byName('colors', [], trim($c->name)); $this->bump('colors'); }
        foreach ($this->old('variants')->get() as $v) { $this->variantLabel[$v->id] = trim($v->label ?: "{$v->ram} / {$v->storage}"); }
    }

    private function importParties(): void
    {
        foreach ($this->old('suppliers')->orderBy('id')->get() as $s) {
            $id = $this->map['supplier'][$s->id] = $this->byName('suppliers', [], trim($s->name), ['phone' => $s->phone ?: null, 'address' => $s->address ?: null]);
            $this->opening('supplier', $id, $s->balance_type === 'credit' ? 'credit' : 'debit', $s->opening_balance, $s->created_at);
            $this->bump('suppliers');
        }
        foreach ($this->old('customers')->orderBy('id')->get() as $c) {
            if ($c->type !== 'permanent') { continue; } // walk-in customers have no ledger
            $id = DB::table('customers')->insertGetId(['tenant_id' => $this->t, 'name' => trim($c->name), 'phone' => $c->phone ?: null, 'address' => $c->address ?: null, 'created_at' => $c->created_at ?? now(), 'updated_at' => now()]);
            $this->map['customer'][$c->id] = $id;
            $this->opening('customer', $id, $c->balance_type === 'debit' ? 'debit' : 'credit', $c->opening_balance, $c->created_at);
            $this->bump('customers');
        }
    }

    private function importUsers(): void
    {
        $slug = $this->old('modules')->pluck('slug', 'id');
        $perms = [];
        foreach ($this->old('permissions')->get() as $p) {
            foreach (self::PERM[$slug[$p->module_id] ?? ''] ?? [] as $action => $new) {
                ($action === 'view' ? $p->can_view : $p->can_create) && $perms[$p->user_id][] = $new;
            }
        }
        foreach ($this->old('users')->orderBy('id')->get() as $u) {
            if ($existing = DB::table('users')->where('tenant_id', $this->t)->where('username', $u->username)->value('id')) {
                $this->map['user'][$u->id] = (int) $existing;
                $this->warn[] = "User {$u->username} already exists in the new shop: kept the new one.";
                continue;
            }
            $admin = in_array((int) $u->role_id, [1, 2], true);
            $ok = str_starts_with((string) $u->password, '$2');
            $ok || $this->warn[] = "User {$u->username}: password could not be carried over, set a new one in Admin.";
            $id = DB::table('users')->insertGetId([
                'public_id' => (string) Str::ulid(), 'tenant_id' => $this->t, 'name' => $u->name, 'username' => $u->username, 'email' => $u->email ?: null,
                'password' => $ok ? $u->password : Hash::make(Str::random(40)), 'role' => $admin ? 'admin' : 'staff', 'is_active' => (bool) $u->is_active,
                'permissions' => json_encode($admin ? [] : array_values(array_unique($perms[$u->id] ?? []))), 'created_at' => $u->created_at ?? now(), 'updated_at' => now(),
            ]);
            $admin || DB::table('branch_user')->insert(['tenant_id' => $this->t, 'branch_id' => $this->branch, 'user_id' => $id]);
            $this->map['user'][$u->id] = $id;
            $this->bump('users');
        }
    }

    private function importPurchases(): void
    {
        foreach ($this->old('purchases')->orderBy('id')->get() as $p) {
            if ($p->status !== 'confirmed') { $this->count['purchases skipped (draft/cancelled)'] = ($this->count['purchases skipped (draft/cancelled)'] ?? 0) + 1; continue; }
            $supplier = $this->map['supplier'][$p->supplier_id];
            $id = DB::table('purchases')->insertGetId([
                'tenant_id' => $this->t, 'branch_id' => $this->branch, 'supplier_id' => $supplier, 'invoice_no' => $p->entry_no, 'purchase_date' => $p->date,
                'total_minor' => $this->minor($p->total_amount), 'paid_minor' => 0, 'note' => $p->notes ?: null, 'created_by' => $this->user($p->created_by),
                'created_at' => $p->created_at ?? now(), 'updated_at' => now(),
            ]);
            $this->map['purchase'][$p->id] = $id;
            $this->post('supplier', $supplier, 'credit', $this->minor($p->total_amount), 'purchase', $id, "Purchase {$p->entry_no}", $p->date, $this->user($p->created_by));
            $this->bump('purchases');
        }

        $rows = $this->old('purchase_items as i')->join('purchases as p', 'p.id', '=', 'i.purchase_id')->where('p.status', 'confirmed')->select('i.*')->orderBy('i.id')->get();
        foreach ($rows as $i) {
            $model = $this->map['mobile'][$i->mobile_id] ?? $this->map['model'][$i->model_id] ?? null;
            if (! $model) { $this->warn[] = "IMEI {$i->imei}: model not found, skipped."; continue; }
            $this->map['stock'][$i->id] = DB::table('stock_items')->insertGetId([
                'tenant_id' => $this->t, 'branch_id' => $this->branch, 'purchase_id' => $this->map['purchase'][$i->purchase_id], 'device_model_id' => $model,
                'variant_id' => $this->variant($model, (int) $i->variant_id), 'color_id' => $this->map['color'][$i->color_id] ?? null, 'imei' => $i->imei,
                'cost_minor' => $this->minor($i->cost_price), 'status' => match ($i->status) { 'sold' => 'sold', 'returned' => 'returned_to_supplier', default => 'in_stock' },
                'created_at' => $i->created_at ?? now(), 'updated_at' => now(),
            ]);
            $this->bump('phones');
        }

        // old system stored one row per returned phone; group them into one return per return_no
        foreach ($this->old('purchase_returns')->orderBy('id')->get()->groupBy('return_no') as $no => $lines) {
            $lines = $lines->filter(fn ($l) => isset($this->map['purchase'][$l->purchase_id], $this->map['stock'][$l->purchase_item_id]));
            if ($lines->isEmpty()) { $this->warn[] = "Purchase return {$no}: its purchase or phone was not imported, skipped."; continue; }
            $first = $lines->first();
            $total = $lines->sum(fn ($l) => $this->minor($l->return_amount));
            $supplier = DB::table('purchases')->where('id', $this->map['purchase'][$first->purchase_id])->value('supplier_id');
            $id = DB::table('purchase_returns')->insertGetId(['tenant_id' => $this->t, 'branch_id' => $this->branch, 'purchase_id' => $this->map['purchase'][$first->purchase_id], 'return_no' => $no,
                'total_minor' => $total, 'reason' => Str::limit((string) ($first->reason ?: 'Imported'), 200, ''), 'return_date' => $first->return_date, 'created_by' => $this->user($first->returned_by),
                'created_at' => $first->created_at ?? now(), 'updated_at' => now()]);
            DB::table('purchase_return_items')->insert($lines->unique('purchase_item_id')->map(fn ($l) => ['tenant_id' => $this->t, 'purchase_return_id' => $id,
                'stock_item_id' => $this->map['stock'][$l->purchase_item_id], 'amount_minor' => $this->minor($l->return_amount)])->values()->all());
            $this->post('supplier', (int) $supplier, 'debit', $total, 'purchase_return', $id, "Purchase return {$no}", $first->return_date, $this->user($first->returned_by));
            $this->bump('purchase returns');
        }
    }

    private function importSales(): void
    {
        foreach ($this->old('sales')->orderBy('id')->get() as $s) {
            if ($s->status !== 'confirmed') { $this->count['sales skipped (draft/cancelled)'] = ($this->count['sales skipped (draft/cancelled)'] ?? 0) + 1; continue; }
            $customer = $this->map['customer'][$s->customer_id] ?? null; // null = walk-in
            $total = $this->minor($s->total_amount);
            $note = trim(($customer ? '' : trim("{$s->customer_name} {$s->customer_phone}") . ' ') . (string) $s->notes);
            $id = DB::table('sales')->insertGetId([
                'tenant_id' => $this->t, 'branch_id' => $this->branch, 'customer_id' => $customer, 'invoice_no' => $s->invoice_no, 'sale_date' => $s->date,
                'total_minor' => $total, 'received_minor' => $customer ? 0 : $total, 'note' => $note ?: null, 'created_by' => $this->user($s->created_by),
                'created_at' => $s->created_at ?? now(), 'updated_at' => now(),
            ]);
            $this->map['sale'][$s->id] = $id;
            $customer && $this->post('customer', $customer, 'debit', $total, 'sale', $id, "Sale {$s->invoice_no}", $s->date, $this->user($s->created_by));
            $this->bump('sales');
        }

        foreach ($this->old('sale_items')->orderBy('id')->get() as $i) {
            $sale = $this->map['sale'][$i->sale_id] ?? null;
            $stock = $this->map['stock'][$i->purchase_item_id] ?? null;
            if (! $sale) { continue; }
            if (! $stock) { $this->warn[] = "Sale line {$i->imei}: its purchase item was not imported, skipped."; continue; }
            $this->map['sale_item'][$i->id] = DB::table('sale_items')->insertGetId(['tenant_id' => $this->t, 'sale_id' => $sale, 'stock_item_id' => $stock,
                'price_minor' => $this->minor($i->sale_price), 'cost_minor' => $this->minor($i->cost_price), 'created_at' => $i->created_at ?? now(), 'updated_at' => now()]);
            $this->bump('sale lines');
        }

        foreach ($this->old('sale_returns')->orderBy('id')->get() as $r) {
            $sale = $this->map['sale'][$r->sale_id] ?? null;
            if (! $sale) { $this->warn[] = "Sale return {$r->return_no}: its sale was not imported, skipped."; continue; }
            $lines = $this->old('sale_return_items')->where('return_id', $r->id)->get()->filter(fn ($l) => isset($this->map['sale_item'][$l->sale_item_id], $this->map['stock'][$l->purchase_item_id]));
            if ($lines->isEmpty()) { $this->warn[] = "Sale return {$r->return_no}: no importable lines, skipped."; continue; }
            $total = $lines->sum(fn ($l) => $this->minor($l->sale_price));
            $id = DB::table('sale_returns')->insertGetId(['tenant_id' => $this->t, 'branch_id' => $this->branch, 'sale_id' => $sale, 'return_no' => $r->return_no, 'total_minor' => $total,
                'reason' => Str::limit((string) ($r->notes ?: 'Imported'), 200, ''), 'return_date' => $r->date, 'created_by' => $this->user($r->created_by), 'created_at' => $r->created_at ?? now(), 'updated_at' => now()]);
            DB::table('sale_return_items')->insert($lines->unique('sale_item_id')->map(fn ($l) => ['tenant_id' => $this->t, 'sale_return_id' => $id, 'sale_item_id' => $this->map['sale_item'][$l->sale_item_id],
                'stock_item_id' => $this->map['stock'][$l->purchase_item_id], 'amount_minor' => $this->minor($l->sale_price)])->values()->all());
            $customer = DB::table('sales')->where('id', $sale)->value('customer_id');
            $customer && $this->post('customer', (int) $customer, 'credit', $total, 'sale_return', $id, "Sale return {$r->return_no}", $r->date, $this->user($r->created_by));
            $this->bump('sale returns');
        }
    }

    private function importVouchers(): void
    {
        foreach ($this->old('vouchers')->orderBy('date')->orderBy('id')->get() as $v) {
            $party = $this->map[$v->party_type][$v->party_id] ?? null;
            $amount = $this->minor($v->amount);
            if (! $party || $amount <= 0) { $this->warn[] = "Voucher {$v->voucher_no}: party not imported or zero amount, skipped."; continue; }
            $receipt = $v->direction === 'receiving';
            $id = DB::table('vouchers')->insertGetId(['tenant_id' => $this->t, 'branch_id' => $this->branch, 'voucher_no' => $v->voucher_no, 'party_type' => $v->party_type, 'party_id' => $party,
                'direction' => $receipt ? 'receipt' : 'payment', 'method' => in_array($v->type, ['cash', 'bank', 'cheque'], true) ? $v->type : 'cash', 'amount_minor' => $amount,
                'bill_ref' => $v->bill_ref ? Str::limit($v->bill_ref, 60, '') : null, 'notes' => $v->notes ? Str::limit($v->notes, 300, '') : null, 'voucher_date' => $v->date,
                'created_by' => $this->user($v->created_by), 'created_at' => $v->created_at ?? now(), 'updated_at' => now()]);
            $this->post($v->party_type, $party, $receipt ? 'credit' : 'debit', $amount, 'voucher', $id, ($receipt ? 'Receipt ' : 'Payment ') . $v->voucher_no, $v->date, $this->user($v->created_by));
            $this->bump('vouchers');
        }
    }

    private function importMisc(): void
    {
        foreach ($this->old('expense_heads')->get() as $h) { $this->byName('expense_heads', [], trim($h->name)); $this->bump('expense heads'); }
        $this->warn[] = 'Expense transactions were not imported (the old system kept them inside the ledger). Expense head names were imported.';

        if (Schema::connection('legacy')->hasTable('tac_mapping')) {
            foreach ($this->old('tac_mapping')->get() as $m) {
                $model = $this->map['mobile'][$m->mobile_id] ?? $this->map['model'][$m->model_id] ?? null;
                if (! $model || DB::table('tac_mappings')->where('tenant_id', $this->t)->where('tac', $m->tac)->exists()) { continue; }
                DB::table('tac_mappings')->insert(['tenant_id' => $this->t, 'tac' => $m->tac, 'device_model_id' => $model, 'created_at' => now(), 'updated_at' => now()]);
                $this->bump('TAC mappings');
            }
        }
        if (Schema::connection('legacy')->hasTable('settings')) {
            $s = $this->old('settings')->pluck('value', 'key');
            $cur = json_decode((string) DB::table('tenants')->where('id', $this->t)->value('settings'), true) ?: [];
            DB::table('tenants')->where('id', $this->t)->update(['settings' => json_encode($cur + array_filter(['phone' => $s['shop_phone'] ?? null, 'address' => $s['shop_address'] ?? null])), 'updated_at' => now()]);
        }
    }

    // ---------------------------------------------------------------- ledger + reconciliation
    private function opening(string $party, int $id, string $side, mixed $amount, ?string $created): void
    {
        $this->post($party, $id, $side, $this->minor($amount), 'opening', $id, 'Opening balance', substr((string) ($created ?? now()), 0, 10), $this->owner);
    }

    private function post(string $party, int $partyId, string $side, int $minor, string $ref, int $refId, string $desc, string $date, int $user): void
    {
        $minor > 0 && $this->ledger[] = ['seq' => count($this->ledger), 'tenant_id' => $this->t, 'branch_id' => $this->branch, 'party_type' => $party, 'party_id' => $partyId,
            'entry_date' => $date, 'ref_type' => $ref, 'ref_id' => $refId, 'description' => $desc, 'debit_minor' => $side === 'debit' ? $minor : 0,
            'credit_minor' => $side === 'credit' ? $minor : 0, 'created_by' => $user];
    }

    private function flushLedger(): void
    {
        usort($this->ledger, fn ($a, $b) => [$a['entry_date'], $a['seq']] <=> [$b['entry_date'], $b['seq']]); // chronological, so ids follow dates
        foreach (array_chunk($this->ledger, 500) as $chunk) {
            DB::table('ledger_entries')->insert(array_map(fn ($r) => array_diff_key($r, ['seq' => 1]), $chunk));
        }
        $this->count['ledger entries'] = count($this->ledger);
    }

    /** Compare rebuilt balances with the last balance in the old ledger. Returns the number of differences. */
    private function reconcile(): int
    {
        $ok = 0;
        $bad = [];
        foreach (['supplier' => ['suppliers', 'credit_minor - debit_minor'], 'customer' => ['customers', 'debit_minor - credit_minor']] as $type => [$table, $expr]) {
            foreach ($this->old($table)->get() as $p) {
                $new = $this->map[$type][$p->id] ?? null;
                if (! $new) { continue; }
                $old = $this->minor($this->old('ledger_entries')->where('party_type', $type)->where('party_id', $p->id)->orderByDesc('date')->orderByDesc('id')->value('balance') ?? 0);
                $now = (int) DB::table('ledger_entries')->where('tenant_id', $this->t)->where('party_type', $type)->where('party_id', $new)->selectRaw("coalesce(sum({$expr}), 0) as b")->value('b');
                $old === $now ? $ok++ : $bad[] = [$type, $p->name, number_format($old / 100, 2), number_format($now / 100, 2)];
            }
        }
        $this->info("Balance check: {$ok} match the old ledger, " . count($bad) . ' differ.');
        $bad && $this->table(['Type', 'Name', 'Old balance', 'New balance'], array_slice($bad, 0, 25));
        $bad && $this->warn('  Differences usually come from old ledger rows that were mis-labelled or from cancelled/draft documents; the NEW balance follows the documents.');
        return count($bad);
    }

    // ---------------------------------------------------------------- helpers
    private function old(string $table): Builder
    {
        return DB::connection('legacy')->table($table);
    }

    private function minor(mixed $v): int
    {
        return (int) round(((float) $v) * 100);
    }

    private function user(mixed $oldId): int
    {
        return $this->map['user'][$oldId] ?? $this->owner;
    }

    private function bump(string $what): void
    {
        $this->count[$what] = ($this->count[$what] ?? 0) + 1;
    }

    /** Find a row by (scope, case-insensitive name) or create it, so duplicates in the old data merge. */
    private function byName(string $table, array $scope, string $name, array $extra = []): int
    {
        $q = DB::table($table)->where('tenant_id', $this->t)->whereRaw('lower(name) = ?', [mb_strtolower($name)]);
        foreach ($scope as $k => $v) { $q->where($k, $v); }
        return (int) ($q->value('id') ?? DB::table($table)->insertGetId(['tenant_id' => $this->t, 'name' => $name, 'created_at' => now(), 'updated_at' => now()] + $scope + $extra));
    }

    /** Old variants were global; the new ones belong to a model, so create them on first use. */
    private function variant(int $model, int $oldId): ?int
    {
        $label = $this->variantLabel[$oldId] ?? null;
        return $label ? ($this->variantMade["{$model}:{$oldId}"] ??= $this->byName('variants', ['device_model_id' => $model], $label)) : null;
    }
}
