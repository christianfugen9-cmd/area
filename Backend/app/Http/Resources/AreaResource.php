<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Area;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Area */
class AreaResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),

            // whenCounted / whenLoaded keep the payload honest: a key only
            // appears when the controller actually loaded that relation, so
            // the API never triggers a hidden N+1.
            'parameters_count' => $this->whenCounted('parameters'),
            'files_count' => $this->whenCounted('files'),
            'parameters' => ParameterResource::collection($this->whenLoaded('parameters')),
            'files' => FileResource::collection($this->whenLoaded('files')),
        ];
    }
}