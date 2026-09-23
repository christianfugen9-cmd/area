<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Area;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Area> */
class AreaFactory extends Factory
{
    protected $model = Area::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => ucfirst($this->faker->unique()->words(2, true)),
            'description' => $this->faker->optional()->sentence(12),
        ];
    }
}