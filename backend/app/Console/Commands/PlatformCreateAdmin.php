<?php
declare(strict_types=1);

namespace App\Console\Commands;

use App\Modules\Platform\Infrastructure\SuperAdmin;
use Illuminate\Console\Command;

/** php artisan platform:create-admin you@example.com --name="Your Name"  (asks for the password, never stored in shell history) */
final class PlatformCreateAdmin extends Command
{
    protected $signature = 'platform:create-admin {email} {--name=Platform Admin}';
    protected $description = 'Create a super admin who can manage all shops';

    public function handle(): int
    {
        $email = strtolower((string) $this->argument('email'));
        if (SuperAdmin::where('email', $email)->exists()) {
            $this->error('That email already exists.');
            return self::FAILURE;
        }
        $password = (string) $this->secret('Password (min 10 characters)');
        if (strlen($password) < 10) {
            $this->error('Password is too short.');
            return self::FAILURE;
        }
        SuperAdmin::create(['name' => $this->option('name'), 'email' => $email, 'password' => $password]);
        $this->info("Super admin {$email} created.");
        return self::SUCCESS;
    }
}
