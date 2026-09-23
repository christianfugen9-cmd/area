<#
================================================================================
 Areas / Parameters / Attachments API - one-shot installer
================================================================================
 Run from an EMPTY folder (your Backend directory):

     cd "C:\Users\Christian Jay Fugen\OneDrive\Desktop\area\Backend"
     Set-ExecutionPolicy -Scope Process -Bypass -Force
     .\setup-backend.ps1

 What it does:
   1. checks PHP + Composer are installed
   2. scaffolds a fresh Laravel app in this folder
   3. writes every model / migration / request / controller / route file
   4. sets up a SQLite database, runs the migrations, links public storage
   5. runs the test suite

 Prerequisites (install these first if step 1 fails):
   PHP 8.2+   ->  https://windows.php.net/download  (or Laragon / XAMPP)
   Composer   ->  https://getcomposer.org/download
 Enable these PHP extensions in php.ini: fileinfo, pdo_sqlite, sqlite3,
 mbstring, openssl, curl, zip.
================================================================================
#>

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path

function Write-Step([string]$text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

function Write-ProjectFile([string]$RelativePath, [string]$Content) {
    $full = Join-Path $root $RelativePath
    $dir  = Split-Path $full -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    # UTF-8 without BOM - a BOM before <?php breaks PHP output
    [System.IO.File]::WriteAllText($full, $Content, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "    wrote $RelativePath" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- 1. toolchain
Write-Step "Checking prerequisites"

if (-not (Get-Command php -ErrorAction SilentlyContinue)) {
    throw "PHP was not found on your PATH. Install PHP 8.2+ (or Laragon) and reopen the terminal."
}
if (-not (Get-Command composer -ErrorAction SilentlyContinue)) {
    throw "Composer was not found on your PATH. Install it from https://getcomposer.org/download and reopen the terminal."
}

php -v | Select-Object -First 1 | Write-Host
composer --version | Write-Host

# ------------------------------------------------------------- 2. laravel skel
Write-Step "Scaffolding Laravel"

if (Test-Path (Join-Path $root 'artisan')) {
    Write-Host "    artisan already present - skipping create-project" -ForegroundColor Yellow
} else {
    # Composer refuses to scaffold into a directory that isn't completely
    # empty (this script's own file counts, and OneDrive/Explorer often
    # leave a hidden desktop.ini behind too). Scaffolding into a throwaway
    # subfolder and moving the contents up sidesteps that check entirely.
    $stage = Join-Path $root '__laravel_stage__'
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory -Path $stage | Out-Null

    Push-Location $stage
    composer create-project laravel/laravel . --no-interaction
    $created = $LASTEXITCODE
    Pop-Location

    if ($created -ne 0) {
        Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
        throw "composer create-project failed."
    }

    Get-ChildItem -Force -Path $stage | ForEach-Object {
        Move-Item -Path $_.FullName -Destination $root -Force
    }
    Remove-Item $stage -Recurse -Force
}

# ------------------------------------------------------------- 3. project code
Write-Step "Writing application code"


Write-ProjectFile 'app/Exceptions/AreaLimitReachedException.php' @'
<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Models\Area;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Thrown by Area::creating() when the global ceiling is hit outside the
 * HTTP validation layer (seeders, jobs, console commands).
 */
class AreaLimitReachedException extends RuntimeException
{
    public function __construct(string $message = '')
    {
        parent::__construct(
            $message !== '' ? $message : sprintf(
                'Cannot create another area: the system limit of %d areas has been reached.',
                Area::MAX_AREAS
            )
        );
    }

    /**
     * Renders as a 422 that mirrors Laravel's own validation error shape,
     * so API clients only ever have to parse one error format.
     */
    public function render(Request $request): ?JsonResponse
    {
        if (! $request->expectsJson()) {
            return null;
        }

        return response()->json([
            'message' => $this->getMessage(),
            'errors' => [
                'name' => [$this->getMessage()],
            ],
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
'@

Write-ProjectFile 'app/Http/Controllers/Api/AreaController.php' @'
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\IndexAreaRequest;
use App\Http\Requests\StoreAreaRequest;
use App\Http\Requests\UpdateAreaRequest;
use App\Http\Resources\AreaResource;
use App\Models\Area;
use App\Services\FileUploadService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Throwable;

class AreaController extends Controller
{
    public function __construct(private readonly FileUploadService $uploads)
    {
        // Enable once auth is wired up:
        // $this->authorizeResource(Area::class, 'area');
    }

    /**
     * GET /api/areas
     *
     * ?search=keyword&sort_by=name&direction=asc&per_page=15
     */
    public function index(IndexAreaRequest $request): AnonymousResourceCollection
    {
        $areas = Area::query()
            ->search($request->searchTerm())
            ->sort($request->sortColumn(), $request->sortDirection())
            ->withCount(['parameters', 'files'])
            ->with([
                'files',
                'parameters' => fn (Builder $query) => $query
                    ->with('files')
                    ->withCount('files')
                    ->orderBy('name'),
            ])
            ->paginate($request->perPage())
            ->withQueryString();

        return AreaResource::collection($areas)->additional([
            'meta' => [
                'max_areas' => Area::MAX_AREAS,
                'remaining_slots' => Area::remainingCapacity(),
                'filters' => [
                    'search' => $request->searchTerm(),
                    'sort_by' => $request->sortColumn() ?? 'created_at',
                    'direction' => $request->sortDirection(),
                ],
            ],
        ]);
    }

    /**
     * POST /api/areas
     *
     * The 10-area ceiling is enforced by App\Rules\WithinAreaLimit (422) and
     * again by Area::creating() for any non-HTTP caller.
     */
    public function store(StoreAreaRequest $request): JsonResponse
    {
        try {
            $area = DB::transaction(function () use ($request): Area {
                $area = Area::create($request->areaData());

                if ($files = $request->uploadedFiles()) {
                    $this->uploads->storeMany($files, $area);
                }

                return $area;
            });

            // DB committed - the blobs on disk are now permanent.
            $this->uploads->commit();
        } catch (Throwable $e) {
            // DB rolled back - remove anything already written to disk.
            $this->uploads->rollback();

            throw $e;
        }

        $area->loadCount(['parameters', 'files'])->load(['parameters.files', 'files']);

        return AreaResource::make($area)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/areas/{area}
     */
    public function show(Area $area): AreaResource
    {
        $area->loadCount(['parameters', 'files'])
            ->load([
                'files',
                'parameters' => fn (Builder $query) => $query
                    ->with('files')
                    ->withCount('files')
                    ->orderBy('name'),
            ]);

        return AreaResource::make($area);
    }

    /**
     * PUT|PATCH /api/areas/{area}
     *
     * Note: sending files here appends new attachments, it does not replace
     * existing ones. Removing an attachment is DELETE /api/attachments/{file}.
     */
    public function update(UpdateAreaRequest $request, Area $area): AreaResource
    {
        try {
            DB::transaction(function () use ($request, $area): void {
                $data = $request->areaData();

                if ($data !== []) {
                    $area->update($data);
                }

                if ($files = $request->uploadedFiles()) {
                    $this->uploads->storeMany($files, $area);
                }
            });

            $this->uploads->commit();
        } catch (Throwable $e) {
            $this->uploads->rollback();

            throw $e;
        }

        $area->refresh()
            ->loadCount(['parameters', 'files'])
            ->load(['parameters.files', 'files']);

        return AreaResource::make($area);
    }

    /**
     * DELETE /api/areas/{area}
     *
     * Area::deleting() walks the parameters and attachments through Eloquent
     * so every physical file is unlinked; the blobs are only removed once the
     * transaction commits (see File::booted()).
     */
    public function destroy(Area $area): Response
    {
        DB::transaction(fn () => $area->delete());

        return response()->noContent();
    }
}
'@

Write-ProjectFile 'app/Http/Controllers/Api/AttachmentController.php' @'
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAttachmentRequest;
use App\Http\Resources\FileResource;
use App\Models\File;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Throwable;

class AttachmentController extends Controller
{
    public function __construct(private readonly FileUploadService $uploads)
    {
    }

    /**
     * GET /api/attachments
     *
     * ?search=report&sort_by=file_size&direction=desc
     * &attachable_type=area&attachable_id=3
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $files = File::query()
            ->search($request->query('search'))
            ->when(
                $request->filled('attachable_type'),
                fn ($query) => $query->where('attachable_type', $request->query('attachable_type'))
            )
            ->when(
                $request->filled('attachable_id'),
                fn ($query) => $query->where('attachable_id', $request->integer('attachable_id'))
            )
            ->sort($request->query('sort_by'), $request->query('direction'))
            ->paginate(min(max((int) $request->integer('per_page', 15), 1), 100))
            ->withQueryString();

        return FileResource::collection($files);
    }

    /**
     * POST /api/attachments  (multipart/form-data)
     *
     * attachable_type=area|parameter, attachable_id=<id>, files[]=<upload>
     */
    public function store(StoreAttachmentRequest $request): JsonResponse
    {
        $attachable = $request->attachable();

        try {
            $files = DB::transaction(
                fn () => $this->uploads->storeMany($request->uploadedFiles(), $attachable)
            );

            $this->uploads->commit();
        } catch (Throwable $e) {
            $this->uploads->rollback();

            throw $e;
        }

        return FileResource::collection($files)
            ->additional([
                'message' => $files->count().' file(s) attached successfully.',
                'attachable' => [
                    'type' => $attachable->getMorphClass(),
                    'id' => $attachable->getKey(),
                ],
            ])
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/attachments/{file}
     */
    public function show(File $file): FileResource
    {
        return FileResource::make($file);
    }

    /**
     * DELETE /api/attachments/{file}
     *
     * Removes the row; File::deleted() unlinks the blob from the `public`
     * disk once the transaction commits.
     */
    public function destroy(File $file): Response
    {
        DB::transaction(fn () => $file->delete());

        return response()->noContent();
    }
}
'@

Write-ProjectFile 'app/Http/Controllers/Api/ParameterController.php' @'
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\IndexParameterRequest;
use App\Http\Requests\StoreParameterRequest;
use App\Http\Requests\UpdateParameterRequest;
use App\Http\Resources\ParameterResource;
use App\Models\Area;
use App\Models\Parameter;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Throwable;

class ParameterController extends Controller
{
    public function __construct(private readonly FileUploadService $uploads)
    {
    }

    /**
     * GET /api/areas/{area}/parameters
     */
    public function index(IndexParameterRequest $request, Area $area): AnonymousResourceCollection
    {
        $parameters = $area->parameters()
            ->search($request->searchTerm())
            ->sort($request->sortColumn(), $request->sortDirection())
            ->withCount('files')
            ->with('files')
            ->paginate($request->perPage())
            ->withQueryString();

        return ParameterResource::collection($parameters);
    }

    /**
     * POST /api/areas/{area}/parameters
     */
    public function store(StoreParameterRequest $request, Area $area): JsonResponse
    {
        try {
            $parameter = DB::transaction(function () use ($request, $area): Parameter {
                /** @var Parameter $parameter */
                $parameter = $area->parameters()->create($request->parameterData());

                if ($files = $request->uploadedFiles()) {
                    $this->uploads->storeMany($files, $parameter);
                }

                return $parameter;
            });

            $this->uploads->commit();
        } catch (Throwable $e) {
            $this->uploads->rollback();

            throw $e;
        }

        $parameter->loadCount('files')->load('files');

        return ParameterResource::make($parameter)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/parameters/{parameter}
     */
    public function show(Parameter $parameter): ParameterResource
    {
        $parameter->loadCount('files')->load(['files', 'area']);

        return ParameterResource::make($parameter);
    }

    /**
     * PUT|PATCH /api/parameters/{parameter}
     */
    public function update(UpdateParameterRequest $request, Parameter $parameter): ParameterResource
    {
        try {
            DB::transaction(function () use ($request, $parameter): void {
                $data = $request->parameterData();

                if ($data !== []) {
                    $parameter->update($data);
                }

                if ($files = $request->uploadedFiles()) {
                    $this->uploads->storeMany($files, $parameter);
                }
            });

            $this->uploads->commit();
        } catch (Throwable $e) {
            $this->uploads->rollback();

            throw $e;
        }

        $parameter->refresh()->loadCount('files')->load('files');

        return ParameterResource::make($parameter);
    }

    /**
     * DELETE /api/parameters/{parameter}
     */
    public function destroy(Parameter $parameter): Response
    {
        DB::transaction(fn () => $parameter->delete());

        return response()->noContent();
    }
}
'@

Write-ProjectFile 'app/Http/Controllers/Controller.php' @'
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;

/**
 * Laravel 11/12 ships a bare abstract Controller. The traits below are
 * pulled back in so $this->authorize() / authorizeResource() keep working.
 */
abstract class Controller extends BaseController
{
    use AuthorizesRequests;
    use ValidatesRequests;
}
'@

Write-ProjectFile 'app/Http/Requests/IndexAreaRequest.php' @'
<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the query string for GET /api/areas.
 *
 * Nothing here is strictly required - every value has a safe default in the
 * model scopes - but validating up front gives the client a clear 422 rather
 * than silently ignoring a typo'd sort column.
 */
class IndexAreaRequest extends FormRequest
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
            'sort_by' => ['nullable', 'string', Rule::in(['id', 'name', 'created_at', 'updated_at', 'parameters_count', 'files_count'])],
            'direction' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::PER_PAGE_MAX],
            'with_parameters' => ['nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'direction' => is_string($this->query('direction'))
                ? strtolower(trim($this->query('direction')))
                : null,
            'sort_by' => is_string($this->query('sort_by'))
                ? strtolower(trim($this->query('sort_by')))
                : null,
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
'@

Write-ProjectFile 'app/Http/Requests/IndexParameterRequest.php' @'
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
'@

Write-ProjectFile 'app/Http/Requests/StoreAreaRequest.php' @'
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
'@

Write-ProjectFile 'app/Http/Requests/StoreAttachmentRequest.php' @'
<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Area;
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
 *   attachable_type : "area" | "parameter"   (morph-map aliases only)
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
'@

Write-ProjectFile 'app/Http/Requests/StoreParameterRequest.php' @'
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
        ];
    }

    /** @return array<int, \Illuminate\Http\UploadedFile> */
    public function uploadedFiles(): array
    {
        return $this->hasFile('files') ? (array) $this->file('files') : [];
    }
}
'@

Write-ProjectFile 'app/Http/Requests/UpdateAreaRequest.php' @'
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
'@

Write-ProjectFile 'app/Http/Requests/UpdateParameterRequest.php' @'
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
            ->only(['name', 'details', 'area_id'])
            ->all();
    }

    /** @return array<int, \Illuminate\Http\UploadedFile> */
    public function uploadedFiles(): array
    {
        return $this->hasFile('files') ? (array) $this->file('files') : [];
    }
}
'@

Write-ProjectFile 'app/Http/Resources/AreaResource.php' @'
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
'@

Write-ProjectFile 'app/Http/Resources/FileResource.php' @'
<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\File;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin File */
class FileResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'file_name' => $this->file_name,
            'file_path' => $this->file_path,
            'file_size' => $this->file_size,
            'human_readable_size' => $this->human_readable_size,
            'mime_type' => $this->mime_type,
            'url' => $this->url,
            'attachable_type' => $this->attachable_type,
            'attachable_id' => $this->attachable_id,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
'@

Write-ProjectFile 'app/Http/Resources/ParameterResource.php' @'
<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Parameter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Parameter */
class ParameterResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'area_id' => $this->area_id,
            'name' => $this->name,
            'details' => $this->details,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),

            'files_count' => $this->whenCounted('files'),
            'files' => FileResource::collection($this->whenLoaded('files')),
            'area' => new AreaResource($this->whenLoaded('area')),
        ];
    }
}
'@

Write-ProjectFile 'app/Models/Area.php' @'
<?php

declare(strict_types=1);

namespace App\Models;

use App\Exceptions\AreaLimitReachedException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * @property int    $id
 * @property string $name
 * @property string|null $description
 */
class Area extends Model
{
    use HasFactory;

    /**
     * Hard system-wide ceiling on the number of areas.
     * Enforced in two places on purpose:
     *  - App\Rules\WithinAreaLimit  -> returns a friendly 422 to API clients.
     *  - the creating() hook below  -> last line of defence for seeders,
     *    console commands, queued jobs and anything else that bypasses
     *    the HTTP validation layer.
     */
    public const MAX_AREAS = 10;

    /** @var list<string> */
    protected $fillable = [
        'name',
        'description',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $area): void {
            if (! static::hasCapacity()) {
                throw new AreaLimitReachedException();
            }
        });

        static::deleting(function (self $area): void {
            // The DB-level ON DELETE CASCADE on parameters.area_id never fires
            // Eloquent events, which would leave orphaned rows in `files` and
            // orphaned blobs on disk. Delete through the models instead so the
            // File::deleted() hook can unlink each physical file.
            $area->loadMissing(['parameters.files', 'files']);

            $area->parameters->each->delete();
            $area->files->each->delete();
        });
    }

    /**
     * Remaining slots before the global limit is hit.
     */
    public static function remainingCapacity(): int
    {
        return max(0, self::MAX_AREAS - static::query()->count());
    }

    public static function hasCapacity(): bool
    {
        return static::remainingCapacity() > 0;
    }

    // ---------------------------------------------------------------------
    // Relationships
    // ---------------------------------------------------------------------

    /** @return HasMany<Parameter> */
    public function parameters(): HasMany
    {
        return $this->hasMany(Parameter::class);
    }

    /** @return MorphMany<File> */
    public function files(): MorphMany
    {
        return $this->morphMany(File::class, 'attachable');
    }

    // ---------------------------------------------------------------------
    // Query scopes
    // ---------------------------------------------------------------------

    /**
     * Free-text search across the area itself, its parameters, its own
     * attachments and its parameters' attachments.
     *
     * @param  Builder<Area>  $query
     * @return Builder<Area>
     */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);

        if ($term === '') {
            return $query;
        }

        $like = '%'.addcslashes($term, '%_\\').'%';

        return $query->where(function (Builder $q) use ($like): void {
            $q->where('areas.name', 'LIKE', $like)
                ->orWhere('areas.description', 'LIKE', $like)
                ->orWhereHas('parameters', function (Builder $p) use ($like): void {
                    $p->where('parameters.name', 'LIKE', $like)
                        ->orWhere('parameters.details', 'LIKE', $like);
                })
                ->orWhereHas('files', fn (Builder $f) => $f->where('files.file_name', 'LIKE', $like))
                ->orWhereHas('parameters.files', fn (Builder $f) => $f->where('files.file_name', 'LIKE', $like));
        });
    }

    /**
     * Whitelisted sorting. Anything unknown silently falls back to the
     * default so a malformed query string can never produce a SQL error
     * or an injection vector.
     *
     * @param  Builder<Area>  $query
     * @return Builder<Area>
     */
    public function scopeSort(Builder $query, ?string $column = null, ?string $direction = null): Builder
    {
        $sortable = ['id', 'name', 'created_at', 'updated_at', 'parameters_count', 'files_count'];

        $column = in_array($column, $sortable, true) ? $column : 'created_at';
        $direction = strtolower((string) $direction) === 'desc' ? 'desc' : 'asc';

        // Ordering by an aggregate uses a correlated sub-query rather than
        // withCount(), so the scope stays composable with whatever the
        // controller has already eager-loaded (no duplicate alias clashes).
        if ($column === 'parameters_count') {
            return $query->orderBy(
                Parameter::query()
                    ->selectRaw('count(*)')
                    ->whereColumn('parameters.area_id', 'areas.id'),
                $direction
            );
        }

        if ($column === 'files_count') {
            return $query->orderBy(
                File::query()
                    ->selectRaw('count(*)')
                    ->where('files.attachable_type', self::morphAlias())
                    ->whereColumn('files.attachable_id', 'areas.id'),
                $direction
            );
        }

        return $query->orderBy("areas.{$column}", $direction);
    }

    public static function morphAlias(): string
    {
        return (new static)->getMorphClass();
    }
}
'@

