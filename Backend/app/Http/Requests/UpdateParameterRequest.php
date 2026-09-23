<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Parameter;
use App\Support\AttachmentRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateParameterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var Parameter|null $parameter */
        $parameter = $this->route('parameter');

        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('parameters', 'name')
                    ->where(fn ($query) => $query->where('area_id', $parameter?->area_id))
                    ->ignore($parameter?->getKey()),
            ],
            'details' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'parameter_letter' => ['sometimes', 'nullable', 'string', 'max:10'],
            'is_custom' => ['sometimes', 'boolean'],

            // Moving a parameter to a different area is allowed but explicit.
            'area_id' => ['sometimes', 'required', 'integer', Rule::exists('areas', 'id')],

            'files' => ['sometimes', 'array', 'max:'.AttachmentRules::MAX_FILES_PER_REQUEST],
            'files.*' => AttachmentRules::fileRules(),
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
        return collect($this->validated())
            ->only(['name', 'details', 'area_id', 'parameter_letter', 'is_custom'])
            ->all();
    }

    /** @return array<int, \Illuminate\Http\UploadedFile> */
    public function uploadedFiles(): array
    {
        return $this->hasFile('files') ? (array) $this->file('files') : [];
    }
}