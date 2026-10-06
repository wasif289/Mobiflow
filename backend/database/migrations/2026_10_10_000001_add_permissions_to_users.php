<?php
declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE users ADD COLUMN permissions jsonb NOT NULL DEFAULT '[]'");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE users DROP COLUMN permissions');
    }
};