Write-ProjectFile 'app/Models/File.php' @'
<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * @property int         $id
 * @property string      $file_name
 * @property string      $file_path
 * @property int         $file_size
 * @property string|null $mime_type
 * @property string      $attachable_type
 * @property int         $attachable_id
 * @property-read string|null $url
 * @property-read string      $human_readable_size
 */
class File extends Model
{
    use HasFactory;

    /**
     * Disk every attachment lives on. Keeping it on the model means the
     * controllers, the upload service and the accessors can never drift
     * apart.
     */
    public const DISK = 'public';

    /** @var list<string> */
    protected $fillable = [
        'file_name',
        'file_path',
        'file_size',
        'mime_type',
    ];

    /** @var list<string> */
    protected $appends = [
        'url',
        'human_readable_size',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::deleted(function (self $file): void {
            // Deferred until the surrounding transaction commits. If the
            // transaction rolls back the row survives - and so must the blob.
            // Outside a transaction this executes immediately.
            DB::afterCommit(fn () => $file->deleteFromDisk());
        });
    }

    // ---------------------------------------------------------------------
    // Relationships
    // ---------------------------------------------------------------------

    /** @return MorphTo<Model, File> */
    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }

    // ---------------------------------------------------------------------
    // Accessors & mutators
    // ---------------------------------------------------------------------

    /**
     * Normalise the stored path: no leading slash, forward slashes only.
     * Guarantees Storage::url() and Storage::delete() always agree.
     */
    protected function filePath(): Attribute
    {
        return Attribute::make(
            set: fn (string $value): string => ltrim(str_replace('\\', '/', trim($value)), '/'),
        );
    }

    /**
     * Publicly reachable URL. Respects whatever is configured for the disk,
     * so swapping `public` for S3 later needs no code change here.
     */
    protected function url(): Attribute
    {
        return Attribute::get(function (): ?string {
            if (blank($this->file_path)) {
                return null;
            }

            return Storage::disk(self::DISK)->url($this->file_path);
        })->shouldCache();
    }

    protected function humanReadableSize(): Attribute
    {
        return Attribute::get(function (): string {
            $bytes = max(0, (int) $this->file_size);

            if ($bytes < 1024) {
                return $bytes.' B';
            }

            $units = ['KB', 'MB', 'GB', 'TB'];
            $power = min((int) floor(log($bytes, 1024)), count($units));

            return round($bytes / (1024 ** $power), 2).' '.$units[$power - 1];
        })->shouldCache();
    }

    // ---------------------------------------------------------------------
    // Storage helpers
    // ---------------------------------------------------------------------

    public function deleteFromDisk(): bool
    {
        if (blank($this->file_path)) {
            return true;
        }

        return Storage::disk(self::DISK)->delete($this->file_path);
    }

    public function existsOnDisk(): bool
    {
        return filled($this->file_path)
            && Storage::disk(self::DISK)->exists($this->file_path);
    }

    /**
     * Temporary, expiring URL. No-op fallback for local disks that do not
     * support signed URLs.
     */
    public function temporaryUrl(int $minutes = 5): ?string
    {
        $disk = Storage::disk(self::DISK);

        if (blank($this->file_path) || ! method_exists($disk, 'temporaryUrl')) {
            return $this->url;
        }

        try {
            return $disk->temporaryUrl($this->file_path, now()->addMinutes($minutes));
        } catch (\RuntimeException) {
            return $this->url;
        }
    }

    // ---------------------------------------------------------------------
    // Query scopes
    // ---------------------------------------------------------------------

    /**
     * @param  Builder<File>  $query
     * @return Builder<File>
     */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);

        if ($term === '') {
            return $query;
        }

        $like = '%'.addcslashes($term, '%_\\').'%';

        return $query->where(function (Builder $q) use ($like): void {
            $q->where('files.file_name', 'LIKE', $like)
                ->orWhere('files.mime_type', 'LIKE', $like);
        });
    }

    /**
     * @param  Builder<File>  $query
     * @return Builder<File>
     */
    public function scopeSort(Builder $query, ?string $column = null, ?string $direction = null): Builder
    {
        $sortable = ['id', 'file_name', 'file_size', 'mime_type', 'created_at', 'updated_at'];

        $column = in_array($column, $sortable, true) ? $column : 'created_at';
        $direction = strtolower((string) $direction) === 'desc' ? 'desc' : 'asc';

        return $query->orderBy("files.{$column}", $direction);
    }
}
'@

