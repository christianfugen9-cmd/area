<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AreaController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\IndicatorController;
use App\Http\Controllers\Api\ParameterController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Laravel 11/12: this file is registered from bootstrap/app.php via
|     ->withRouting(api: __DIR__.'/../routes/api.php', apiPrefix: 'api')
| Laravel 10 and below: it is registered automatically by RouteServiceProvider.
|
| Protect everything with `->middleware('auth:sanctum')` once auth is wired
| up. `throttle:api` is applied by the api middleware group by default.
|
*/

Route::middleware(['throttle:api'])->group(function (): void {

    /*
    |----------------------------------------------------------------------
    | Areas
    |----------------------------------------------------------------------
    */
    Route::get('areas', [AreaController::class, 'index'])->name('areas.index');
    Route::post('areas', [AreaController::class, 'store'])->name('areas.store');
    Route::get('areas/{area}', [AreaController::class, 'show'])->name('areas.show');
    Route::match(['put', 'patch'], 'areas/{area}', [AreaController::class, 'update'])->name('areas.update');
    Route::delete('areas/{area}', [AreaController::class, 'destroy'])->name('areas.destroy');

    /*
    |----------------------------------------------------------------------
    | Parameters
    |----------------------------------------------------------------------
    | Nested for creation/listing (a parameter cannot exist without an area),
    | shallow for the rest so clients never need the parent id to update or
    | delete a known parameter.
    */
    Route::get('areas/{area}/parameters', [ParameterController::class, 'index'])->name('areas.parameters.index');
    Route::post('areas/{area}/parameters', [ParameterController::class, 'store'])->name('areas.parameters.store');

    Route::get('parameters/{parameter}', [ParameterController::class, 'show'])->name('parameters.show');
    Route::match(['put', 'patch'], 'parameters/{parameter}', [ParameterController::class, 'update'])->name('parameters.update');
    Route::delete('parameters/{parameter}', [ParameterController::class, 'destroy'])->name('parameters.destroy');

    /*
    |----------------------------------------------------------------------
    | Indicators (AACCUP evaluation items under a parameter)
    |----------------------------------------------------------------------
    | Nested create keeps ownership explicit; shallow update/delete so the
    | client only needs the indicator id once it exists.
    */
    Route::post('parameters/{parameter}/indicators', [IndicatorController::class, 'store'])
        ->name('parameters.indicators.store');
    Route::match(['put', 'patch'], 'indicators/{indicator}', [IndicatorController::class, 'update'])
        ->name('indicators.update');
    Route::delete('indicators/{indicator}', [IndicatorController::class, 'destroy'])
        ->name('indicators.destroy');

    /*
    |----------------------------------------------------------------------
    | Attachments (polymorphic)
    |----------------------------------------------------------------------
    | POST expects multipart/form-data with attachable_type (morph alias),
    | attachable_id and files[].
    |
    | The upload route gets its own tighter rate limiter - file writes are
    | far more expensive than ordinary JSON requests.
    */
    Route::get('attachments', [AttachmentController::class, 'index'])->name('attachments.index');
    Route::get('attachments/{file}', [AttachmentController::class, 'show'])->name('attachments.show');
    Route::post('attachments', [AttachmentController::class, 'store'])
        ->middleware('throttle:uploads')
        ->name('attachments.store');
    Route::delete('attachments/{file}', [AttachmentController::class, 'destroy'])->name('attachments.destroy');
});

/*
| PUT + multipart/form-data is not parsed by PHP. Clients updating an area or
| parameter *with files* should POST to the update URL with `_method=PUT` in
| the body (Laravel's method spoofing), or upload separately via
| POST /api/attachments.
*/