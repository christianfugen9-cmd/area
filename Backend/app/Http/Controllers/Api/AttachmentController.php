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