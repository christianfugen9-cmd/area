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