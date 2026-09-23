<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Parameter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Parameter */
class ParameterResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'area_id' => $this->area_id,
            'parameter_letter' => $this->parameter_letter,
            'name' => $this->name,
            'details' => $this->details,
            'is_custom' => $this->is_custom,
            'siom' => $this->siom,
            'parameter_mean' => $this->parameter_mean,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),

            'files_count' => $this->whenCounted('files'),
            'indicators_count' => $this->whenCounted('indicators'),
            'indicators' => IndicatorResource::collection($this->whenLoaded('indicators')),
            'files' => FileResource::collection($this->whenLoaded('files')),
            'area' => new AreaResource($this->whenLoaded('area')),
        ];
    }
}