Write-ProjectFile 'app/Models/Parameter.php' @'
<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * @property int    $id
 * @property int    $area_id
 * @property string $name
 * @property string|null $details
 */
class Parameter extends Model
{
    use HasFactory;

    /** @var list<string> */
    protected $fillable = [
        'area_id',
        'name',
        'details',
    ];

    protected static function booted(): void
    {
        static::deleting(function (self $parameter): void {
            $parameter->loadMissing('files');
            $parameter->files->each->delete();
        });
    }

    // ---------------------------------------------------------------------
    // Relationships
    // ---------------------------------------------------------------------

    /** @return BelongsTo<Area, Parameter> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    /** @return MorphMany<File> */
    public function files(): MorphMany
    {
        return $this->morphMany(File::class, 'attachable');
    }

    // ---------------------------------------------------------------------
    // Query scopes
    // ---------------------------------------------------------------------

    /**
     * @param  Builder<Parameter>  $query
     * @return Builder<Parameter>
     */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);

        if ($term === '') {
            return $query;
        }

        $like = '%'.addcslashes($term, '%_\\').'%';

        return $query->where(function (Builder $q) use ($like): void {
            $q->where('parameters.name', 'LIKE', $like)
                ->orWhere('parameters.details', 'LIKE', $like)
                ->orWhereHas('area', fn (Builder $a) => $a->where('areas.name', 'LIKE', $like))
                ->orWhereHas('files', fn (Builder $f) => $f->where('files.file_name', 'LIKE', $like));
        });
    }

    /**
     * @param  Builder<Parameter>  $query
     * @return Builder<Parameter>
     */
    public function scopeSort(Builder $query, ?string $column = null, ?string $direction = null): Builder
    {
        $sortable = ['id', 'name', 'created_at', 'updated_at'];

        $column = in_array($column, $sortable, true) ? $column : 'created_at';
        $direction = strtolower((string) $direction) === 'desc' ? 'desc' : 'asc';

        return $query->orderBy("parameters.{$column}", $direction);
    }
}
'@

