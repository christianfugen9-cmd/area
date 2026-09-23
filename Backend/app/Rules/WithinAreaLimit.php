<?php

declare(strict_types=1);

namespace App\Rules;

use App\Models\Area;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Fails when the areas table is already at App\Models\Area::MAX_AREAS.
 *
 * Attached to the `name` field of StoreAreaRequest so the client receives a
 * normal 422 validation payload rather than an exception.
 */
class WithinAreaLimit implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (Area::hasCapacity()) {
            return;
        }

        $fail(sprintf(
            'The system limit of %d areas has been reached. Delete an existing area before creating a new one.',
            Area::MAX_AREAS
        ));
    }
}