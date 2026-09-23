<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Area;
use App\Models\Parameter;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Parameter> */
class ParameterFactory extends Factory
{
    protected $model = Parameter::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'area_id' => Area::factory(),
            'parameter_letter' => $this->faker->optional()->randomElement(['A', 'B', 'C', 'D', 'E']),
            'name' => ucfirst($this->faker->unique()->words(2, true)),
            'details' => $this->faker->optional()->paragraph(),
            'is_custom' => false,
        ];
    }

    public function custom(): static
    {
        return $this->state(fn (): array => ['is_custom' => true]);
    }
}