<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Area;
use App\Models\Indicator;
use App\Models\Parameter;
use App\Support\AttachmentRules;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * POST /api/attachments
 *
 * multipart/form-data:
 *   attachable_type : "area" | "parameter" | "indicator"  (morph-map aliases only)
 *   attachable_id   : integer
 *   files[]         : one or more uploads    ("file" is accepted as an alias)
 *
 * SECURITY: attachable_type is matched against an explicit whitelist, never
 * resolved straight into a class name. Without this an attacker could point
 * the polymorphic relation at any model in the application.
 */
class StoreAttachmentRequest extends FormRequest
{
    /**
     * Morph aliases that may receive attachments.
     *
     * @var array<string, class-string<Model>>
     */
    public const ATTACHABLE_TYPES = [
        'area' => Area::class,
        'parameter' => Parameter::class,
        'indicator' => Indicator::class,
    ];

    public function authorize(): bool
    {
        // Swap for a policy check against the resolved parent, e.g.
        // return $this->user()?->can('attach', $this->attachable()) ?? false;
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [
            'attachable_type' => ['required', 'string', Rule::in(array_keys(self::ATTACHABLE_TYPES))],
            'attachable_id' => ['required', 'integer', 'min:1'],

            'files' => ['required', 'array', 'min:1', 'max:'.AttachmentRules::MAX_FILES_PER_REQUEST],
            'files.*' => AttachmentRules::fileRules(),
        ];

        // Only add the exists() check once we know which table to look in;
        // an unknown type already fails on the Rule::in above.
        if ($table = $this->attachableTable()) {
            $rules['attachable_id'][] = Rule::exists($table, 'id');
        }

        return $rules;
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'attachable_type.in' => 'The attachable type must be one of: '.implode(', ', array_keys(self::ATTACHABLE_TYPES)).'.',
            'attachable_id.exists' => 'The selected :attribute does not exist for the given attachable type.',
            'files.required' => 'At least one file must be uploaded.',
            'files.*.max' => 'Each file must not be larger than '.(AttachmentRules::MAX_FILE_KILOBYTES / 1024).'MB.',
        ];
    }

    /**
     * Accepts a few friendly variants and normalises them to the canonical
     * morph alias: "Area", "areas", "App\Models\Area" -> "area".
     * Also lifts a single `file` upload into the `files[]` array.
     */
    protected function prepareForValidation(): void
    {
        $type = $this->input('attachable_type');

        if (is_string($type) && $type !== '') {
            $this->merge(['attachable_type' => $this->normaliseType($type)]);
        }

        if (! $this->has('files') && $this->hasFile('file')) {
            $this->files->set('files', [$this->file('file')]);
        }
    }

    private function normaliseType(string $type): string
    {
        $type = trim($type);

        // Fully-qualified class name supplied: map it back through the morph map.
        if (class_exists($type)) {
            $alias = array_search($type, Relation::morphMap(), true);

            if (is_string($alias)) {
                return $alias;
            }
        }

        return (string) Str::of($type)
            ->afterLast('\\')
            ->snake()
            ->singular()
            ->lower();
    }

    /**
     * Table backing the requested morph alias, or null when unknown.
     */
    public function attachableTable(): ?string
    {
        $class = self::ATTACHABLE_TYPES[(string) $this->input('attachable_type')] ?? null;

        return $class ? (new $class)->getTable() : null;
    }

    /**
     * The validated parent model the uploads will be attached to.
     * Safe to call only after validation has passed.
     */
    public function attachable(): Model
    {
        /** @var class-string<Model> $class */
        $class = self::ATTACHABLE_TYPES[$this->validated('attachable_type')];

        return $class::query()->findOrFail($this->validated('attachable_id'));
    }

    /** @return array<int, \Illuminate\Http\UploadedFile> */
    public function uploadedFiles(): array
    {
        return (array) $this->file('files', []);
    }
}