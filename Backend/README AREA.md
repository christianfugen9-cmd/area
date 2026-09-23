# Areas / Parameters / Attachments API

A drop-in Laravel 11/12 backend (works on 10 with the notes below): three
tables, a hard ceiling of 10 areas, polymorphic attachments on the `public`
disk, and search + sort on every list endpoint.

## Install

Copy the `app/`, `database/`, `routes/` and `tests/` folders into your Laravel
project, then:

```bash
php artisan storage:link      # public/storage -> storage/app/public
php artisan migrate
php artisan db:seed --class=Database\\Seeders\\AreaSeeder   # optional
php artisan test
```

Merge `bootstrap/app-snippet.php` into your `bootstrap/app.php`, and make sure
`APP_URL` is correct — `Storage::disk('public')->url()` builds every attachment
URL from it.

**Laravel 10 and below:** move the route registration into
`RouteServiceProvider`, move the `withExceptions` closure into
`app/Exceptions/Handler.php::register()`, and change the `casts()` method on
`File` back to a `protected $casts` array.

## Endpoints

| Method | URI | Notes |
|---|---|---|
| GET | `/api/areas` | paginated, `?search=`, `?sort_by=`, `?direction=`, `?per_page=`; nests parameters + files |
| POST | `/api/areas` | 422 when the 10-area limit is reached; accepts `files[]` |
| GET | `/api/areas/{area}` | area + parameters + all attachments |
| PUT/PATCH | `/api/areas/{area}` | partial updates supported |
| DELETE | `/api/areas/{area}` | cascades to parameters, file rows and blobs |
| GET | `/api/areas/{area}/parameters` | paginated, searchable, sortable |
| POST | `/api/areas/{area}/parameters` | name unique within the area |
| GET/PUT/PATCH/DELETE | `/api/parameters/{parameter}` | shallow routes |
| GET | `/api/attachments` | `?search=`, `?attachable_type=`, `?attachable_id=` |
| POST | `/api/attachments` | `attachable_type`, `attachable_id`, `files[]` |
| DELETE | `/api/attachments/{file}` | deletes row + unlinks blob |

### Sortable columns

* Areas: `id`, `name`, `created_at`, `updated_at`, `parameters_count`, `files_count`
* Parameters: `id`, `name`, `created_at`, `updated_at`
* Attachments: `id`, `file_name`, `file_size`, `mime_type`, `created_at`, `updated_at`

Anything else returns a 422 from the Form Request, and the model scopes fall
back to `created_at` even if called directly — no user string ever reaches the
`ORDER BY` clause.

### Examples

```bash
curl "http://localhost/api/areas?search=hydraulics&sort_by=name&direction=asc&per_page=10"

curl -X POST http://localhost/api/areas \
  -H "Accept: application/json" \
  -F "name=Hydraulics" \
  -F "description=Pump and valve subsystem" \
  -F "files[]=@./spec.pdf"

curl -X POST http://localhost/api/attachments \
  -H "Accept: application/json" \
  -F "attachable_type=parameter" \
  -F "attachable_id=7" \
  -F "files[]=@./diagram.png" \
  -F "files[]=@./notes.pdf"

# Updating with files: PHP does not parse multipart on PUT — spoof the method.
curl -X POST http://localhost/api/areas/3 \
  -F "_method=PUT" -F "name=Hydraulics v2" -F "files[]=@./revised.pdf"
```

## Design decisions worth knowing

**The 10-area limit is enforced twice.** `App\Rules\WithinAreaLimit` gives API
clients a normal 422 validation payload. `Area::creating()` throws
`AreaLimitReachedException` and catches everything that bypasses HTTP —
seeders, queued jobs, tinker, console commands. Validation alone is not a
constraint; the model hook is what makes it one. Under heavy concurrency add a
`lockForUpdate()` count inside the transaction, or a trigger, if an 11th row
would genuinely be a business failure.

**Cascade deletes are done through Eloquent, not just the database.** The FK on
`parameters.area_id` uses `ON DELETE CASCADE`, which never fires model events —
so deleting an area that way would silently orphan rows in `files` and blobs on
disk. `Area::deleting()` therefore walks `parameters` and `files` and deletes
them as models. The FK stays as a safety net for direct SQL.

**Blob deletion is deferred to commit.** `File::deleted()` wraps the unlink in
`DB::afterCommit()`. If the surrounding transaction rolls back, the row is still
there — and so is its file. Outside a transaction it runs immediately.

**Uploads are rolled back on failure.** Writing to disk is not transactional, so
`FileUploadService` tracks every path it writes. Controllers call `commit()`
after the transaction succeeds and `rollback()` in the `catch` block, which
deletes the orphans. Without this a failed insert leaves garbage in storage
forever.

**`attachable_type` is a morph alias, never a class name.** `enforceMorphMap()`
in `AppServiceProvider` stores `area` / `parameter` in the column, and
`StoreAttachmentRequest::ATTACHABLE_TYPES` is an explicit whitelist. A client
cannot point the polymorphic relation at an arbitrary model. `attachable_id` is
then checked with `exists` against that type's own table.

**Uploads are validated on both extension and MIME.** `mimes:` checks the
guessed extension against the file's real reported type, `mimetypes:` checks the
type directly. A `payload.php` renamed to `.jpg` fails both. Filenames from the
client are only ever echoed back — the stored path always comes from Laravel's
hashed name.

**Search uses `whereHas`, not joins.** Joining areas → parameters → files would
duplicate rows and break the pagination count. `orWhereHas` keeps one row per
area. On large tables the correlated subqueries are the thing to watch; add
`FULLTEXT` indexes (or hand the search off to Scout/Meilisearch) before they
become a problem.

**N+1 protection is on.** `Model::preventLazyLoading()` outside production turns
any accidental lazy load into an exception during development and tests.

## Things deliberately left as hooks

* **Auth.** Every `authorize()` returns `true` with the policy call commented
  above it. Wire `auth:sanctum` onto the route group and swap them in.
* **Soft deletes.** Not used — the spec asked for physical cleanup, and the two
  do not combine well without a scheduled purge. Adding `SoftDeletes` means
  moving the disk cleanup to `forceDeleted`.
* **Private files.** Everything is on the `public` disk and therefore publicly
  reachable by URL. If attachments must be access-controlled, move them to the
  `local` disk and serve via a signed controller route — `File::temporaryUrl()`
  is already there for S3.
* **Name uniqueness.** `areas.name` is globally unique, `parameters.name` is
  unique per area. Both are single-line changes in the migrations if that is
  not what you want.
