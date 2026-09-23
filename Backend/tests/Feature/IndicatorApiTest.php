<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Area;
use App\Models\Indicator;
use App\Models\Parameter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IndicatorApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_stores_a_custom_indicator_under_a_parameter(): void
    {
        $parameter = Parameter::factory()->create();

        $this->postJson("/api/parameters/{$parameter->id}/indicators", [
            'section_type' => 'SYSTEM_INPUTS',
            'code' => 'S.1',
            'description' => 'Vision, mission, and goals are disseminated.',
            'item_rating' => 4.5,
        ])
            ->assertCreated()
            ->assertJsonPath('data.is_custom', true)
            ->assertJsonPath('data.code', 'S.1')
            ->assertJsonPath('data.section_type', 'SYSTEM_INPUTS')
            ->assertJsonPath('data.item_rating', 4.5);

        $this->assertDatabaseHas('indicators', [
            'parameter_id' => $parameter->id,
            'code' => 'S.1',
            'is_custom' => true,
        ]);
    }

    public function test_it_updates_and_deletes_an_indicator(): void
    {
        $indicator = Indicator::factory()->create([
            'code' => '1.1',
            'item_rating' => 3.0,
        ]);

        $this->patchJson("/api/indicators/{$indicator->id}", [
            'item_rating' => 4.25,
            'description' => 'Updated description',
        ])
            ->assertOk()
            ->assertJsonPath('data.item_rating', 4.25)
            ->assertJsonPath('data.description', 'Updated description');

        $this->deleteJson("/api/indicators/{$indicator->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('indicators', ['id' => $indicator->id]);
    }

    public function test_parameter_resource_exposes_siom_and_parameter_mean(): void
    {
        $parameter = Parameter::factory()->create(['parameter_letter' => 'A']);

        Indicator::factory()->for($parameter)->systemInputs()->create(['item_rating' => 4.0]);
        Indicator::factory()->for($parameter)->outcome()->create(['item_rating' => 5.0]);
        Indicator::factory()->for($parameter)->implementation()->create(['item_rating' => 3.0]);
        Indicator::factory()->for($parameter)->systemInputs()->create(['item_rating' => null]);

        $this->getJson("/api/parameters/{$parameter->id}")
            ->assertOk()
            ->assertJsonPath('data.parameter_letter', 'A')
            // SIOM = avg(4.0, 5.0) = 4.5  (implementation excluded)
            ->assertJsonPath('data.siom', 4.5)
            // Parameter mean = avg(4.0, 5.0, 3.0) = 4.0
            ->assertJsonPath('data.parameter_mean', 4)
            ->assertJsonStructure(['data' => ['indicators' => [['id', 'section_type', 'code']]]]);
    }

    public function test_it_rejects_invalid_section_type_and_rating(): void
    {
        $parameter = Parameter::factory()->for(Area::factory())->create();

        $this->postJson("/api/parameters/{$parameter->id}/indicators", [
            'section_type' => 'INVALID',
            'code' => 'X.1',
            'description' => 'Bad section',
            'item_rating' => 6,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['section_type', 'item_rating']);
    }
}
