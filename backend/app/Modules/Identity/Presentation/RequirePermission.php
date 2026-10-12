<?php
declare(strict_types=1);

namespace App\Modules\Identity\Presentation;

use App\Shared\Exceptions\AppException;
use Closure;
use Illuminate\Http\Request;

/** Route middleware: ->middleware(RequirePermission::class . ':sales.create'). Runs after auth. */
final class RequirePermission
{
    public function handle(Request $request, Closure $next, string $permission)
    {
        $request->user()?->allows($permission)
            || throw new AppException(403, 'FORBIDDEN', 'You do not have permission to do this.');

        return $next($request);
    }
}
