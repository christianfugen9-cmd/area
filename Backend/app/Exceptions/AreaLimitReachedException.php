<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Models\Area;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Thrown by Area::creating() when the global ceiling is hit outside the
 * HTTP validation layer (seeders, jobs, console commands).
 */
class AreaLimitReachedException extends RuntimeException
{
    public function __construct(string $message = '')
    {
        parent::__construct(
            $message !== '' ? $message : sprintf(
                'Cannot create another area: the system limit of %d areas has been reached.',
                Area::MAX_AREAS
            )
        );
    }

    /**
     * Renders as a 422 that mirrors Laravel's own validation error shape,
     * so API clients only ever have to parse one error format.
     */
    public function render(Request $request): ?JsonResponse
    {
        if (! $request->expectsJson()) {
            return null;
        }

        return response()->json([
            'message' => $this->getMessage(),
            'errors' => [
                'name' => [$this->getMessage()],
            ],
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}