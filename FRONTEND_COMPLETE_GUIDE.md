# Frontend Complete Build Guide (AACCUP)

Hand this to the frontend developer. It lists **everything needed to finish the client** against the current Laravel API (`Area` → `Parameter` → `Indicator` → `File`).

The older `FRONTEND_GUIDE.md` covers Areas / Parameters / Attachments only. **Use this file as the source of truth** for the full AACCUP evaluation UI.

---

## 0. Goal of the app

Build an AACCUP accreditation evaluation client where:

1. An **Area** is an accreditation area (max **10**).
2. A **Parameter** is a lettered parameter under an area (A, B, C…), which may be system or **custom**.
3. An **Indicator** is a rated checklist item under a parameter, grouped into three sections:
   - `SYSTEM_INPUTS`
   - `IMPLEMENTATION`
   - `OUTCOME`
4. **Scores** are computed by the backend:
   - `siom` — average of non-null ratings in `SYSTEM_INPUTS` + `OUTCOME` only
   - `parameter_mean` — average of all non-null ratings across every section
5. **Files** can attach to an area, parameter, or indicator.

The frontend does **not** recalculate SIOM / parameter mean — always display values from the API after create/update/delete of ratings.

---

## 1. Connection

| Setting | Value |
|--------|--------|
| Base API | `http://127.0.0.1:8000/api` |
| Storage URL | `http://127.0.0.1:8000/storage/` |
| Header on every request | `Accept: application/json` |

```bash
cd Backend
php artisan serve
php artisan storage:link   # once
```

---

## 2. TypeScript types (copy into the app)

```typescript
export type SectionType = "SYSTEM_INPUTS" | "IMPLEMENTATION" | "OUTCOME";
export type AttachableType = "area" | "parameter" | "indicator";

export interface FileAttachment {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  human_readable_size: string;
  mime_type: string;
  url: string;
  attachable_type: AttachableType;
  attachable_id: number;
  created_at: string;
  updated_at: string;
}

export interface Indicator {
  id: number;
  parameter_id: number;
  section_type: SectionType;
  code: string;              // e.g. "S.1", "1.1", "O.1"
  description: string;
  item_rating: number | null; // 0.00–5.00
  is_custom: boolean;
  files?: FileAttachment[];
  created_at: string;
  updated_at: string;
}

export interface Parameter {
  id: number;
  area_id: number;
  parameter_letter: string | null; // e.g. "A", "B"
  name: string;
  details: string | null;
  is_custom: boolean;
  siom: number | null;             // backend-computed
  parameter_mean: number | null;   // backend-computed
  files_count?: number;
  indicators_count?: number;
  indicators?: Indicator[];
  files?: FileAttachment[];
  area?: Area;
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: number;
  name: string;
  description: string | null;
  parameters_count?: number;
  files_count?: number;
  parameters?: Parameter[];
  files?: FileAttachment[];
  created_at: string;
  updated_at: string;
}

export interface PaginationLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

export interface PaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  path: string;
  per_page: number;
  to: number | null;
  total: number;
  max_areas?: number;
  remaining_slots?: number;
  filters?: {
    search: string | null;
    sort_by: string;
    direction: "asc" | "desc";
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  links: PaginationLinks;
  meta: PaginationMeta;
}

export interface SingleResponse<T> {
  data: T;
}
```

---

## 3. Screens she must build (completion checklist)

### Screen A — Areas dashboard
- [ ] List areas (`GET /api/areas`) with search + sort
- [ ] Show capacity: `meta.remaining_slots` / `meta.max_areas` (disable “Add Area” at 0)
- [ ] Create / edit / delete area
- [ ] Show parameter count + file count
- [ ] Navigate into an area

### Screen B — Area detail
- [ ] Show area name, description, area-level files
- [ ] List parameters (letter, name, `siom`, `parameter_mean`, indicator count)
- [ ] Add **standard** parameter (`is_custom: false`)
- [ ] Add **custom** parameter (`is_custom: true`, optional `parameter_letter`)
- [ ] Edit / delete parameter
- [ ] Upload/delete area attachments

### Screen C — Parameter evaluation (core AACCUP screen)
- [ ] Header: letter + name + live `siom` + `parameter_mean`
- [ ] Three section panels/tabs:
  - System Inputs
  - Implementation
  - Outcome
- [ ] Each section lists indicators: `code`, `description`, rating input (0–5), custom badge, files
- [ ] Inline edit rating → `PATCH /api/indicators/{id}` with `{ item_rating }`
- [ ] After every rating change, **re-fetch parameter** (or use returned data + parent refresh) so `siom` / `parameter_mean` update
- [ ] Add **custom indicator** per section (`POST /api/parameters/{id}/indicators`)
- [ ] Delete custom indicators (and optionally any indicator the product allows deleting)
- [ ] Attach evidence files to an indicator (`attachable_type: "indicator"`)

