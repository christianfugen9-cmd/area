import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, ChevronDown, ChevronRight, ClipboardCheck, Eye, FileText, FolderOpen, GraduationCap, Lock, LogOut, Loader2, Plus, Search, Settings2, Trash2, Upload, X } from "lucide-react";
import { endpoints, apiErrorMessage } from "./api";
import type { Area, Parameter, Indicator, SectionType, AttachableType, FileAttachment } from "./types";
import { FacultyPage, FACULTY_CATEGORIES } from "./faculty";
import "./styles.css";

export const AACCUP_AREAS = [
  { num: 1, label: "AREA I" },
  { num: 2, label: "AREA II" },
  { num: 3, label: "AREA III" },
  { num: 4, label: "AREA IV" },
  { num: 5, label: "AREA V" },
  { num: 6, label: "AREA VI" },
  { num: 7, label: "AREA VII" },
  { num: 8, label: "AREA VIII" },
  { num: 9, label: "AREA IX" },
  { num: 10, label: "AREA X" },
];

const sections: { key: SectionType; label: string; short: string }[] = [
  { key: "SYSTEM_INPUTS", label: "System Inputs", short: "SI" },
  { key: "IMPLEMENTATION", label: "Implementation", short: "IM" },
  { key: "OUTCOME", label: "Outcome", short: "OC" },
];

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 4200); return () => clearTimeout(t) }, [message]);
  return { message, setMessage };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isAreasActive = location.pathname === "/" || location.pathname.startsWith("/areas") || location.pathname.startsWith("/parameters");
  const isFacultyActive = location.pathname.startsWith("/faculty");
  const currentCategory = searchParams.get("category")?.toUpperCase();
  const areaMatch = location.pathname.match(/\/areas\/(\d+)/);
  const currentAreaNum = searchParams.get("area") ? Number(searchParams.get("area")) : (areaMatch ? Number(areaMatch[1]) : null);

  const [areasOpen, setAreasOpen] = useState(true);
  const [facultyOpen, setFacultyOpen] = useState(true);

  return <div className="app-shell">
    <aside className="sidebar glass">
      <Link className="brand" to="/"><span className="brand-mark"><ClipboardCheck size={19} /></span><span>AACCUP<span> Evaluate</span></span></Link>
      <nav>
        {/* ── AREAS ── */}
        <div className="nav-group">
          <div className={`nav-top-row ${isAreasActive ? "active" : ""}`}>
            <Link
              to="/"
              className="nav-top-link"
              onClick={() => setAreasOpen(true)}
              title="View all areas"
            >
              <FolderOpen size={17} />
              <span>Areas</span>
              <span className="nav-pill">10</span>
            </Link>
            <button
              type="button"
              className="nav-toggle-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAreasOpen(!areasOpen);
              }}
              title={areasOpen ? "Minimize all areas" : "Expand all areas"}
              aria-label="Toggle all areas"
            >
              {areasOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          </div>
          {areasOpen && (
            <div className="nav-sub">
              {AACCUP_AREAS.map(a => (
                <Link
                  key={a.num}
                  to={`/areas/${a.num}`}
                  className={`nav-sub-item ${currentAreaNum === a.num ? "active-sub" : ""}`}
                  title={a.label}
                >
                  <span className="cat-letter">{a.num}</span>
                  <span className="cat-label">{a.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── FACULTY ── */}
        <div className="nav-group">
          <div className={`nav-top-row ${isFacultyActive ? "active" : ""}`}>
            <Link
              to="/faculty"
              className="nav-top-link"
              onClick={() => setFacultyOpen(true)}
              title="View faculty"
            >
              <GraduationCap size={17} />
              <span>Faculty</span>
              <span className="nav-pill">9</span>
            </Link>
            <button
              type="button"
              className="nav-toggle-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFacultyOpen(!facultyOpen);
              }}
              title={facultyOpen ? "Minimize faculty" : "Expand faculty"}
              aria-label="Toggle faculty"
            >
              {facultyOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          </div>
          {facultyOpen && (
            <div className="nav-sub">
              {FACULTY_CATEGORIES.map(c => (
                <Link
                  key={c.letter}
                  to={`/faculty?category=${c.letter}`}
                  className={`nav-sub-item ${currentCategory === c.letter ? "active-sub" : ""}`}
                  title={c.name}
                >
                  <span className="cat-letter">{c.letter}</span>
                  <span className="cat-label">{c.shortName}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
      <div className="sidebar-foot">
        <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'}}><div className="mini-dot" /> Laravel API connected locally</div>
        <button className="logout-btn" onClick={() => { sessionStorage.removeItem('aaccup_auth'); window.location.reload(); }}>
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
    <main className="main">{children}</main>
  </div>
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="toast glass"><AlertCircle size={17} /><span>{message}</span></div>
}

export function Confirm({ open, title, body, onCancel, onConfirm }: { open: boolean; title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return <div className="modal-backdrop"><div className="modal glass">
    <button className="icon-btn close" onClick={onCancel}><X size={18} /></button>
    <div className="danger-icon"><Trash2 size={20} /></div><h2>{title}</h2><p>{body}</p>
    <div className="actions"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn danger" onClick={onConfirm}>Delete</button></div>
  </div></div>
}

function Capacity({ remaining = 10, max = 10 }: { remaining?: number; max?: number }) {
  const used = Math.max(0, max - remaining), pct = (used / max) * 100;
  return <div className="capacity glass-sub">
    <div><span className="eyebrow">AREA CAPACITY</span><strong>{used} <small>/ {max}</small></strong></div>
    <div className="capacity-track"><i style={{ width: `${pct}%` }} /></div>
    <span className="muted">{remaining} slot{remaining === 1 ? "" : "s"} remaining</span>
  </div>
}

function FieldError({ message }: { message?: string }) { return message ? <div className="field-error"><AlertCircle size={14} />{message}</div> : null }

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop"><div className="modal glass"><button className="icon-btn close" onClick={onClose}><X size={18} /></button><h2>{title}</h2>{children}</div></div>
}

function FileManager({ type, id, files = [], onRefresh }: { type: AttachableType; id: number; files?: FileAttachment[]; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    if (picked.length > 10) { setErr("You can upload at most 10 files per request."); return; }
    const tooBig = picked.find(f => f.size > 10 * 1024 * 1024);
    if (tooBig) { setErr(`${tooBig.name} is over the 10 MB limit.`); return; }
    setBusy(true); setErr("");
    try { await endpoints.upload(type, id, picked); onRefresh() } catch (e) { setErr(apiErrorMessage(e, "Upload failed.")) } finally { setBusy(false); e.target.value = "" }
  }
  async function remove(id: number) { try { await endpoints.deleteAttachment(id); onRefresh() } catch (e) { setErr(apiErrorMessage(e, "Could not delete file.")) } }
  return <div className="file-panel">
    <div className="file-head"><div><span className="eyebrow">EVIDENCE</span><h3>Attachments <span>{files.length}</span></h3></div>
      <label className={`btn secondary ${busy ? "disabled" : ""}`}><Upload size={15} />{busy ? "Uploading…" : "Upload files"}<input hidden type="file" multiple onChange={upload} disabled={busy} /></label>
    </div>
    <FieldError message={err} />
    {!files.length ? <div className="empty compact"><FileText size={22} /><span>No evidence attached yet.</span></div> :
      <div className="file-list">{files.map(f => <div className="file-row" key={f.id}><div className="file-icon"><FileText size={16} /></div><div className="file-meta"><strong>{f.file_name}</strong><span>{f.human_readable_size} · {f.mime_type}</span></div><a className="icon-btn" href={f.url} target="_blank" rel="noreferrer">↗</a><button className="icon-btn danger-text" onClick={() => remove(f.id)}><Trash2 size={15} /></button></div>)}</div>}
  </div>
}

function AreasPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const areaParam = searchParams.get("area");

  useEffect(() => {
    if (areaParam) {
      navigate(`/areas/${areaParam}`, { replace: true });
    }
  }, [areaParam, navigate]);

  const [areas, setAreas] = useState<Area[]>([]), [loading, setLoading] = useState(true), [search, setSearch] = useState(""), [sort, setSort] = useState("name"), [dir, setDir] = useState<"asc" | "desc">("asc");
  const [remaining, setRemaining] = useState(10), [max, setMax] = useState(10), [modal, setModal] = useState(false), [editing, setEditing] = useState<Area | null>(null), [deleteId, setDeleteId] = useState<number | null>(null);
  const toast = useToast();
  async function load() { setLoading(true); try { const r = await endpoints.areas({ search, sort_by: sort, direction: dir, per_page: 50 }); setAreas(r.data); setRemaining(r.meta.remaining_slots ?? Math.max(0, (r.meta.max_areas ?? 10) - r.meta.total)); setMax(r.meta.max_areas ?? 10) } catch (e) { toast.setMessage(apiErrorMessage(e, "Could not load areas.")) } finally { setLoading(false) } }
  useEffect(() => { const t = setTimeout(load, 180); return () => clearTimeout(t) }, [search, sort, dir]);
  async function del() { if (deleteId == null) return; try { await endpoints.deleteArea(deleteId); toast.setMessage("Area deleted."); setDeleteId(null); load() } catch (e) { toast.setMessage(apiErrorMessage(e, "Could not delete area.")) } }
  return <Layout><div className="page">
    <header className="topbar"><div><span className="eyebrow">ACCREDITATION WORKSPACE</span><h1>Areas</h1><p>Build and evaluate your AACCUP accreditation areas.</p></div>
      <button className="btn primary" disabled={remaining === 0} onClick={() => { setEditing(null); setModal(true) }}><Plus size={17} /> Add Area</button></header>
    <Capacity remaining={remaining} max={max} />
    <div className="toolbar glass"><div className="search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search areas…" /></div><select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Sort by name</option><option value="created_at">Sort by created</option></select><button className="sort-btn" onClick={() => setDir(dir === "asc" ? "desc" : "asc")}>{dir === "asc" ? "A → Z" : "Z → A"} <ChevronDown size={15} /></button></div>
    {loading ? <div className="loading"><Loader2 className="spin" /> Loading areas…</div> :
      !areas.length ? <div className="empty glass"><div className="empty-icon"><FolderOpen /></div><h2>{search ? "No matching areas" : "No areas yet"}</h2><p>{search ? "Try a different search." : "Create your first accreditation area to begin."}</p>{!search && <button className="btn primary" disabled={remaining === 0} onClick={() => setModal(true)}><Plus size={16} /> Create area</button>}</div> :
        <div className="area-grid">{areas.map((a, i) => <div className="area-card glass" key={a.id}><div className="area-number">{String(i + 1).padStart(2, "0")}</div><div className="area-card-body"><div className="card-title"><Link to={`/areas/${a.id}`}><h2>{a.name}</h2></Link><span className="status-dot" /></div><p>{a.description || "No description provided."}</p><div className="stats"><span><Settings2 size={14} />{a.parameters_count ?? a.parameters?.length ?? 0} parameters</span><span><FileText size={14} />{a.files_count ?? a.files?.length ?? 0} files</span></div><div className="card-actions"><Link className="btn secondary" to={`/areas/${a.id}`}>Open area</Link><button className="icon-btn" onClick={() => { setEditing(a); setModal(true) }}>Edit</button><button className="icon-btn danger-text" onClick={() => setDeleteId(a.id)}><Trash2 size={15} /></button></div></div></div>)}</div>}
    <AreaForm open={modal} area={editing} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); toast.setMessage(editing ? "Area updated." : "Area created.") }} onError={toast.setMessage} />
    <Confirm open={deleteId !== null} title="Delete this area?" body="This permanently removes its parameters, indicators, and files." onCancel={() => setDeleteId(null)} onConfirm={del} />
    <Toast message={toast.message} />
  </div></Layout>
}

function AreaForm({ open, area, onClose, onSaved, onError }: { open: boolean; area: Area | null; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState(area?.name ?? ""), [description, setDescription] = useState(area?.description ?? ""), [busy, setBusy] = useState(false);
  useEffect(() => { setName(area?.name ?? ""); setDescription(area?.description ?? "") }, [area, open]);
  if (!open) return null;
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { if (area) await endpoints.updateArea(area.id, { name, description, _method: "PUT" }); else await endpoints.createArea({ name, description }); onSaved() } catch (e) { onError(apiErrorMessage(e, "Could not save area.")) } finally { setBusy(false) } }
  return <Modal title={area ? "Edit area" : "Create area"} onClose={onClose}><form onSubmit={save}><label>Area name<input value={name} onChange={e => setName(e.target.value)} required maxLength={255} /></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} /></label><div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save area"}</button></div></form></Modal>
}

function AreaDetail() {
  const { areaId } = useParams(); const id = Number(areaId); const [area, setArea] = useState<Area | null>(null), [parameters, setParameters] = useState<Parameter[]>([]), [loading, setLoading] = useState(true), [modal, setModal] = useState(false), [editing, setEditing] = useState<Parameter | null>(null), [deleteId, setDeleteId] = useState<number | null>(null); const toast = useToast();
  async function load() { setLoading(true); try { const a = await endpoints.area(id); setArea(a); setParameters(a.parameters ?? (await endpoints.parameters(id)).data) } catch (e) { toast.setMessage(apiErrorMessage(e, "Could not load area.")) } finally { setLoading(false) } } useEffect(() => { load() }, [id]);
  async function del() { if (deleteId == null) return; try { await endpoints.deleteParameter(deleteId); toast.setMessage("Parameter deleted."); setDeleteId(null); load() } catch (e) { toast.setMessage(apiErrorMessage(e, "Could not delete parameter.")) } }
  const sortedParams = useMemo(() => {
    return [...parameters].sort((a, b) => (a.parameter_letter ?? "").localeCompare(b.parameter_letter ?? ""));
  }, [parameters]);

  if (loading) return <Layout><div className="loading"><Loader2 className="spin" /> Loading area…</div></Layout>;
  if (!area) return <Layout><div className="empty glass"><h2>Area not found</h2><Link className="btn secondary" to="/">Back</Link></div></Layout>;
  return <Layout><div className="page">
    <Link className="back" to="/"><ArrowLeft size={16} /> All areas</Link>
    <header className="topbar"><div><span className="eyebrow">AREA {String(area.id).padStart(2, "0")}</span><h1>{area.name}</h1><p>{area.description || "No description provided."}</p></div><button className="btn primary" onClick={() => { setEditing(null); setModal(true) }}><Plus size={17} /> Add Parameter</button></header>
    <FileManager type="area" id={id} files={area.files} onRefresh={load} />
    <section className="section-wrap"><div className="section-heading"><div><span className="eyebrow">STRUCTURE</span><h2>Parameters</h2></div><span className="count-pill">{parameters.length}</span></div>
      {!parameters.length ? <div className="empty glass"><Settings2 /><h2>No parameters</h2><p>Add a standard or custom parameter to start the evaluation.</p></div> :
        <div className="parameter-table glass"><div className="table-head"><span>Letter</span><span>Parameter</span><span>Indicators</span><span>SIOM</span><span>Mean</span><span style={{ textAlign: "right" }}>Actions</span></div>{sortedParams.map(p => <div className="table-row" key={p.id}><div className="letter">{p.parameter_letter || "—"}</div><div><Link className="param-link" to={`/parameters/${p.id}`}>{p.name}</Link>{p.is_custom && <span className="badge">CUSTOM</span>}<small>{p.details || ""}</small></div><span>{p.indicators_count ?? p.indicators?.length ?? 0}</span><Score value={p.siom} /><Score value={p.parameter_mean} /><div className="row-actions"><Link className="btn secondary view-param-btn" to={`/parameters/${p.id}`} title="View parameter checklist"><Eye size={13} /> View</Link><button className="icon-btn" onClick={() => { setEditing(p); setModal(true) }} title="Edit parameter">Edit</button><button className="icon-btn danger-text" onClick={() => setDeleteId(p.id)} title="Delete parameter"><Trash2 size={15} /></button></div></div>)}</div>}
    </section>
    <ParameterForm open={modal} parameter={editing} areaId={id} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); toast.setMessage(editing ? "Parameter updated." : "Parameter created.") }} onError={toast.setMessage} />
    <Confirm open={deleteId !== null} title="Delete this parameter?" body="Its indicators and files will also be removed." onCancel={() => setDeleteId(null)} onConfirm={del} /><Toast message={toast.message} />
  </div></Layout>
}

function Score({ value }: { value: number | null | undefined }) { return <span className={`score ${value == null ? "muted-score" : ""}`}>{value == null ? "—" : Number(value).toFixed(2)}</span> }

function ParameterForm({ open, parameter, areaId, onClose, onSaved, onError }: { open: boolean; parameter: Parameter | null; areaId: number; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState(""), [details, setDetails] = useState(""), [letter, setLetter] = useState(""), [custom, setCustom] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { setName(parameter?.name ?? ""); setDetails(parameter?.details ?? ""); setLetter(parameter?.parameter_letter ?? ""); setCustom(parameter?.is_custom ?? false) }, [parameter, open]);
  if (!open) return null;
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { const body = { name, details, parameter_letter: letter || null, is_custom: custom, ...(parameter ? { _method: "PUT" } : {}) }; if (parameter) await endpoints.updateParameter(parameter.id, body); else await endpoints.createParameter(areaId, body); onSaved() } catch (e) { onError(apiErrorMessage(e, "Could not save parameter.")) } finally { setBusy(false) } }
  return <Modal title={parameter ? "Edit parameter" : "Add parameter"} onClose={onClose}><form onSubmit={save}><label>Parameter name<input value={name} onChange={e => setName(e.target.value)} required maxLength={255} /></label><div className="form-grid"><label>Letter<input value={letter} onChange={e => setLetter(e.target.value)} maxLength={10} placeholder="A" /></label><label className="toggle-label">Custom parameter<button type="button" className={`toggle ${custom ? "on" : ""}`} onClick={() => setCustom(!custom)}><i /></button></label></div><label>Details<textarea value={details} onChange={e => setDetails(e.target.value)} rows={4} /></label><div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save parameter"}</button></div></form></Modal>
}

