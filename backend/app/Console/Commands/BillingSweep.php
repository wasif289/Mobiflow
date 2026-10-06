<?php
declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/** Daily lifecycle: trial/active -> past_due (grace, still works) -> suspended (read-only). Scheduled in routes/console.php. */
final class BillingSweep extends Command
{
    protected $signature = 'billing:sweep';
    protected $description = 'Move shops through trial, past due and suspended based on their dates';

    public function handle(): int
    {
        $now = now();
        $grace = $now->copy()->subDays((int) config('billing.grace_days', 3));
        $t = fn () => DB::table('tenants')->whereNull('deleted_at');

        $a = $t()->where('status', 'trial')->where('trial_ends_at', '<', $now)->update(['status' => 'past_due', 'updated_at' => $now]);
        $b = $t()->where('status', 'active')->where('current_period_ends_at', '<', $now)->update(['status' => 'past_due', 'updated_at' => $now]);
        $c = $t()->where('status', 'past_due')->whereRaw('coalesce(current_period_ends_at, trial_ends_at) < ?', [$grace])->update(['status' => 'suspended', 'updated_at' => $now]);

        $this->info("past_due: " . ($a + $b) . ", suspended: {$c}");
        return self::SUCCESS;
    }
}