### Screen D — Attachments manager (shared component)
- [ ] Upload via `POST /api/attachments`
- [ ] Delete via `DELETE /api/attachments/{id}`
- [ ] Preview images; open docs via `file.url`
- [ ] Enforce client-side: max 10 files/request, 10 MB each, allowed extensions (see §6)

### Optional but recommended
- [ ] Empty states for no areas / no parameters / no indicators
- [ ] Confirm dialogs before destructive deletes (cascades wipe children + files)
- [ ] Loading + 422 validation error display
- [ ] Group indicators by `section_type` with stable section order:
  1. `SYSTEM_INPUTS`
  2. `IMPLEMENTATION`
  3. `OUTCOME`

---

## 4. API reference (full)

### A. Areas

| Action | Method | URL |
|--------|--------|-----|
| List | `GET` | `/api/areas?search=&sort_by=&direction=&per_page=` |
| Show | `GET` | `/api/areas/{id}` |
| Create | `POST` | `/api/areas` |
| Update | `PUT/PATCH` or `POST` + `_method=PUT` | `/api/areas/{id}` |
| Delete | `DELETE` | `/api/areas/{id}` → `204` |

**Create/update body:** `name` (required), `description` (optional), `files[]` (optional).

Nested on list/show: `parameters` (with `indicators` + scores) and `files`.

---

### B. Parameters

| Action | Method | URL |
|--------|--------|-----|
| List by area | `GET` | `/api/areas/{areaId}/parameters` |
| Create | `POST` | `/api/areas/{areaId}/parameters` |
| Show | `GET` | `/api/parameters/{id}` |
| Update | `PUT/PATCH` or `POST` + `_method=PUT` | `/api/parameters/{id}` |
| Delete | `DELETE` | `/api/parameters/{id}` → `204` |

**Create body:**

| Field | Rules |
|-------|--------|
| `name` | required, unique per area, max 255 |
| `details` | optional |
| `parameter_letter` | optional, max 10 (e.g. `"A"`) |
| `is_custom` | optional boolean (default `false`) |
| `files[]` | optional |

**Update body:** same fields as optional (`sometimes`), plus optional `area_id` to move.

**Response always includes:** `parameter_letter`, `is_custom`, `siom`, `parameter_mean`, and when loaded: `indicators`, `files`.

---

### C. Indicators (new — required for AACCUP)

| Action | Method | URL |
|--------|--------|-----|
| Create custom | `POST` | `/api/parameters/{parameterId}/indicators` |
| Update | `PATCH` (or `PUT`) | `/api/indicators/{id}` |
| Delete | `DELETE` | `/api/indicators/{id}` → `204` |

There is **no** list-indicators endpoint. Load indicators from:

- `GET /api/parameters/{id}` → `data.indicators`
- or nested under `GET /api/areas/{id}` → `data.parameters[].indicators`

#### Create custom indicator

```http
POST /api/parameters/{parameterId}/indicators
Content-Type: application/json
Accept: application/json

{
  "section_type": "SYSTEM_INPUTS",
  "code": "S.9",
  "description": "Additional custom criterion for this parameter.",
  "item_rating": null
}
```

| Field | Rules |
|-------|--------|
| `section_type` | required: `SYSTEM_INPUTS` \| `IMPLEMENTATION` \| `OUTCOME` |
| `code` | required, string, max 50 |
| `description` | required, string, max 5000 |
| `item_rating` | optional, number, **0–5** |

Backend always sets `is_custom: true` on create.

#### Update rating / text

```http
PATCH /api/indicators/{id}
Content-Type: application/json
Accept: application/json

{
  "item_rating": 4.25
}
```

Partial updates allowed: `code`, `description`, `item_rating`, `section_type`.

#### Example: rate then refresh scores

```typescript
await api.patch(`/indicators/${indicatorId}`, { item_rating: 4.5 });
const { data } = await api.get(`/parameters/${parameterId}`);
// use data.siom and data.parameter_mean in the header
```

---

### D. Attachments

| Action | Method | URL |
|--------|--------|-----|
| List | `GET` | `/api/attachments?attachable_type=&attachable_id=&search=` |
| Upload | `POST` | `/api/attachments` (`multipart/form-data`) |
| Delete | `DELETE` | `/api/attachments/{fileId}` → `204` |

**Upload fields:**

```text
attachable_type = area | parameter | indicator
attachable_id   = number
files[]         = one or more files
```

Example (evidence on an indicator):

