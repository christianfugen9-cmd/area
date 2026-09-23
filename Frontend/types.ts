export type SectionType = "SYSTEM_INPUTS" | "IMPLEMENTATION" | "OUTCOME";
export type AttachableType = "area" | "parameter" | "indicator";

export interface FileAttachment {
  id: number; file_name: string; file_path: string; file_size: number;
  human_readable_size: string; mime_type: string; url: string;
  attachable_type: AttachableType; attachable_id: number;
  created_at: string; updated_at: string;
}
export interface Indicator {
  id: number; parameter_id: number; section_type: SectionType; code: string;
  description: string; item_rating: number | null; is_custom: boolean;
  files?: FileAttachment[]; created_at: string; updated_at: string;
}
export interface Parameter {
  id: number; area_id: number; parameter_letter: string | null; name: string;
  details: string | null; is_custom: boolean; siom: number | null;
  parameter_mean: number | null; files_count?: number; indicators_count?: number;
  indicators?: Indicator[]; files?: FileAttachment[]; area?: Area;
  created_at: string; updated_at: string;
}
export interface Area {
  id: number; name: string; description: string | null;
  parameters_count?: number; files_count?: number; parameters?: Parameter[];
  files?: FileAttachment[]; created_at: string; updated_at: string;
}
export interface PaginatedResponse<T> {
  data: T[];
  links: { first: string; last: string; prev: string | null; next: string | null };
  meta: {
    current_page: number; from: number | null; last_page: number;
    path: string; per_page: number; to: number | null; total: number;
    max_areas?: number; remaining_slots?: number;
    filters?: { search: string | null; sort_by: string; direction: "asc" | "desc" };
  };
}
export interface SingleResponse<T> { data: T; }

export interface FacultyMember {
  id: string;
  name: string;
  title: string;
  rank: "Professor" | "Associate Professor" | "Assistant Professor" | "Instructor" | "Lecturer";
  rank_detail?: string;
  department: string;
  college: string;
  highest_degree: "Doctorate" | "Master's" | "Baccalaureate";
  degree_detail: string;
  employment_status: "Full-Time Permanent" | "Full-Time Temporary" | "Part-Time" | "Adjunct";
  teaching_load: number;
  prc_license?: string;
  email: string;
  specialization: string;
  student_eval_rating?: number;
  publications_count?: number;
  notes?: string;
}

export interface FacultyCategory {
  letter: string;
  name: string;
  shortName: string;
  description: string;
  benchmarkStatement: string;
  evidenceRequired: string[];
  metricsSummary: string;
  complianceRating?: number;
  status: "Compliant" | "Substantially Compliant" | "Under Review";
}
