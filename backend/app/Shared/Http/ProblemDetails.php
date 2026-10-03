<?php
declare(strict_types=1);

namespace App\Shared\Http;

use App\Shared\Exceptions\AppException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\{QueryException, UniqueConstraintViolationException};
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/** RFC 9457 error responses. In bootstrap/app.php: ->withExceptions(ProblemDetails::register(...)) */
final class ProblemDetails
{
    public static function register(Exceptions $exceptions): void
    {
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            [$status, $code, $title, $errors] = match (true) {
                $e instanceof AppException => [$e->status, $e->errorCode, $e->getMessage(), $e->errors],
                $e instanceof ValidationException => [422, 'VALIDATION_FAILED', 'The given data was invalid.', $e->errors()],
                $e instanceof AuthenticationException => [401, 'UNAUTHENTICATED', 'Please sign in.', null],
                $e instanceof AuthorizationException => [403, 'FORBIDDEN', 'You do not have permission to do this.', null],
                $e instanceof UniqueConstraintViolationException => [409, 'DUPLICATE_ENTRY', 'This already exists.', null],
                $e instanceof QueryException && $e->getCode() === '23503' => [409, 'RESOURCE_IN_USE', 'This is used by other records, so it cannot be deleted.', null],
                $e instanceof ModelNotFoundException,
                $e instanceof NotFoundHttpException => [404, 'NOT_FOUND', 'The requested resource was not found.', null],
                $e instanceof HttpExceptionInterface => [$e->getStatusCode(), 'HTTP_ERROR', $e->getMessage() ?: 'Request failed.', null],
                default => [500, 'SERVER_ERROR', 'Something went wrong on our side.', null],
            };

            $trace = $request->header('X-Request-Id') ?: (string) Str::ulid();
            if ($status >= 500) {
                report($e); // full detail goes to logs/Sentry, never to the client
            }

            return response()->json(array_filter([
                'type' => "https://docs.mobiflow.app/errors/{$code}",
                'title' => $title,
                'status' => $status,
                'code' => $code,
                'errors' => $errors,
                'detail' => ($status >= 500 && config('app.debug')) ? $e->getMessage() : null,
                'trace_id' => $trace,
            ], fn ($v) => $v !== null), $status, [
                'Content-Type' => 'application/problem+json',
                'X-Trace-Id' => $trace,
            ]);
        });
    }
}
