<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Indicator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateIndicatorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'section_type' => ['sometimes', 'required', 'string', Rule::in(Indicator::SECTION_TYPES)],
            'code' => ['sometimes', 'required', 'string', 'max:50'],
            'description' => ['sometimes', 'required', 'string', 'max:5000'],
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
        return collect($this->validated())
            ->only(['section_type', 'code', 'description', 'item_rating'])
            ->all();
    }
}
