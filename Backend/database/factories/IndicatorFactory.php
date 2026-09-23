<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Indicator;
use App\Models\Parameter;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Indicator> */
class IndicatorFactory extends Factory
{
    protected $model = Indicator::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'parameter_id' => Parameter::factory(),
            'section_type' => $this->faker->randomElement(Indicator::SECTION_TYPES),
            'code' => $this->faker->unique()->bothify('?.#'),
            'description' => $this->faker->sentence(12),
            'item_rating' => $this->faker->optional()->randomFloat(2, 0, 5),
            'is_custom' => false,
        ];
    }

    public function custom(): static
    {
        return $this->state(fn (): array => ['is_custom' => true]);
    }

    public function systemInputs(): static
    {
        return $this->state(fn (): array => ['section_type' => Indicator::SECTION_SYSTEM_INPUTS]);
    }

    public function implementation(): static
    {
        return $this->state(fn (): array => ['section_type' => Indicator::SECTION_IMPLEMENTATION]);
    }

    public function outcome(): static
    {
        return $this->state(fn (): array => ['section_type' => Indicator::SECTION_OUTCOME]);
    }
}