Write-ProjectFile 'app/Providers/AppServiceProvider.php' @'
<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\Area;
use App\Models\File;
use App\Models\Parameter;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        /**
         * Morph map. Two reasons this matters here:
         *  1. `files.attachable_type` stores "area"/"parameter" instead of a
         *     fully-qualified class name, so refactoring a namespace does not
         *     require a data migration.
         *  2. POST /api/attachments accepts these aliases from the client,
         *     which means an attacker cannot point `attachable_type` at an
         *     arbitrary class.
         */
        Relation::enforceMorphMap([
            'area' => Area::class,
            'parameter' => Parameter::class,
            'file' => File::class,
        ]);

        // Fail loudly in development instead of silently returning null
        // relations or running N+1 queries.
        Model::preventLazyLoading(! app()->isProduction());

        $this->configureRateLimiters();
    }

    /**
     * `throttle:uploads` is referenced by POST /api/attachments.
     */
    protected function configureRateLimiters(): void
    {
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(30)
            ->by($request->user()?->getAuthIdentifier() ?: $request->ip()));

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(60)
            ->by($request->user()?->getAuthIdentifier() ?: $request->ip()));
    }
}
'@

Write-ProjectFile 'app/Rules/WithinAreaLimit.php' @'
<?php

declare(strict_types=1);