function ParameterPage() {
  const { id } = useParams();
  const pid = Number(id);

  const [p, setP] = useState<Parameter | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [addSection, setAddSection] = useState<SectionType>("SYSTEM_INPUTS");
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<number, boolean>>({});
  const toast = useToast();

  async function load() {
    setLoading(true);
    try { setP(await endpoints.parameter(pid)); }
    catch (e) { setErr(apiErrorMessage(e, "Could not load parameter.")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [pid]);

  async function rate(i: Indicator, value: string) {
    const rating = value === "" ? null : Number(value);
    try { await endpoints.updateIndicator(i.id, { item_rating: rating }); await load(); }
    catch (e) { toast.setMessage(apiErrorMessage(e, "Rating could not be saved.")); }
  }

  async function addIndicator(e: React.FormEvent) {
    e.preventDefault();
    if (!newCode.trim() || !newDesc.trim()) return;
    setAdding(true);
    try {
      await endpoints.createIndicator(pid, { section_type: addSection, code: newCode.trim(), description: newDesc.trim(), item_rating: null });
      setNewCode(""); setNewDesc(""); await load();
    } catch (e) { toast.setMessage(apiErrorMessage(e, "Could not add indicator.")); }
    finally { setAdding(false); }
  }

  async function remove(i: Indicator) {
    try { await endpoints.deleteIndicator(i.id); await load(); }
    catch (e) { toast.setMessage(apiErrorMessage(e, "Could not delete indicator.")); }
  }

  function toggleFiles(indicatorId: number) {
    setExpandedFiles(prev => ({ ...prev, [indicatorId]: !prev[indicatorId] }));
  }

  if (loading) return <Layout><div className="loading"><Loader2 className="spin" /> Loading evaluation…</div></Layout>;
  if (!p) return <Layout><div className="empty glass"><h2>{err || "Parameter not found"}</h2><Link to="/" className="btn secondary">Back</Link></div></Layout>;

  const allIndicators = p.indicators ?? [];
  const bySection = (key: SectionType) => allIndicators.filter(i => i.section_type === key);

  return (
    <Layout>
      <div className="page">
        <Link className="back" to={p.area ? `/areas/${p.area.id}` : "/"}>
          <ArrowLeft size={16} /> {p.area?.name || "Back"}
        </Link>

        {/* Header */}
        <div className="eval-header glass">
          <div>
            <span className="eyebrow">PARAMETER {p.parameter_letter || ""}</span>
            <h1>{p.name}</h1>
            <p>{p.details || "AACCUP evaluation checklist."}</p>
          </div>
          <div className="score-cards">
            <div>
              <span>SIOM</span>
              <strong><Score value={p.siom} /></strong>
              <small>System Inputs + Outcome</small>
            </div>
            <div>
              <span>PARAMETER MEAN</span>
              <strong><Score value={p.parameter_mean} /></strong>
              <small>All rated sections</small>
            </div>
          </div>
        </div>

        {/* Parameter-level files */}
        <FileManager type="parameter" id={pid} files={p.files} onRefresh={load} />

        {/* ── AACCUP Evaluation Table ── */}
        <div className="aaccup-table glass">
          {/* Table header */}
          <div className="aaccup-thead">
            <div className="aaccup-th-indicators">Indicators</div>
            <div className="aaccup-th-score">IR</div>
            <div className="aaccup-th-score">SIOM</div>
            <div className="aaccup-th-score">PM</div>
          </div>

          {/* Sections */}
          {sections.map(sec => {
            const sectionIndicators = bySection(sec.key);
            return (
              <div key={sec.key} className="aaccup-section">
                {/* Section header row */}
                <div className="aaccup-section-header">
                  <span>{sec.key === "SYSTEM_INPUTS" ? "SYSTEM – INPUTS AND PROCESSES" : sec.key === "IMPLEMENTATION" ? "IMPLEMENTATION" : "OUTCOME/S"}</span>
                </div>

                {/* Indicator rows */}
                {sectionIndicators.length === 0 ? (
                  <div className="aaccup-empty-row">
                    <span>No indicators in this section yet.</span>
                  </div>
                ) : (
                  sectionIndicators.map((ind) => (
                    <div className="aaccup-row" key={ind.id}>
                      {/* Indicator cell */}
                      <div className="aaccup-indicator-cell">
                        <div className="aaccup-code-row">
                          <span className="aaccup-code">{ind.code}</span>
                          {ind.is_custom && <span className="badge">CUSTOM</span>}
                          {ind.is_custom && (
                            <button className="icon-btn danger-text aaccup-del" onClick={() => remove(ind)} title="Delete">
                              <Trash2 size={13} />
                            </button>
                          )}
                          <button
                            className="aaccup-file-toggle"
                            onClick={() => toggleFiles(ind.id)}
                            title={expandedFiles[ind.id] ? "Hide files" : "Attach evidence"}
                          >
                            <FileText size={13} />
                            {(ind.files?.length ?? 0) > 0 && <span className="aaccup-file-count">{ind.files!.length}</span>}
                          </button>
                        </div>
                        <p className="aaccup-desc">{ind.description}</p>
                        {expandedFiles[ind.id] && (
                          <div className="aaccup-files-inline">
                            <FileManager type="indicator" id={ind.id} files={ind.files} onRefresh={load} />
                          </div>
                        )}
                      </div>

                      {/* IR (Item Rating) */}
                      <div className="aaccup-score-cell">
                        <select
                          className="aaccup-rating-select"
                          value={ind.item_rating == null ? "" : String(ind.item_rating)}
                          onChange={e => rate(ind, e.target.value)}
                        >
                          <option value="">—</option>
                          {Array.from({ length: 21 }, (_, n) => (n / 4)).map(v => (
                            <option key={v} value={v}>{v.toFixed(2)}</option>
                          ))}
                        </select>
                      </div>

                      {/* SIOM — backend-computed, shown on first row of section only */}
                      <div className="aaccup-score-cell aaccup-computed">
                        {sec.key !== "IMPLEMENTATION" ? <Score value={p.siom} /> : <span className="muted-score">—</span>}
                      </div>

                      {/* PM */}
                      <div className="aaccup-score-cell aaccup-computed">
                        <Score value={p.parameter_mean} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>

        {/* Add custom indicator */}
        <div className="aaccup-add-panel glass">
          <div className="aaccup-add-heading">
            <Plus size={16} />
            <strong>Add custom indicator</strong>
          </div>
          <form className="aaccup-add-form" onSubmit={addIndicator}>
            <select
              className="aaccup-add-section-select"
              value={addSection}
              onChange={e => setAddSection(e.target.value as SectionType)}
            >
              {sections.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Code e.g. S.9" maxLength={50} />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Indicator description…" maxLength={5000} />
            <button className="btn secondary" disabled={adding || !newCode.trim() || !newDesc.trim()}>
              {adding ? "Adding…" : "Add"}
            </button>
          </form>
        </div>

        <Toast message={toast.message} />
      </div>
    </Layout>
  );
}

function App() { return <Routes><Route path="/" element={<AreasPage />} /><Route path="/areas/:areaId" element={<AreaDetail />} /><Route path="/parameters/:id" element={<ParameterPage />} /><Route path="/faculty" element={<FacultyPage />} /><Route path="*" element={<AreasPage />} /></Routes> }

const CREDS = { user: 'admin.area', pass: 'area123-pass' };

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    setTimeout(() => {
      if (user === CREDS.user && pass === CREDS.pass) {
        sessionStorage.setItem('aaccup_auth', '1');
        onLogin();
      } else {
        setErr('Invalid username or password.');
      }
      setBusy(false);
    }, 600);
  }

  return (
    <div className="login-bg">
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />
      <div className="login-card glass">
        <div className="login-brand">
          <div className="login-brand-mark"><ClipboardCheck size={22} /></div>
          <div>
            <strong>AACCUP Evaluate</strong>
            <span>Accreditation Management System</span>
          </div>
        </div>
        <div className="login-divider" />
        <h2 className="login-title">Sign in to continue</h2>
        <p className="login-sub">Enter your credentials to access the evaluation workspace.</p>
        <form onSubmit={submit} className="login-form">
          <label>
            <span>Username</span>
            <div className="login-input-wrap">
              <input
                type="text"
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="admin.area"
                autoComplete="username"
                required
              />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div className="login-input-wrap">
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                required
              />
              <button type="button" className="login-eye" onClick={() => setShowPass(!showPass)} tabIndex={-1}>
                <Eye size={15} />
              </button>
            </div>
          </label>
          {err && <div className="field-error"><AlertCircle size={14} />{err}</div>}
          <button className="btn primary login-submit" disabled={busy}>
            {busy ? <><Loader2 size={15} className="spin" /> Signing in…</> : <><Lock size={15} /> Sign in</>}
          </button>
        </form>
        <div className="login-footer">
          <span className="mini-dot" />Secured · AACCUP Accreditation Platform
        </div>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('aaccup_auth') === '1');
  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate>
        <App />
      </AuthGate>
    </BrowserRouter>
  </React.StrictMode>
);
