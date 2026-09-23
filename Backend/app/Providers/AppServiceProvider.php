<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\Area;
use App\Models\File;
use App\Models\Indicator;
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
         *  1. `files.attachable_type` stores morph aliases instead of a
         *     fully-qualified class name, so refactoring a namespace does not
         *     require a data migration.
         *  2. POST /api/attachments accepts these aliases from the client,
         *     which means an attacker cannot point `attachable_type` at an
         *     arbitrary class.
         */
        Relation::enforceMorphMap([
            'area' => Area::class,
            'parameter' => Parameter::class,
            'indicator' => Indicator::class,
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