namespace App\Rules;

use App\Models\Area;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Fails when the areas table is already at App\Models\Area::MAX_AREAS.
 *
 * Attached to the `name` field of StoreAreaRequest so the client receives a
 * normal 422 validation payload rather than an exception.
 */
class WithinAreaLimit implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (Area::hasCapacity()) {
            return;
        }

        $fail(sprintf(
            'The system limit of %d areas has been reached. Delete an existing area before creating a new one.',
            Area::MAX_AREAS
        ));
    }
}
'@

Write-ProjectFile 'app/Services/FileUploadService.php' @'
<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\File;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Writes uploads to disk and attaches a File record to any morphable model.
 *
 * Physical writes are not transactional, so every path written during a
 * request is tracked. The controller calls commit() once the surrounding DB
 * transaction has succeeded, or rollback() if anything threw - which is what
 * keeps the disk and the `files` table from drifting apart.
 *
 * Resolved fresh per request out of the container (never a singleton).
 */
class FileUploadService
{
    /** @var list<string> Paths written during this request, not yet committed. */
    private array $pending = [];

    /**
     * Store one upload and attach it to the given model.
     *
     * $attachable must expose a `files()` MorphMany relation
     * (App\Models\Area or App\Models\Parameter).
     */
    public function store(UploadedFile $upload, Model $attachable): File
    {
        $path = $upload->store($this->directoryFor($attachable), ['disk' => File::DISK]);

        if ($path === false || $path === '') {
            throw new RuntimeException("Unable to write [{$upload->getClientOriginalName()}] to the [".File::DISK.'] disk.');
        }

        $this->pending[] = $path;

        try {
            /** @var File $file */
            $file = $attachable->files()->create([
                'file_name' => $this->safeName($upload),
                'file_path' => $path,
                'file_size' => (int) ($upload->getSize() ?: 0),
                'mime_type' => $upload->getClientMimeType() ?: $upload->getMimeType(),
            ]);

            return $file;
        } catch (Throwable $e) {
            // The row failed; do not leave an orphan blob behind.
            Storage::disk(File::DISK)->delete($path);
            $this->pending = array_values(array_diff($this->pending, [$path]));

            throw $e;
        }
    }

