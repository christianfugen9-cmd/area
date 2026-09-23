<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * @property int         $id
 * @property int         $parameter_id
 * @property string      $section_type
 * @property string      $code
 * @property string      $description
 * @property float|null  $item_rating
 * @property bool        $is_custom
 */
class Indicator extends Model
{
    use HasFactory;

    public const SECTION_SYSTEM_INPUTS = 'SYSTEM_INPUTS';

    public const SECTION_IMPLEMENTATION = 'IMPLEMENTATION';

    public const SECTION_OUTCOME = 'OUTCOME';

    /** @var list<string> */
    public const SECTION_TYPES = [
        self::SECTION_SYSTEM_INPUTS,
        self::SECTION_IMPLEMENTATION,
        self::SECTION_OUTCOME,
    ];

    /** Sections that contribute to the SIOM score. */
    public const SIOM_SECTIONS = [
        self::SECTION_SYSTEM_INPUTS,
        self::SECTION_OUTCOME,
    ];

    /** @var list<string> */
    protected $fillable = [
        'parameter_id',
        'section_type',
        'code',
        'description',
        'item_rating',
        'is_custom',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'item_rating' => 'float',
            'is_custom' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (self $indicator): void {
            $indicator->loadMissing('files');
            $indicator->files->each->delete();
        });
    }

    // ---------------------------------------------------------------------
    // Relationships
    // ---------------------------------------------------------------------

    /** @return BelongsTo<Parameter, Indicator> */
    public function parameter(): BelongsTo
    {
        return $this->belongsTo(Parameter::class);
    }

    /** @return MorphMany<File> */
    public function files(): MorphMany
    {
        return $this->morphMany(File::class, 'attachable');
    }

    public static function morphAlias(): string
    {
        return (new static)->getMorphClass();
    }
}
