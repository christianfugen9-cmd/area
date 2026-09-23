<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\AttachmentRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAreaRequest extends FormRequest
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
            // `sometimes` supports both PUT (full) and PATCH (partial).
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('areas', 'name')->ignore($areaId),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],

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
    public function areaData(): array
    {
        return collect($this->validated())
            ->only(['name', 'description'])
            ->all();
    }

    /** @return array<int, \Illuminate\Http\UploadedFile> */
    public function uploadedFiles(): array
    {
        return $this->hasFile('files') ? (array) $this->file('files') : [];
    }
}