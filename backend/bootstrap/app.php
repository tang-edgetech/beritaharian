<?php

use App\Exceptions\FriendlyException;
use App\Http\Middleware\EnsureTwoFactorWhenRequired;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Exceptions\MissingAbilityException;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Spatie\Permission\Exceptions\UnauthorizedException as PermissionDenied;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** One JSON shape for every API error: { message, code } (+ errors for forms). Messages are for people, not developers. */
$friendly = fn (string $message, string $code, int $status, array $extra = []) => response()->json(
    ['message' => $message, 'code' => $code] + $extra,
    $status,
);

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'abilities' => CheckAbilities::class,
            'permission' => PermissionMiddleware::class,
            'role' => RoleMiddleware::class,
            'two-factor.enforced' => EnsureTwoFactorWhenRequired::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) use ($friendly): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->dontReport([FriendlyException::class]);

        $exceptions->render(function (Throwable $e, Request $request) use ($friendly) {
            if (! $request->is('api/*')) {
                return null;
            }

            // Laravel wraps some exceptions (e.g. a missing token ability becomes a plain 403); look at the original.
            if ($e->getPrevious() instanceof MissingAbilityException) {
                $e = $e->getPrevious();
            }

            return match (true) {
                $e instanceof FriendlyException => $friendly($e->getMessage(), $e->errorCode, $e->status),
                $e instanceof ValidationException => $friendly('Please check the highlighted fields.', 'VALIDATION_FAILED', 422, ['errors' => $e->errors()]),
                $e instanceof AuthenticationException => $friendly('Please sign in to continue.', 'UNAUTHENTICATED', 401),
                $e instanceof MissingAbilityException => $friendly('Please finish signing in first.', 'SIGN_IN_INCOMPLETE', 403),
                $e instanceof PermissionDenied,
                $e instanceof AuthorizationException,
                $e instanceof AccessDeniedHttpException => $friendly("You don't have permission to do that.", 'FORBIDDEN', 403),
                $e instanceof ModelNotFoundException,
                $e instanceof NotFoundHttpException => $friendly("We couldn't find that. It may have been removed.", 'NOT_FOUND', 404),
                $e instanceof ThrottleRequestsException => $friendly("You're going a bit fast. Please wait a moment and try again.", 'TOO_MANY_REQUESTS', 429),
                $e instanceof HttpExceptionInterface && $e->getStatusCode() < 500 => $friendly('That request could not be completed.', 'REQUEST_FAILED', $e->getStatusCode()),
                default => $friendly(
                    'Something went wrong on our side. Please try again in a moment.',
                    'SERVER_ERROR',
                    500,
                    config('app.debug') ? ['debug' => $e->getMessage()] : [],
                ),
            };
        });
    })->create();