    /**
     * @param  iterable<UploadedFile>  $uploads
     * @return EloquentCollection<int, File>
     */
    public function storeMany(iterable $uploads, Model $attachable): EloquentCollection
    {
        $stored = new EloquentCollection();

        foreach ($uploads as $upload) {
            if ($upload instanceof UploadedFile) {
                $stored->push($this->store($upload, $attachable));
            }
        }

        return $stored;
    }

    /**
     * Call after the DB transaction commits: the blobs are now permanent.
     */
    public function commit(): void
    {
        $this->pending = [];
    }

    /**
     * Call when the DB transaction rolled back: remove every blob written
     * during this request.
     */
    public function rollback(): void
    {
        if ($this->pending !== []) {
            Storage::disk(File::DISK)->delete($this->pending);
        }

        $this->pending = [];
    }

    /**
     * attachments/areas/2026/09  - keeps directories from growing unbounded
     * and makes manual housekeeping straightforward.
     */
    private function directoryFor(Model $attachable): string
    {
        $bucket = Str::of(class_basename($attachable))->snake()->plural()->lower();

        return sprintf('attachments/%s/%s', $bucket, now()->format('Y/m'));
    }

    /**
     * The original name is only ever echoed back to clients, never used to
     * build a path (the path comes from Laravel's hashed name), but it is
     * still stripped of directory components and length-capped.
     */
    private function safeName(UploadedFile $upload): string
    {
        $original = $upload->getClientOriginalName() ?: $upload->hashName();
        $name = basename(str_replace('\\', '/', $original));

        return Str::limit(trim($name) !== '' ? $name : $upload->hashName(), 250, '');
    }
}
'@

Write-ProjectFile 'app/Support/AttachmentRules.php' @'
<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Single source of truth for upload constraints, shared by every Form
 * Request that accepts files. Change the policy once, here.
 */
final class AttachmentRules
{
    /** Per-file ceiling in kilobytes (10 MB). */
    public const MAX_FILE_KILOBYTES = 10240;

    /** How many files one request may carry. */
    public const MAX_FILES_PER_REQUEST = 10;

    /**
     * Extension whitelist. `mimes` checks the guessed extension against the
     * real MIME type reported by the file itself, so a renamed .php cannot
     * sneak through as .jpg.
     *
     * @var list<string>
     */
    public const ALLOWED_EXTENSIONS = [
        'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'csv', 'txt', 'zip',
    ];

    /**
     * Belt-and-braces MIME whitelist applied on top of the extension check.
     *
     * @var list<string>
     */
    public const ALLOWED_MIME_TYPES = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/csv', 'text/plain',
        'application/zip', 'application/x-zip-compressed',
    ];

    /**
     * Rules applied to a single uploaded file.
     *
     * @return list<string>
     */
    public static function fileRules(): array
    {
        return [
            'file',
            'max:'.self::MAX_FILE_KILOBYTES,
            'mimes:'.implode(',', self::ALLOWED_EXTENSIONS),
            'mimetypes:'.implode(',', self::ALLOWED_MIME_TYPES),
        ];
    }
}
'@

Write-ProjectFile 'bootstrap/app.php' @'
<?php

declare(strict_types=1);

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Uncomment if the API is consumed by a first-party SPA:
        // $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Route model binding misses return a clean 404 instead of leaking
        // the model class name in the message.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') && $e->getPrevious() instanceof ModelNotFoundException) {
                return response()->json(['message' => 'Resource not found.'], 404);
            }

            return null;
        });

        // AreaLimitReachedException renders itself (see its render() method).
    })->create();
'@

Write-ProjectFile 'database/factories/AreaFactory.php' @'
<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Area;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Area> */
class AreaFactory extends Factory
{
    protected $model = Area::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => ucfirst($this->faker->unique()->words(2, true)),
            'description' => $this->faker->optional()->sentence(12),
        ];
    }
}
'@

Write-ProjectFile 'database/factories/FileFactory.php' @'
<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Area;
use App\Models\File;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<File> */
class FileFactory extends Factory
{
    protected $model = File::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $name = $this->faker->unique()->slug(2).'.pdf';

        return [
            'file_name' => $name,
            'file_path' => 'attachments/areas/'.now()->format('Y/m').'/'.$this->faker->uuid().'.pdf',
            'file_size' => $this->faker->numberBetween(1024, 5_000_000),
            'mime_type' => 'application/pdf',
            'attachable_type' => 'area',
            'attachable_id' => Area::factory(),
        ];
    }

    /**
     * Usage: File::factory()->for($parameter, 'attachable')->create();
     */
    public function forAttachable(\Illuminate\Database\Eloquent\Model $model): static
    {
        return $this->state(fn () => [
            'attachable_type' => $model->getMorphClass(),
            'attachable_id' => $model->getKey(),
        ]);
    }
}
'@

Write-ProjectFile 'database/factories/ParameterFactory.php' @'
<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Area;
use App\Models\Parameter;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Parameter> */
class ParameterFactory extends Factory
{
    protected $model = Parameter::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'area_id' => Area::factory(),
            'name' => ucfirst($this->faker->unique()->words(2, true)),
            'details' => $this->faker->optional()->paragraph(),
        ];
    }
}
'@

