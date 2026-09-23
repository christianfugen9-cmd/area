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
            ->withCount(['files', 'indicators'])
            ->with(['files', 'indicators.files'])
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

        $parameter->loadCount(['files', 'indicators'])->load(['files', 'indicators.files']);

        return ParameterResource::make($parameter)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/parameters/{parameter}
     */
    public function show(Parameter $parameter): ParameterResource
    {
        $parameter->loadCount(['files', 'indicators'])->load(['files', 'indicators.files', 'area']);

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

        $parameter->refresh()->loadCount(['files', 'indicators'])->load(['files', 'indicators.files']);

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