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