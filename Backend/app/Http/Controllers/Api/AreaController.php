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
                'parameters' => fn ($query) => $query
                    ->with(['files', 'indicators.files'])
                    ->withCount(['files', 'indicators'])
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

            $this->uploads->commit();
        } catch (Throwable $e) {
            $this->uploads->rollback();

            throw $e;
        }

        $area->loadCount(['parameters', 'files'])
            ->load(['parameters.files', 'parameters.indicators.files', 'files']);

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
                'parameters' => fn ($query) => $query
                    ->with(['files', 'indicators.files'])
                    ->withCount(['files', 'indicators'])
                    ->orderBy('name'),
            ]);

        return AreaResource::make($area);
    }

    /**
     * PUT|PATCH /api/areas/{area}
     */
    public function update(
        UpdateAreaRequest $request,
        Area $area
    ): AreaResource {
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
            ->load(['parameters.files', 'parameters.indicators.files', 'files']);

        return AreaResource::make($area);
    }

    /**
     * DELETE /api/areas/{area}
     */
    public function destroy(Area $area): Response
    {
        DB::transaction(fn() => $area->delete());

        return response()->noContent();
    }
}