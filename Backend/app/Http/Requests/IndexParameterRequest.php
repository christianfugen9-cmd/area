<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexParameterRequest extends FormRequest
{
    public const PER_PAGE_DEFAULT = 15;

    public const PER_PAGE_MAX = 100;

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:255'],
            'sort_by' => ['nullable', 'string', Rule::in(['id', 'name', 'created_at', 'updated_at'])],
            'direction' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::PER_PAGE_MAX],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'direction' => is_string($this->query('direction')) ? strtolower(trim($this->query('direction'))) : null,
            'sort_by' => is_string($this->query('sort_by')) ? strtolower(trim($this->query('sort_by'))) : null,
        ]);
    }

    public function searchTerm(): ?string
    {
        return $this->validated('search');
    }

    public function sortColumn(): ?string
    {
        return $this->validated('sort_by');
    }

    public function sortDirection(): string
    {
        return $this->validated('direction') ?? 'asc';
    }

    public function perPage(): int
    {
        $perPage = (int) ($this->validated('per_page') ?? self::PER_PAGE_DEFAULT);

        return max(1, min($perPage, self::PER_PAGE_MAX));
    }
}