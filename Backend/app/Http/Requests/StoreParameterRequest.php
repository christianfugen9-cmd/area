<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\AttachmentRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreParameterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $areaId = $this->route('area')?->getKey();

        return [
            'name' => [
                'required',
                'string',
                'max:255',
                // Unique per area, not globally.
                Rule::unique('parameters', 'name')->where(
                    fn ($query) => $query->where('area_id', $areaId)
                ),
            ],
            'details' => ['nullable', 'string', 'max:10000'],
            'parameter_letter' => ['nullable', 'string', 'max:10'],
            'is_custom' => ['sometimes', 'boolean'],

            'files' => ['sometimes', 'array', 'max:'.AttachmentRules::MAX_FILES_PER_REQUEST],
            'files.*' => AttachmentRules::fileRules(),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.unique' => 'This area already has a parameter with that name.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    /** @return array<string, mixed> */
    public function parameterData(): array
    {
        return [
            'name' => $this->validated('name'),
            'details' => $this->validated('details'),
            'parameter_letter' => $this->validated('parameter_letter'),
            'is_custom' => (bool) ($this->validated('is_custom') ?? false),
        ];
    }

    /** @return array<int, \Illuminate\Http\UploadedFile> */
    public function uploadedFiles(): array
    {
        return $this->hasFile('files') ? (array) $this->file('files') : [];
    }
}