Write-ProjectFile 'database/migrations/2025_01_01_000001_create_areas_table.php' @'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('areas', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->timestamps();

            // Supports the default ordering (?sort_by=created_at).
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('areas');
    }
};
'@

Write-ProjectFile 'database/migrations/2025_01_01_000002_create_parameters_table.php' @'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parameters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('area_id')
                ->constrained()
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
            $table->string('name');
            $table->text('details')->nullable();
            $table->timestamps();

            // A parameter name only has to be unique inside its own area.
            $table->unique(['area_id', 'name']);
            $table->index('name');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parameters');
    }
};
'@

Write-ProjectFile 'database/migrations/2025_01_01_000003_create_files_table.php' @'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('files', function (Blueprint $table) {
            $table->id();
            $table->string('file_name');
            $table->string('file_path', 1024);
            $table->unsignedBigInteger('file_size')->default(0);
            $table->string('mime_type', 191)->nullable();

            // Creates attachable_type + attachable_id and a composite index.
            $table->morphs('attachable');

            $table->timestamps();

            // Used by ?search= against file names.
            $table->index('file_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('files');
    }
};
'@

Write-ProjectFile 'database/seeders/AreaSeeder.php' @'
<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Parameter;
use Illuminate\Database\Seeder;

class AreaSeeder extends Seeder
{
    public function run(): void
    {
        // Never exceed the ceiling, even when re-seeding a populated database.
        $toCreate = Area::remainingCapacity();

        Area::factory()
            ->count($toCreate)
            ->has(Parameter::factory()->count(3), 'parameters')
            ->create();
    }
}
'@

Write-ProjectFile 'routes/api.php' @'
<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AreaController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\ParameterController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Laravel 11/12: this file is registered from bootstrap/app.php via
|     ->withRouting(api: __DIR__.'/../routes/api.php', apiPrefix: 'api')
| Laravel 10 and below: it is registered automatically by RouteServiceProvider.
|
| Protect everything with `->middleware('auth:sanctum')` once auth is wired
| up. `throttle:api` is applied by the api middleware group by default.
|
*/

Route::middleware(['throttle:api'])->group(function (): void {

    /*
    |----------------------------------------------------------------------
    | Areas
    |----------------------------------------------------------------------
    */
    Route::get('areas', [AreaController::class, 'index'])->name('areas.index');
    Route::post('areas', [AreaController::class, 'store'])->name('areas.store');
    Route::get('areas/{area}', [AreaController::class, 'show'])->name('areas.show');
    Route::match(['put', 'patch'], 'areas/{area}', [AreaController::class, 'update'])->name('areas.update');
    Route::delete('areas/{area}', [AreaController::class, 'destroy'])->name('areas.destroy');

    /*
    |----------------------------------------------------------------------
    | Parameters
    |----------------------------------------------------------------------
    | Nested for creation/listing (a parameter cannot exist without an area),
    | shallow for the rest so clients never need the parent id to update or
    | delete a known parameter.
    */
    Route::get('areas/{area}/parameters', [ParameterController::class, 'index'])->name('areas.parameters.index');
    Route::post('areas/{area}/parameters', [ParameterController::class, 'store'])->name('areas.parameters.store');

    Route::get('parameters/{parameter}', [ParameterController::class, 'show'])->name('parameters.show');
    Route::match(['put', 'patch'], 'parameters/{parameter}', [ParameterController::class, 'update'])->name('parameters.update');
    Route::delete('parameters/{parameter}', [ParameterController::class, 'destroy'])->name('parameters.destroy');

    /*
    |----------------------------------------------------------------------
    | Attachments (polymorphic)
    |----------------------------------------------------------------------
    | POST expects multipart/form-data with attachable_type (morph alias),
    | attachable_id and files[].
    |
    | The upload route gets its own tighter rate limiter - file writes are
    | far more expensive than ordinary JSON requests.
    */
    Route::get('attachments', [AttachmentController::class, 'index'])->name('attachments.index');
    Route::get('attachments/{file}', [AttachmentController::class, 'show'])->name('attachments.show');
    Route::post('attachments', [AttachmentController::class, 'store'])
        ->middleware('throttle:uploads')
        ->name('attachments.store');
    Route::delete('attachments/{file}', [AttachmentController::class, 'destroy'])->name('attachments.destroy');
});

/*
| PUT + multipart/form-data is not parsed by PHP. Clients updating an area or
| parameter *with files* should POST to the update URL with `_method=PUT` in
| the body (Laravel's method spoofing), or upload separately via
| POST /api/attachments.
*/
'@

