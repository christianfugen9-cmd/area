<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Area;
use App\Models\File;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<File> */
class FileFactory extends Factory
{
    protected $model = File::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $name = $this->faker->unique()->slug(2).'.pdf';

        return [
            'file_name' => $name,
            'file_path' => 'attachments/areas/'.now()->format('Y/m').'/'.$this->faker->uuid().'.pdf',
            'file_size' => $this->faker->numberBetween(1024, 5_000_000),
            'mime_type' => 'application/pdf',
            'attachable_type' => 'area',
            'attachable_id' => Area::factory(),
        ];
    }

    /**
     * Usage: File::factory()->for($parameter, 'attachable')->create();
     */
    public function forAttachable(\Illuminate\Database\Eloquent\Model $model): static
    {
        return $this->state(fn () => [
            'attachable_type' => $model->getMorphClass(),
            'attachable_id' => $model->getKey(),
        ]);
    }
}