```typescript
const form = new FormData();
form.append("attachable_type", "indicator");
form.append("attachable_id", String(indicatorId));
form.append("files[]", file);

await axios.post("/api/attachments", form, {
  headers: { Accept: "application/json" },
});
```

---

## 5. Scoring rules (display correctly)

| Field | Formula (backend) | UI tip |
|-------|-------------------|--------|
| `item_rating` | Single indicator score 0–5, or `null` if not rated | Use a 0–5 stepper/slider; allow clearing to unrated |
| `siom` | Avg of non-null ratings where section is `SYSTEM_INPUTS` or `OUTCOME` | Label: **SIOM** |
| `parameter_mean` | Avg of all non-null ratings in all three sections | Label: **Parameter Mean** |

- `null` score → show `—` or `Not rated` (do not show `0` unless rating is actually `0`).
- Implementation ratings affect **parameter mean only**, not SIOM.
- Round display to **2 decimal places** if you format client-side; API already rounds to 2.

---

## 6. Hard rules & gotchas

1. **10-area cap** — disable create when `meta.remaining_slots === 0`.
2. **Method spoofing** — updating area/parameter **with files** must be `POST` + `_method=PUT` (PHP does not parse multipart on PUT). Prefer rating updates via JSON `PATCH` (no spoof needed).
3. **Uploads** — max **10 files** per request, **10 MB** each. Allowed: images (`jpg jpeg png webp gif svg`), docs (`pdf doc docx xls xlsx ppt pptx csv txt`), `zip`.
4. **Cascading deletes** — deleting an area removes parameters, indicators, and files. Confirm in UI.
5. **Custom vs system** — show a badge for `is_custom === true`. Custom indicators are created only via the indicator POST endpoint.
6. **No auth yet** — Sanctum is stubbed; no token required for local/dev.

---

## 7. Suggested route map (React / Vue / etc.)

```text
/                     → Areas dashboard
/areas/:areaId        → Area detail (parameters list + area files)
/parameters/:id        → Parameter evaluation (3 sections + scores + evidence)
```

Suggested component tree:

```text
App
├── AreasPage
│   ├── AreaCapacityBar
│   ├── AreaCard
│   └── AreaFormModal
├── AreaDetailPage
│   ├── ParameterTable (letter, name, siom, mean)
│   ├── ParameterFormModal (supports is_custom + parameter_letter)
│   └── AttachmentPanel (attachable_type="area")
└── ParameterEvaluationPage
    ├── ScoreSummary (siom, parameter_mean)
    ├── SectionPanel (section_type)
    │   ├── IndicatorRow (rating editor)
    │   ├── AddCustomIndicatorForm
    │   └── AttachmentPanel (attachable_type="indicator")
    └── AttachmentPanel (attachable_type="parameter")
```

---

## 8. Definition of done

The frontend is **complete** when a user can:

1. Manage up to 10 areas with search/sort and attachments  
2. Add standard and custom parameters (with letter) under an area  
3. Open a parameter and see indicators grouped into the three AACCUP sections  
4. Add custom indicators, edit ratings (0–5), and see **SIOM** + **Parameter Mean** update from the API  
5. Attach/delete evidence files on area, parameter, and indicator  
6. Handle 422 validation errors and the 10-area limit cleanly  

---

## 9. Quick curl smoke tests

```bash
# Create area
curl -X POST http://127.0.0.1:8000/api/areas -H "Accept: application/json" -d "name=Area I&description=VMGO"

# Create parameter
curl -X POST http://127.0.0.1:8000/api/areas/1/parameters -H "Accept: application/json" ^
  -d "name=Vision and Mission&parameter_letter=A&is_custom=0"

# Add custom indicator
curl -X POST http://127.0.0.1:8000/api/parameters/1/indicators -H "Accept: application/json" ^
  -H "Content-Type: application/json" ^
  -d "{\"section_type\":\"SYSTEM_INPUTS\",\"code\":\"S.1\",\"description\":\"VMGO disseminated\",\"item_rating\":4}"

# Rate indicator
curl -X PATCH http://127.0.0.1:8000/api/indicators/1 -H "Accept: application/json" ^
  -H "Content-Type: application/json" -d "{\"item_rating\":4.5}"

# Read scores
curl http://127.0.0.1:8000/api/parameters/1 -H "Accept: application/json"
```

On PowerShell, prefer `Invoke-RestMethod` or a REST client if `^` line continuation is awkward.

---

**Related:** `FRONTEND_GUIDE.md` (older Areas/Parameters/Attachments contract) · Backend docs in `Backend/BACKEND_DOCUMENTATION.md` and `Backend/README AREA.md`.
