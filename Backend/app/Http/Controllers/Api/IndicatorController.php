<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIndicatorRequest;
use App\Http\Requests\UpdateIndicatorRequest;
use App\Http\Resources\IndicatorResource;
use App\Models\Indicator;
use App\Models\Parameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class IndicatorController extends Controller
{
    /**
     * POST /api/parameters/{parameter}/indicators
     *
     * Creates a custom indicator under the given parameter.
     */
    public function store(StoreIndicatorRequest $request, Parameter $parameter): JsonResponse
    {
        $indicator = DB::transaction(function () use ($request, $parameter): Indicator {
            /** @var Indicator $indicator */
            $indicator = $parameter->indicators()->create($request->indicatorData());

            return $indicator;
        });

        $indicator->load('files');

        return IndicatorResource::make($indicator)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * PATCH /api/indicators/{indicator}
     */
    public function update(UpdateIndicatorRequest $request, Indicator $indicator): IndicatorResource
    {
        DB::transaction(function () use ($request, $indicator): void {
            $data = $request->indicatorData();

            if ($data !== []) {
                $indicator->update($data);
            }
        });

        $indicator->refresh()->load('files');

        return IndicatorResource::make($indicator);
    }

    /**
     * DELETE /api/indicators/{indicator}
     */
    public function destroy(Indicator $indicator): Response
    {
        DB::transaction(fn () => $indicator->delete());

        return response()->noContent();
    }
}
