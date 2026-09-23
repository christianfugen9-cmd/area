<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Collection;

/**
 * @property int         $id
 * @property int         $area_id
 * @property string|null $parameter_letter
 * @property string      $name
 * @property string|null $details
 * @property bool        $is_custom
 * @property-read float|null $siom
 * @property-read float|null $parameter_mean
 */
class Parameter extends Model
{
    use HasFactory;

    /** @var list<string> */
    protected $fillable = [
        'area_id',
        'parameter_letter',
        'name',
        'details',
        'is_custom',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_custom' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (self $parameter): void {
            // Cascade through Eloquent so Indicator/File deleted hooks unlink blobs.
            $parameter->loadMissing(['files', 'indicators.files']);
            $parameter->indicators->each->delete();
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

    /** @return HasMany<Indicator> */
    public function indicators(): HasMany
    {
        return $this->hasMany(Indicator::class);
    }

    /** @return MorphMany<File> */
    public function files(): MorphMany
    {
        return $this->morphMany(File::class, 'attachable');
    }

    // ---------------------------------------------------------------------
    // Scoring accessors (AACCUP)
    // ---------------------------------------------------------------------

    /**
     * SIOM = mean of non-null item ratings in SYSTEM_INPUTS and OUTCOME only.
     */
    protected function siom(): Attribute
    {
        return Attribute::get(function (): ?float {
            return $this->averageRating(
                $this->ratedIndicators()->whereIn('section_type', Indicator::SIOM_SECTIONS)
            );
        })->shouldCache();
    }

    /**
     * Parameter mean = mean of all non-null item ratings across every section.
     */
    protected function parameterMean(): Attribute
    {
        return Attribute::get(function (): ?float {
            return $this->averageRating($this->ratedIndicators());
        })->shouldCache();
    }

    /**
     * @return Collection<int, Indicator>
     */
    private function ratedIndicators(): Collection
    {
        $indicators = $this->relationLoaded('indicators')
            ? $this->indicators
            : $this->indicators()->get();

        return $indicators->filter(fn (Indicator $indicator): bool => $indicator->item_rating !== null);
    }

    /**
     * @param  Collection<int, Indicator>  $indicators
     */
    private function averageRating(Collection $indicators): ?float
    {
        if ($indicators->isEmpty()) {
            return null;
        }

        return round((float) $indicators->avg('item_rating'), 2);
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
                ->orWhere('parameters.parameter_letter', 'LIKE', $like)
                ->orWhereHas('area', fn (Builder $a) => $a->where('areas.name', 'LIKE', $like))
                ->orWhereHas('files', fn (Builder $f) => $f->where('files.file_name', 'LIKE', $like))
                ->orWhereHas('indicators', function (Builder $i) use ($like): void {
                    $i->where('indicators.code', 'LIKE', $like)
                        ->orWhere('indicators.description', 'LIKE', $like);
                });
        });
    }

    /**
     * @param  Builder<Parameter>  $query
     * @return Builder<Parameter>
     */
    public function scopeSort(Builder $query, ?string $column = null, ?string $direction = null): Builder
    {
        $sortable = ['id', 'name', 'parameter_letter', 'created_at', 'updated_at'];

        $column = in_array($column, $sortable, true) ? $column : 'created_at';
        $direction = strtolower((string) $direction) === 'desc' ? 'desc' : 'asc';

        return $query->orderBy("parameters.{$column}", $direction);
    }
}
