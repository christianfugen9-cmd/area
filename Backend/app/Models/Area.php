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