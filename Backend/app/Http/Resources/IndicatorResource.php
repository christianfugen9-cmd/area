<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Indicator;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Indicator */
class IndicatorResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'parameter_id' => $this->parameter_id,
            'section_type' => $this->section_type,
            'code' => $this->code,
            'description' => $this->description,
            'item_rating' => $this->item_rating,
            'is_custom' => $this->is_custom,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),

            'files' => FileResource::collection($this->whenLoaded('files')),
        ];
    }
}
