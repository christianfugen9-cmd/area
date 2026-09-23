import axios from "axios";
import type { Area, Parameter, Indicator, AttachableType } from "./types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api",
  headers: { Accept: "application/json" },
});

export function apiErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (!axios.isAxiosError(error)) return fallback;
  const data = error.response?.data as any;
  if (error.response?.status === 422) {
    const errors = data?.errors ?? {};
    const messages = Object.entries(errors)
      .flatMap(([field, value]) => (Array.isArray(value) ? value : [String(value)]).map((m) => `${field}: ${m}`));
    return messages.length ? messages.join(" ") : (data?.message ?? "Please check the highlighted fields.");
  }
  if (error.response?.status === 413) return "The upload is too large. Each file must be 10 MB or less.";
  return data?.message ?? fallback;
}

export const endpoints = {
  areas: async (params: Record<string,string|number>) => (await api.get("/areas", { params })).data,
  area: async (id:number) => (await api.get(`/areas/${id}`)).data.data as Area,
  createArea: async (body: FormData | object) => (await api.post("/areas", body, body instanceof FormData ? {headers: {"Content-Type":"multipart/form-data"}} : undefined)).data.data as Area,
  updateArea: async (id:number, body: FormData | object) => (await api.post(`/areas/${id}`, body, body instanceof FormData ? {headers: {"Content-Type":"multipart/form-data"}} : undefined)).data.data as Area,
  deleteArea: async (id:number) => api.delete(`/areas/${id}`),
  parameters: async (areaId:number) => (await api.get(`/areas/${areaId}/parameters`)).data,
  parameter: async (id:number) => (await api.get(`/parameters/${id}`)).data.data as Parameter,
  createParameter: async (areaId:number, body: FormData | object) => (await api.post(`/areas/${areaId}/parameters`, body, body instanceof FormData ? {headers: {"Content-Type":"multipart/form-data"}} : undefined)).data.data as Parameter,
  updateParameter: async (id:number, body: FormData | object) => (await api.post(`/parameters/${id}`, body, body instanceof FormData ? {headers: {"Content-Type":"multipart/form-data"}} : undefined)).data.data as Parameter,
  deleteParameter: async (id:number) => api.delete(`/parameters/${id}`),
  createIndicator: async (parameterId:number, body:object) => (await api.post(`/parameters/${parameterId}/indicators`, body)).data.data as Indicator,
  updateIndicator: async (id:number, body:object) => (await api.patch(`/indicators/${id}`, body)).data.data,
  deleteIndicator: async (id:number) => api.delete(`/indicators/${id}`),
  upload: async (type:AttachableType, id:number, files:File[]) => {
    const form = new FormData();
    form.append("attachable_type", type); form.append("attachable_id", String(id));
    files.forEach(f => form.append("files[]", f));
    return (await api.post("/attachments", form, {headers: {"Content-Type":"multipart/form-data"}})).data;
  },
  deleteAttachment: async (id:number) => api.delete(`/attachments/${id}`),
};
