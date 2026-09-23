<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Area;
use App\Models\File;
use App\Models\Parameter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AreaApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_areas_with_nested_parameters_and_files(): void
    {
        $area = Area::factory()->has(Parameter::factory()->count(2), 'parameters')->create();

        $this->getJson('/api/areas')
            ->assertOk()
            ->assertJsonPath('data.0.id', $area->id)
            ->assertJsonPath('data.0.parameters_count', 2)
            ->assertJsonPath('meta.max_areas', Area::MAX_AREAS)
            ->assertJsonStructure(['data' => [['id', 'name', 'parameters' => [['id', 'name', 'files']], 'files']]]);
    }

    public function test_it_searches_across_areas_parameters_and_file_names(): void
    {
        $match = Area::factory()->create(['name' => 'Hydraulics']);
        Area::factory()->create(['name' => 'Electrical']);

        $withParameter = Area::factory()->create(['name' => 'Chassis']);
        Parameter::factory()->for($withParameter)->create(['name' => 'Hydraulics pressure']);

        $withFile = Area::factory()->create(['name' => 'Cabin']);
        File::factory()->forAttachable($withFile)->create(['file_name' => 'hydraulics-report.pdf']);

        $response = $this->getJson('/api/areas?search=hydraulics')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertEqualsCanonicalizing(
            [$match->id, $withParameter->id, $withFile->id],
            $ids
        );
    }

    public function test_it_sorts_by_whitelisted_columns_and_ignores_unknown_ones(): void
    {
        Area::factory()->create(['name' => 'Zulu']);
        Area::factory()->create(['name' => 'Alpha']);

        $this->getJson('/api/areas?sort_by=name&direction=asc')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Alpha');

        // Unknown column is rejected by the Form Request rather than executed.
        $this->getJson('/api/areas?sort_by=name;DROP TABLE areas')
            ->assertStatus(422)
            ->assertJsonValidationErrors('sort_by');
    }

    public function test_it_rejects_the_eleventh_area(): void
    {
        Area::factory()->count(Area::MAX_AREAS)->create();

        $this->postJson('/api/areas', ['name' => 'One too many'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');

        $this->assertDatabaseCount('areas', Area::MAX_AREAS);
    }

    public function test_the_model_guards_the_limit_outside_http(): void
    {
        Area::factory()->count(Area::MAX_AREAS)->create();

        $this->expectException(\App\Exceptions\AreaLimitReachedException::class);

        Area::create(['name' => 'Bypassing validation']);
    }

    public function test_it_attaches_files_polymorphically(): void
    {
        Storage::fake('public');

        $parameter = Parameter::factory()->create();

        $response = $this->postJson('/api/attachments', [
            'attachable_type' => 'parameter',
            'attachable_id' => $parameter->id,
            'files' => [UploadedFile::fake()->image('diagram.png')],
        ])->assertCreated();

        $path = $response->json('data.0.file_path');

        Storage::disk('public')->assertExists($path);
        $this->assertDatabaseHas('files', [
            'attachable_type' => 'parameter',
            'attachable_id' => $parameter->id,
            'file_name' => 'diagram.png',
        ]);
    }

    public function test_it_rejects_disallowed_mime_types(): void
    {
        Storage::fake('public');

        $area = Area::factory()->create();

        $this->postJson('/api/attachments', [
            'attachable_type' => 'area',
            'attachable_id' => $area->id,
            'files' => [UploadedFile::fake()->create('payload.php', 10, 'application/x-php')],
        ])->assertStatus(422)->assertJsonValidationErrors('files.0');
    }

    public function test_deleting_an_area_removes_parameters_attachments_and_blobs(): void
    {
        Storage::fake('public');

        $area = Area::factory()->create();
        $parameter = Parameter::factory()->for($area)->create();

        $this->postJson('/api/attachments', [
            'attachable_type' => 'area',
            'attachable_id' => $area->id,
            'files' => [UploadedFile::fake()->image('area.png')],
        ])->assertCreated();

        $this->postJson('/api/attachments', [
            'attachable_type' => 'parameter',
            'attachable_id' => $parameter->id,
            'files' => [UploadedFile::fake()->image('parameter.png')],
        ])->assertCreated();

        $paths = File::pluck('file_path')->all();

        $this->deleteJson("/api/areas/{$area->id}")->assertNoContent();

        $this->assertDatabaseCount('areas', 0);
        $this->assertDatabaseCount('parameters', 0);
        $this->assertDatabaseCount('files', 0);

        foreach ($paths as $path) {
            Storage::disk('public')->assertMissing($path);
        }
    }
}