Write-ProjectFile 'tests/Feature/AreaApiTest.php' @'
<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Area;
use App\Models\File;
use App\Models\Parameter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AreaApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_areas_with_nested_parameters_and_files(): void
    {
        $area = Area::factory()->has(Parameter::factory()->count(2), 'parameters')->create();

        $this->getJson('/api/areas')
            ->assertOk()
            ->assertJsonPath('data.0.id', $area->id)
            ->assertJsonPath('data.0.parameters_count', 2)
            ->assertJsonPath('meta.max_areas', Area::MAX_AREAS)
            ->assertJsonStructure(['data' => [['id', 'name', 'parameters' => [['id', 'name', 'files']], 'files']]]);
    }

    public function test_it_searches_across_areas_parameters_and_file_names(): void
    {
        $match = Area::factory()->create(['name' => 'Hydraulics']);
        Area::factory()->create(['name' => 'Electrical']);

        $withParameter = Area::factory()->create(['name' => 'Chassis']);
        Parameter::factory()->for($withParameter)->create(['name' => 'Hydraulics pressure']);

        $withFile = Area::factory()->create(['name' => 'Cabin']);
        File::factory()->forAttachable($withFile)->create(['file_name' => 'hydraulics-report.pdf']);

        $response = $this->getJson('/api/areas?search=hydraulics')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertEqualsCanonicalizing(
            [$match->id, $withParameter->id, $withFile->id],
            $ids
        );
    }

    public function test_it_sorts_by_whitelisted_columns_and_ignores_unknown_ones(): void
    {
        Area::factory()->create(['name' => 'Zulu']);
        Area::factory()->create(['name' => 'Alpha']);

        $this->getJson('/api/areas?sort_by=name&direction=asc')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Alpha');

        // Unknown column is rejected by the Form Request rather than executed.
        $this->getJson('/api/areas?sort_by=name;DROP TABLE areas')
            ->assertStatus(422)
            ->assertJsonValidationErrors('sort_by');
    }

    public function test_it_rejects_the_eleventh_area(): void
    {
        Area::factory()->count(Area::MAX_AREAS)->create();

        $this->postJson('/api/areas', ['name' => 'One too many'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');

        $this->assertDatabaseCount('areas', Area::MAX_AREAS);
    }

    public function test_the_model_guards_the_limit_outside_http(): void
    {
        Area::factory()->count(Area::MAX_AREAS)->create();

        $this->expectException(\App\Exceptions\AreaLimitReachedException::class);

        Area::create(['name' => 'Bypassing validation']);
    }

    public function test_it_attaches_files_polymorphically(): void
    {
        Storage::fake('public');

        $parameter = Parameter::factory()->create();

        $response = $this->postJson('/api/attachments', [
            'attachable_type' => 'parameter',
            'attachable_id' => $parameter->id,
            'files' => [UploadedFile::fake()->image('diagram.png')],
        ])->assertCreated();

        $path = $response->json('data.0.file_path');

        Storage::disk('public')->assertExists($path);
        $this->assertDatabaseHas('files', [
            'attachable_type' => 'parameter',
            'attachable_id' => $parameter->id,
            'file_name' => 'diagram.png',
        ]);
    }

    public function test_it_rejects_disallowed_mime_types(): void
    {
        Storage::fake('public');

        $area = Area::factory()->create();

        $this->postJson('/api/attachments', [
            'attachable_type' => 'area',
            'attachable_id' => $area->id,
            'files' => [UploadedFile::fake()->create('payload.php', 10, 'application/x-php')],
        ])->assertStatus(422)->assertJsonValidationErrors('files.0');
    }

    public function test_deleting_an_area_removes_parameters_attachments_and_blobs(): void
    {
        Storage::fake('public');

        $area = Area::factory()->create();
        $parameter = Parameter::factory()->for($area)->create();

        $this->postJson('/api/attachments', [
            'attachable_type' => 'area',
            'attachable_id' => $area->id,
            'files' => [UploadedFile::fake()->image('area.png')],
        ])->assertCreated();

        $this->postJson('/api/attachments', [
            'attachable_type' => 'parameter',
            'attachable_id' => $parameter->id,
            'files' => [UploadedFile::fake()->image('parameter.png')],
        ])->assertCreated();

        $paths = File::pluck('file_path')->all();

        $this->deleteJson("/api/areas/{$area->id}")->assertNoContent();

        $this->assertDatabaseCount('areas', 0);
        $this->assertDatabaseCount('parameters', 0);
        $this->assertDatabaseCount('files', 0);

        foreach ($paths as $path) {
            Storage::disk('public')->assertMissing($path);
        }
    }
}
'@


# ------------------------------------------------------------------ 4. database
Write-Step "Configuring the database (SQLite)"

$envPath = Join-Path $root '.env'
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $root '.env.example') $envPath
}

$sqlite = Join-Path $root 'database\database.sqlite'
if (-not (Test-Path $sqlite)) { New-Item -ItemType File -Path $sqlite -Force | Out-Null }

$envText = Get-Content $envPath -Raw
$envText = $envText -replace '(?m)^DB_CONNECTION=.*$', 'DB_CONNECTION=sqlite'
$envText = $envText -replace '(?m)^APP_URL=.*$',        'APP_URL=http://127.0.0.1:8000'
# Recent Laravel installers can ship a default .env pointing at a placeholder
# cloud Postgres instance (Supabase). DATABASE_URL/DB_URL, when present, take
# priority over the individual DB_* keys, so it has to be stripped too - not
# just the DB_HOST/DB_PORT/etc keys below.
foreach ($key in 'DB_URL','DATABASE_URL','DB_HOST','DB_PORT','DB_DATABASE','DB_USERNAME','DB_PASSWORD') {
    $envText = $envText -replace "(?m)^$key=.*$", "# $key="
}
[System.IO.File]::WriteAllText($envPath, $envText, (New-Object System.Text.UTF8Encoding($false)))

# Belt-and-braces: real process environment variables always win over .env,
# so force the connection here too in case anything upstream still resolves
# a cached or inherited DATABASE_URL.
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE   = $sqlite
Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:\DB_URL       -ErrorAction SilentlyContinue

php artisan config:clear
php artisan key:generate --force
php artisan storage:link
php artisan migrate --force
if ($LASTEXITCODE -ne 0) { throw "Migrations failed - check the error above." }

# --------------------------------------------------------------------- 5. tests
Write-Step "Running the test suite"
php artisan test

# --------------------------------------------------------------------- 6. done
Write-Step "Done"
Write-Host ""
Write-Host "  Start the API:    php artisan serve" -ForegroundColor Green
Write-Host "  Seed sample data: php artisan db:seed --class=Database\Seeders\AreaSeeder" -ForegroundColor Green
Write-Host ""
Write-Host "  GET  http://127.0.0.1:8000/api/areas" -ForegroundColor DarkGray
Write-Host "  POST http://127.0.0.1:8000/api/areas          (name, description, files[])" -ForegroundColor DarkGray
Write-Host "  POST http://127.0.0.1:8000/api/attachments    (attachable_type, attachable_id, files[])" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To use MySQL instead, set DB_CONNECTION=mysql and the DB_* keys in .env," -ForegroundColor DarkGray
Write-Host "  create the schema, then run: php artisan migrate:fresh" -ForegroundColor DarkGray
Write-Host ""
