<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Area;
use App\Rules\WithinAreaLimit;
use App\Support\AttachmentRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAreaRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Swap for: return $this->user()?->can('create', Area::class) ?? false;
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('areas', 'name'),
                new WithinAreaLimit(),
            ],
            'description' => ['nullable', 'string', 'max:5000'],

            // Optional attachments uploaded alongside the area itself
            // (multipart/form-data: name[], description, files[]).
            'files' => ['sometimes', 'array', 'max:'.AttachmentRules::MAX_FILES_PER_REQUEST],
            'files.*' => AttachmentRules::fileRules(),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.unique' => 'An area with this name already exists.',
            'files.max' => 'You may upload at most :max files in a single request.',
            'files.*.mimes' => 'The file :position has an unsupported type.',
            'files.*.max' => 'Each file must not be larger than '.(AttachmentRules::MAX_FILE_KILOBYTES / 1024).'MB.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->input('name')) ? trim($this->input('name')) : $this->input('name'),
        ]);
    }

    /**
     * Attribute payload only - never pass uploads to Model::create().
     *
     * @return array<string, mixed>
     */
    public function attributes(): array
    {
        return [
            'files.*' => 'file',
        ];
    }

    /** @return array{name: string, description: string|null} */
    public function areaData(): array
    {
        return [
            'name' => $this->validated('name'),
            'description' => $this->validated('description'),
        ];
    }

    /** @return array<int, \Illuminate\Http\UploadedFile> */
    public function uploadedFiles(): array
    {
        return $this->hasFile('files') ? (array) $this->file('files') : [];
    }

    public function maxAreas(): int
    {
        return Area::MAX_AREAS;
    }
}