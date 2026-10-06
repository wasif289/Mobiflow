<?php
declare(strict_types=1);

namespace App\Modules\Platform\Presentation;

use App\Modules\Platform\Infrastructure\SuperAdmin;
use App\Shared\Exceptions\AppException;
use Closure;
use Illuminate\Http\Request;

final class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $request->user() instanceof SuperAdmin || throw new AppException(403, 'FORBIDDEN', 'Platform administrators only.');
        return $next($request);
    }
}
