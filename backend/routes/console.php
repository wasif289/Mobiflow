<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\{Artisan, Schedule};

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Shop subscription lifecycle (trial -> past due -> suspended). Needs `php artisan schedule:run` every minute in cron.
Schedule::command('billing:sweep')->dailyAt('02:00');
