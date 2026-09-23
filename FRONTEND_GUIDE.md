# Frontend Developer Guide & API Contract

This document contains everything the frontend developer needs to build the client application and integrate with the Areas / Parameters / Attachments API.

---

## 1. Local Server & Connection

- **Base API URL:** `http://127.0.0.1:8000/api`
- **Storage Asset URL:** `http://127.0.0.1:8000/storage/`
- **Starting Backend Server:**
  ```bash
  cd Backend
  php artisan serve
  ```
- **Storage Symlink (One-time backend setup if not done):**
  ```bash
  php artisan storage:link
  ```
- **Required HTTP Headers on every request:**
  ```http
  Accept: application/json
  ```
  _(If using `axios`, set `axios.defaults.headers.common['Accept'] = 'application/json';`)_

---

## 2. TypeScript Data Interfaces

```typescript
export interface FileAttachment {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  human_readable_size: string; // e.g. "1.45 MB", "512 B"
  mime_type: string;
  url: string; // Fully qualified URL to access/download the file
  attachable_type: "area" | "parameter";
  attachable_id: number;
  created_at: string; // ISO 8601 string
  updated_at: string;
}

export interface Parameter {
  id: number;
  area_id: number;
  name: string;
  details: string | null;
  files_count?: number;
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
  max_areas?: number; // Only on /api/areas list (Always 10)
  remaining_slots?: number; // Only on /api/areas list (0 to 10)
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

## 3. Endpoints & API Reference

### A. Areas (`/api/areas`)

#### 1. List Areas

- **Method:** `GET`
- **URL:** `/api/areas`
- **Query Parameters:**
  - `search` _(string, optional)_: Free-text search across area names, descriptions, parameter names, and file names.
  - `sort_by` _(string, optional)_: One of `id`, `name`, `created_at`, `updated_at`, `parameters_count`, `files_count`. (Default: `created_at`).
  - `direction` _(string, optional)_: `asc` or `desc`. (Default: `asc`).
  - `per_page` _(integer, optional)_: Number of items per page (e.g. `10`, `15`).
- **Response Status:** `200 OK`
- **Response Body:** `PaginatedResponse<Area>`
  - Note: Each area item includes nested `files` and `parameters` (with their own nested `files`).
  - Note: `meta.remaining_slots` tells you how many more areas can be added before hitting the 10-area limit.

#### 2. Get Area Detail

- **Method:** `GET`
- **URL:** `/api/areas/{areaId}`
- **Response Status:** `200 OK`
- **Response Body:** `SingleResponse<Area>`

#### 3. Create Area

- **Method:** `POST`
- **URL:** `/api/areas`
- **Content-Type:** `multipart/form-data` or `application/json` (use `multipart/form-data` if uploading files)
- **Payload:**
  - `name` _(string, required, unique, max 255)_
  - `description` _(string, optional, max 5000)_
  - `files[]` _(File[], optional, up to 10 files)_
- **Response Status:** `201 Created`
- **Error Status:** `422 Unprocessable Entity` (if name is missing, duplicate, or the 10-area limit is reached)

#### 4. Update Area

- **Method:** `POST` with `_method=PUT` _(see Method Spoofing note below)_
- **URL:** `/api/areas/{areaId}`
- **Content-Type:** `multipart/form-data` or `application/json`
- **Payload:**
  - `_method`: `"PUT"` _(when using multipart/form-data)_
  - `name` _(string, optional)_
  - `description` _(string, optional)_
  - `files[]` _(File[], optional, new files to append)_
- **Response Status:** `200 OK`

#### 5. Delete Area

- **Method:** `DELETE`
- **URL:** `/api/areas/{areaId}`
- **Response Status:** `204 No Content`
- **Behavior:** Cascades deletion to all child parameters, attachments, and disk blobs.

---

### B. Parameters (`/api/areas/{areaId}/parameters` & `/api/parameters/{parameterId}`)

#### 1. List Parameters of an Area

- **Method:** `GET`
- **URL:** `/api/areas/{areaId}/parameters`
- **Query Parameters:**
  - `search` _(string, optional)_
  - `sort_by` _(string, optional)_: One of `id`, `name`, `created_at`, `updated_at`.
  - `direction` _(string, optional)_: `asc` or `desc`.
  - `per_page` _(integer, optional)_
- **Response Status:** `200 OK`
- **Response Body:** `PaginatedResponse<Parameter>`

#### 2. Create Parameter for an Area

- **Method:** `POST`
- **URL:** `/api/areas/{areaId}/parameters`
- **Content-Type:** `multipart/form-data` or `application/json`
- **Payload:**
  - `name` _(string, required, unique per area)_
  - `details` _(string, optional)_
  - `files[]` _(File[], optional, up to 10 files)_
- **Response Status:** `201 Created`

#### 3. Get Parameter Detail (Shallow Route)

- **Method:** `GET`
- **URL:** `/api/parameters/{parameterId}`
- **Response Status:** `200 OK`

#### 4. Update Parameter (Shallow Route)

- **Method:** `POST` with `_method=PUT`
- **URL:** `/api/parameters/{parameterId}`
- **Payload:**
  - `_method`: `"PUT"`
  - `name` _(string, optional)_
  - `details` _(string, optional)_
  - `files[]` _(File[], optional)_
- **Response Status:** `200 OK`

#### 5. Delete Parameter (Shallow Route)

- **Method:** `DELETE`
- **URL:** `/api/parameters/{parameterId}`
- **Response Status:** `204 No Content`

---

### C. Standalone Attachments (`/api/attachments`)

#### 1. List Attachments

- **Method:** `GET`
- **URL:** `/api/attachments`
- **Query Parameters:**
  - `attachable_type` _(string, optional)_: `'area'` or `'parameter'`
  - `attachable_id` _(integer, optional)_: ID of the area or parameter
  - `search` _(string, optional)_: Filter by file name or mime type
  - `sort_by` _(string, optional)_: `id`, `file_name`, `file_size`, `mime_type`, `created_at`, `updated_at`
  - `direction` _(string, optional)_: `asc` or `desc`

#### 2. Direct Upload to an Area or Parameter

- **Method:** `POST`
- **URL:** `/api/attachments`
- **Content-Type:** `multipart/form-data`
- **Payload:**
  - `attachable_type`: `"area"` | `"parameter"`
  - `attachable_id`: integer ID
  - `files[]`: file upload objects
- **Response Status:** `201 Created`

#### 3. Delete an Attachment

- **Method:** `DELETE`
- **URL:** `/api/attachments/{fileId}`
- **Response Status:** `204 No Content`
- **Behavior:** Removes database row and physically deletes file from disk.

---

## 4. Crucial Implementation Rules & Gotchas

### 1. Hard Ceiling of 10 Areas

- Total areas cannot exceed 10.
- When attempting to create an 11th area, the API returns `422 Unprocessable Entity`:
  ```json
  {
    "message": "The system limit of 10 areas has been reached. Delete an existing area before creating a new one.",
    "errors": {
      "name": [
        "The system limit of 10 areas has been reached. Delete an existing area before creating a new one."
      ]
    }
  }
  ```
- **Frontend Best Practice:**
  Inspect `response.meta.remaining_slots`. When `meta.remaining_slots === 0`, disable the "Add Area" button and show an indicator (e.g. `10 / 10 Areas used`).

### 2. Method Spoofing for File Upload Updates

- Standard PHP backends do not parse `multipart/form-data` payloads sent via HTTP `PUT` or `PATCH`.
- When updating an Area or Parameter and attaching new files, **send a `POST` request with `_method: 'PUT'`**:

  ```typescript
  const formData = new FormData();
  formData.append("_method", "PUT");
  formData.append("name", "Updated Area Name");
  if (selectedFiles) {
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append("files[]", selectedFiles[i]);
    }
  }

  await axios.post(`/api/areas/${areaId}`, formData);
  ```

### 3. Upload Restrictions Whitelist

- **Maximum files per request:** 10 files
- **Maximum size per file:** 10 MB (10,240 KB)
- **Allowed file extensions:**
  - Images: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg`
  - Documents: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.csv`, `.txt`
  - Archives: `.zip`
- Any violation returns a clean 422 error detailing which file failed validation.

---

## 5. Recommended UI Architecture & Screens

1. **Dashboard / Area Overview:**
   - **Top Banner:** Capacity meter showing used slots out of 10 (e.g. `ProgressBar: 4/10`).
   - **Controls Bar:** Search bar (triggers `?search=`), sort selector, and "+ Add Area" modal trigger.
   - **Area Cards:**
     - Name and description
     - Parameter count badge
     - Attachment count badge
     - Quick action menu: Edit, Delete, View Details.

2. **Area Detail Screen:**
   - **Header:** Area Name, Description, Edit Area button, Delete Area button.
   - **Tab 1 - Parameters:**
     - List of parameters belonging to this area.
     - Add Parameter button with modal (inputs: Name, Details, File Attachments).
     - Edit / Delete individual parameters.
   - **Tab 2 - Attachments:**
     - Grid/table of files directly attached to the area.
     - File preview thumbnail (if image) or file type icon (PDF, Word, Excel, etc.).
     - File size (pre-formatted via `human_readable_size`).
     - Download button (`href={file.url}` target="\_blank").
     - Delete file button.
     - Drag-and-drop file upload zone.
