<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Indicator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreIndicatorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'section_type' => ['required', 'string', Rule::in(Indicator::SECTION_TYPES)],
            'code' => ['required', 'string', 'max:50'],
            'description' => ['required', 'string', 'max:5000'],
            'item_rating' => ['nullable', 'numeric', 'between:0,5'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => trim($this->input('code'))]);
        }

        if (is_string($this->input('description'))) {
            $this->merge(['description' => trim($this->input('description'))]);
        }

        if (is_string($this->input('section_type'))) {
            $this->merge(['section_type' => strtoupper(trim($this->input('section_type')))]);
        }
    }

    /** @return array<string, mixed> */
    public function indicatorData(): array
    {
        return [
            'section_type' => $this->validated('section_type'),
            'code' => $this->validated('code'),
            'description' => $this->validated('description'),
            'item_rating' => $this->validated('item_rating'),
            'is_custom' => true,
        ];
    }
}
