import React, { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { 
  AlertCircle, ArrowRight, Award, BookOpen, Briefcase, 
  CheckCircle2, ChevronRight, Clock, Coins, ExternalLink, 
  FileCheck, FileText, Filter, FolderOpen, GraduationCap, 
  Layers, Mail, Plus, RefreshCw, Search, ShieldCheck, Sparkles, 
  Star, Trash2, User, UserCheck, Users, X 
} from "lucide-react";
import { endpoints, apiErrorMessage } from "./api";
import type { FacultyMember, FacultyCategory, Area } from "./types";
import { Layout, useToast, Toast, Confirm, Modal } from "./main";

const STORAGE_KEY = "aaccup_faculty_members";

export const FACULTY_CATEGORIES: FacultyCategory[] = [
  {
    letter: "A",
    name: "Academic Qualifications & Professional Experience",
    shortName: "Qualifications",
    description: "Educational degrees, alignment with teaching disciplines, industry practice, and professional board licenses.",
    benchmarkStatement: "100% of full-time faculty hold graduate degrees (Master's or Doctorate) aligned with their assigned teaching disciplines and valid PRC board licenses.",
    evidenceRequired: [
      "Official Transcripts of Records (TOR) with Special Order / Exemption",
      "Certified True Copies of Baccalaureate, Master's, and Doctorate Diplomas",
      "Valid PRC Professional Board Licenses & Technical Certifications",
      "Civil Service Form 212 / Detailed Curriculum Vitae",
      "Certificates of Industry Practice and Relevant Teaching Experience"
    ],
    metricsSummary: "88% Advanced Degrees (3 Doctorate, 4 Master's)",
    complianceRating: 4.88,
    status: "Compliant"
  },
  {
    letter: "B",
    name: "Recruitment, Selection & Orientation",
    shortName: "Recruitment",
    description: "Merit-based hiring policies, transparent screening protocols, onboarding, and Faculty Manual dissemination.",
    benchmarkStatement: "The institutional Faculty Selection Board (FSB) rigorously conducts objective merit screenings in compliance with CHED and Civil Service standards.",
    evidenceRequired: [
      "Approved Institutional Guidelines for Faculty Recruitment & Selection",
      "Published Vacant Position Announcements & CSC / Website Postings",
      "Minutes of FSB Deliberations, Ranking Matrices, and Recommendations",
      "New Faculty Orientation Program Accomplishment Reports",
      "Signed Acknowledgement Slips of the Institutional Faculty Manual"
    ],
    metricsSummary: "Active Faculty Selection Board · 100% Oriented",
    complianceRating: 4.80,
    status: "Compliant"
  },
  {
    letter: "C",
    name: "Faculty Adequacy & Teaching Loading",
    shortName: "Adequacy & Loading",
    description: "Full-time to part-time ratio, regular teaching load (18–21 units), preparations count, and student consultation hours.",
    benchmarkStatement: "Full-time faculty handle at least 80% of program courses; average regular load does not exceed 21 units with a maximum of 3-4 separate preparations.",
    evidenceRequired: [
      "Faculty Loading and Assignment Sheets (Form 47)",
      "Official Master Class Schedules per Academic Term",
      "Approved Overload and Quasi-Teaching Assignment Permits",
      "Documented Faculty Consultation Logs & Schedules (min 5 hrs/week)",
      "Faculty-to-Student Ratio Verification Reports"
    ],
    metricsSummary: "88% Full-Time Ratio · 18.2 Units Mean Load",
    complianceRating: 4.90,
    status: "Compliant"
  },
  {
    letter: "D",
    name: "Rank and Tenure",
    shortName: "Rank & Tenure",
    description: "Academic rank classification (NBC 461 / DBM-CHED), promotion systems, and security of tenure criteria.",
    benchmarkStatement: "Faculty ranking adheres to national reclassification guidelines; permanent appointment and tenure are awarded upon meeting probationary merit criteria.",
    evidenceRequired: [
      "Institutional Criteria for Faculty Ranking, Reclassification & Promotion",
      "Notice of Academic Rank Reclassification (NBC 461 Results)",
      "Civil Service Commission Permanent Appointment Papers (CSC Form 33)",
      "Board of Regents (BOR) Resolutions Approving Permanent Status",
      "Updated Plantilla of Faculty Personnel"
    ],
    metricsSummary: "75% Tenured / Permanent Faculty Roster",
    complianceRating: 4.75,
    status: "Compliant"
  },
  {
    letter: "E",
    name: "Faculty Development",
    shortName: "Development",
    description: "Institutional scholarships, study leaves with pay, research grants, and conference attendance subsidies.",
    benchmarkStatement: "An approved and funded 5-Year Faculty Development Plan supports ongoing graduate education, dissertation grants, and seminar participation.",
    evidenceRequired: [
      "Approved 5-Year Institutional Faculty Development Plan (FDP)",
      "Contracts for Study Leave with Pay & Sabbatical Approvals",
      "Certificates of Participation in Seminars, Workshops & Conventions",
      "Financial Grants and Thesis Assistance Disbursement Vouchers",
      "Return Service Agreements and Monitoring Progress Reports"
    ],
    metricsSummary: "3 Faculty on Funded Ph.D. Study Leave",
    complianceRating: 4.82,
    status: "Compliant"
  },
  {
    letter: "F",
    name: "Professional Performance & Scholarly Works",
    shortName: "Scholarly Works",
    description: "Peer-reviewed research publications, authored textbooks and instructional modules, patents, and presentations.",
    benchmarkStatement: "Faculty consistently produce peer-reviewed publications in Scopus/WoS or CHED-recognized journals and copyright instructional materials.",
    evidenceRequired: [
      "Full-Text Reprints of Scopus/WoS/CHED-Indexed Journal Articles",
      "Published Textbooks & Laboratory Modules with Registered ISBN",
      "Certificates of Paper Presentation in National/International Conferences",
      "Instructional Materials (IM) Committee Approval Certifications",
      "Intellectual Property Office (IPOPHL) Copyright Registrations"
    ],
    metricsSummary: "41 Total Publications & Citations Recorded",
    complianceRating: 4.70,
    status: "Compliant"
  },
  {
    letter: "G",
    name: "Salaries, Fringe Benefits & Incentives",
    shortName: "Salaries & Benefits",
    description: "National salary schedules, hazard pay, medical benefits, retirement, and cash awards for excellence.",
    benchmarkStatement: "Faculty compensation conforms to government salary scales; comprehensive fringe benefits and monetary incentives for scholarly excellence are provided.",
    evidenceRequired: [
      "Official Faculty Salary Scale and Compensation Matrix",
      "Sample Monthly Payslips with Statutory Deductions (GSIS/PhilHealth)",
      "Collective Negotiation Agreement (CNA) Benefits Matrix",
      "Institutional PRAISE Reward Program Guidelines & Disbursement Receipts",
      "Health Care, Dental, and Medical Wellness Records"
    ],
    metricsSummary: "100% Salary Grade & Merit System Compliant",
    complianceRating: 4.85,
    status: "Compliant"
  },
  {
    letter: "H",
    name: "Professionalism and Ethics",
    shortName: "Ethics & Integrity",
    description: "Code of Ethics for Professional Teachers, academic freedom, civic responsibilities, and professional society memberships.",
    benchmarkStatement: "Faculty adhere to ethical standards of teaching, demonstrate civic responsibility, and hold active standing in accredited professional associations.",
    evidenceRequired: [
      "Institutional Faculty Code of Ethics and Conduct Manual",
      "Certificates of Active Membership in Professional Organizations (PSITE, ACM, IEEE)",
      "Annual Statement of Assets, Liabilities, and Net Worth (SALN) Records",
      "Community Extension Service Certificates and Civic Activity Logs",
      "Annual Faculty Clearance and Good Moral Character Attestations"
    ],
    metricsSummary: "100% Active in Professional Societies",
    complianceRating: 4.95,
    status: "Compliant"
  },
  {
    letter: "I",
    name: "Performance Evaluation & Student Ratings",
    shortName: "Evaluation & SET",
    description: "Multi-source performance evaluation: Student Evaluation of Teachers (SET), dean/supervisor rating, and peer review.",
    benchmarkStatement: "Periodic evaluation using validated tools is conducted every term; faculty maintain a mean composite rating exceeding the 4.00/5.00 benchmark.",
    evidenceRequired: [
      "Summary Sheets of Student Evaluation of Teachers (SET) by Term",
      "Accomplished Individual Performance Commitment and Review (IPCR) Forms",
      "Department Chair & Dean Supervisory Evaluation Reports",
      "Peer and Self-Performance Evaluation Instruments",
      "Administrative Action and Commendation on Outstanding Ratings"
    ],
    metricsSummary: "4.77 / 5.00 Exemplary Faculty Mean SET",
    complianceRating: 4.77,
    status: "Compliant"
  }
];

export function getCategoryIcon(letter: string, size = 18) {
  switch (letter) {
    case "A": return <GraduationCap size={size} />;
    case "B": return <UserCheck size={size} />;
    case "C": return <Clock size={size} />;
    case "D": return <Award size={size} />;
    case "E": return <BookOpen size={size} />;
    case "F": return <FileText size={size} />;
    case "G": return <Coins size={size} />;
    case "H": return <ShieldCheck size={size} />;
    case "I": return <Star size={size} />;
    default: return <Layers size={size} />;
  }
}

const DEFAULT_FACULTY: FacultyMember[] = [
  {
    id: "fac-1",
    name: "Dr. Arthur M. Ramos",
    title: "Ph.D., PECE",
    rank: "Professor",
    rank_detail: "Professor VI",
    department: "Computer Science",
    college: "College of Information & Computing Sciences",
    highest_degree: "Doctorate",
    degree_detail: "Ph.D. in Computer Science — University of the Philippines Diliman",
    employment_status: "Full-Time Permanent",
    teaching_load: 12,
    prc_license: "Professional Electronics Engineer (PECE #1142)",
    email: "a.ramos@university.edu.ph",
    specialization: "Distributed Systems & High-Performance Computing",
    student_eval_rating: 4.92,
    publications_count: 14,
    notes: "Dean of College; designated Area III lead evaluator."
  },
  {
    id: "fac-2",
    name: "Engr. Maricel T. Gonzales",
    title: "M.Eng., LPT",
    rank: "Associate Professor",
    rank_detail: "Associate Professor II",
    department: "Computer Engineering",
    college: "College of Information & Computing Sciences",
    highest_degree: "Master's",
    degree_detail: "Master of Engineering in Computer Engineering — De La Salle University",
    employment_status: "Full-Time Permanent",
    teaching_load: 18,
    prc_license: "Licensed Professional Teacher (LPT #084920)",
    email: "m.gonzales@university.edu.ph",
    specialization: "Embedded Systems, Robotics & IoT Architecture",
    student_eval_rating: 4.85,
    publications_count: 6,
    notes: "Department Chairperson; published in IEEE R10 Conference."
  },
  {
    id: "fac-3",
    name: "Dr. Carmela R. Santos",
    title: "DIT",
    rank: "Professor",
    rank_detail: "Professor II",
    department: "Information Technology",
    college: "College of Information & Computing Sciences",
    highest_degree: "Doctorate",
    degree_detail: "Doctor in Information Technology — Technological University of the Philippines",
    employment_status: "Full-Time Permanent",
    teaching_load: 21,
    prc_license: "PRC LPT #049218",
    email: "c.santos@university.edu.ph",
    specialization: "Cybersecurity, Network Defense & HCI",
    student_eval_rating: 4.79,
    publications_count: 9,
    notes: "Accredited CHED Lead Quality Assurer."
  },
  {
    id: "fac-4",
    name: "Prof. Jerome B. Villanueva",
    title: "M.S. IT",
    rank: "Assistant Professor",
    rank_detail: "Assistant Professor IV",
    department: "Software Engineering",
    college: "College of Information & Computing Sciences",
    highest_degree: "Master's",
    degree_detail: "M.S. in Information Technology — Ateneo de Manila University",
    employment_status: "Full-Time Permanent",
    teaching_load: 21,
    prc_license: "Certified Information Systems Auditor (CISA)",
    email: "j.villanueva@university.edu.ph",
    specialization: "Enterprise Cloud Platforms & DevOps Automation",
    student_eval_rating: 4.68,
    publications_count: 4,
    notes: "Adviser for ACM Student Chapter."
  },
  {
    id: "fac-5",
    name: "Prof. Bea Kristine Alcantara",
    title: "MIT",
    rank: "Assistant Professor",
    rank_detail: "Assistant Professor I",
    department: "Computer Science",
    college: "College of Information & Computing Sciences",
    highest_degree: "Master's",
    degree_detail: "Master in Information Technology — University of Santo Tomas",
    employment_status: "Full-Time Temporary",
    teaching_load: 15,
    prc_license: "PRC Professional Teacher #129381",
    email: "bk.alcantara@university.edu.ph",
    specialization: "Natural Language Processing & Machine Learning",
    student_eval_rating: 4.74,
    publications_count: 3,
    notes: "Currently completing dissertation for Ph.D. in Computer Science."
  },
  {
    id: "fac-6",
    name: "Engr. Rodolfo C. Del Rosario",
    title: "MBA, B.S. ECE",
    rank: "Instructor",
    rank_detail: "Senior Instructor III",
    department: "Information Systems",
    college: "College of Information & Computing Sciences",
    highest_degree: "Master's",
    degree_detail: "Master in Business Administration — Polytechnic University of the Philippines",
    employment_status: "Full-Time Permanent",
    teaching_load: 24,
    prc_license: "PRC Registered Electronics Engineer #41029",
    email: "r.delrosario@university.edu.ph",
    specialization: "Database Management Systems & SAP ERP",
    student_eval_rating: 4.62,
    publications_count: 2,
    notes: "Lead coordinator for student internship industry linkages."
  },
  {
    id: "fac-7",
    name: "Atty. Grace Elena Soriano",
    title: "J.D., MIT",
    rank: "Lecturer",
    rank_detail: "Professorial Lecturer",
    department: "Information Technology",
    college: "College of Information & Computing Sciences",
    highest_degree: "Doctorate",
    degree_detail: "Juris Doctor & Master in IT — San Beda University",
    employment_status: "Part-Time",
    teaching_load: 6,
    prc_license: "Integrated Bar of the Philippines (IBP #71092)",
    email: "ge.soriano@university.edu.ph",
    specialization: "IT Law, Intellectual Property & Data Privacy Act of 2012",
    student_eval_rating: 4.91,
    publications_count: 2,
    notes: "Industry practitioner handling Cyberlaw and Ethics courses."
  },
  {
    id: "fac-8",
    name: "Prof. Leandro D. Mendoza",
    title: "B.S. CS, Cum Laude",
    rank: "Instructor",
    rank_detail: "Instructor I",
    department: "Computer Science",
    college: "College of Information & Computing Sciences",
    highest_degree: "Baccalaureate",
    degree_detail: "B.S. in Computer Science — Polytechnic University of the Philippines",
    employment_status: "Full-Time Temporary",
    teaching_load: 21,
    prc_license: "Certified Scrum Master (CSM)",
    email: "l.mendoza@university.edu.ph",
    specialization: "Modern Mobile & Fullstack Web Development",
    student_eval_rating: 4.65,
    publications_count: 1,
    notes: "Earned 24 units in M.S. Information Technology."
  }
];

export function FacultyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategoryParam = searchParams.get("category")?.toUpperCase() || null;

  const [faculty, setFaculty] = useState<FacultyMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_FACULTY;
  });

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [degreeFilter, setDegreeFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<FacultyMember | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dossierFaculty, setDossierFaculty] = useState<FacultyMember | null>(null);
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<FacultyCategory | null>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [creatingArea, setCreatingArea] = useState(false);
  const [syncingParams, setSyncingParams] = useState(false);
  const toast = useToast();

  // Save to local storage whenever faculty state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(faculty));
    } catch (e) {
      console.error(e);
    }
  }, [faculty]);

  // Check API for an active Faculty Area (e.g. Area III: Faculty)
  useEffect(() => {
    endpoints.areas({ per_page: 50 })
      .then(r => setAreas(r.data ?? []))
      .catch(() => { /* API might be offline, continue gracefully */ });
  }, []);

  const facultyArea = useMemo(() => {
    return areas.find(a => /faculty/i.test(a.name));
  }, [areas]);

  async function handleCreateFacultyArea() {
    setCreatingArea(true);
    try {
      const newArea = await endpoints.createArea({
        name: "Area III: Faculty",
        description: "Academic qualifications, rank and tenure, teaching load, development, research, and performance evaluations for AACCUP accreditation."
      });
      setAreas(prev => [newArea, ...prev]);
      toast.setMessage("Created 'Area III: Faculty' in your accreditation workspace.");
    } catch (e) {
      toast.setMessage(apiErrorMessage(e, "Could not create Faculty Area. Ensure backend is running."));
    } finally {
      setCreatingArea(false);
    }
  }

  // Populate all 9 parameters into the backend Area
  async function handleSync9CategoriesToArea() {
    if (!facultyArea) {
      toast.setMessage("Please create or connect an Area for Faculty first.");
      return;
    }
    setSyncingParams(true);
    try {
      let created = 0;
      for (const cat of FACULTY_CATEGORIES) {
        await endpoints.createParameter(facultyArea.id, {
          name: cat.name,
          parameter_letter: cat.letter,
          details: `${cat.description} Benchmark: ${cat.benchmarkStatement}`,
          is_custom: false
        });
        created++;
      }
      toast.setMessage(`Successfully synchronized all 9 categories as parameters in ${facultyArea.name}!`);
      // refresh areas
      const res = await endpoints.areas({ per_page: 50 });
      setAreas(res.data ?? []);
    } catch (e) {
      toast.setMessage(apiErrorMessage(e, "Could not sync categories to backend area."));
    } finally {
      setSyncingParams(false);
    }
  }

  function handleSelectCategoryFilter(letter: string | null) {
    if (!letter) {
      searchParams.delete("category");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ ...Object.fromEntries(searchParams.entries()), category: letter });
    }
  }

  // Filtered roster based on filters and optional active category alignment
  const filtered = useMemo(() => {
    return faculty.filter(f => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q || 
        f.name.toLowerCase().includes(q) ||
        f.specialization.toLowerCase().includes(q) ||
        f.department.toLowerCase().includes(q) ||
        f.degree_detail.toLowerCase().includes(q) ||
        (f.prc_license && f.prc_license.toLowerCase().includes(q));

      const matchDept = deptFilter === "all" || f.department === deptFilter;
      const matchRank = rankFilter === "all" || f.rank === rankFilter;
      const matchStatus = statusFilter === "all" || f.employment_status.startsWith(statusFilter);
      const matchDegree = degreeFilter === "all" || f.highest_degree === degreeFilter;

      // Category specific filter alignments
      let matchCat = true;
      if (activeCategoryParam === "A") matchCat = f.highest_degree === "Doctorate" || f.highest_degree === "Master's";
      else if (activeCategoryParam === "C") matchCat = f.teaching_load >= 18;
      else if (activeCategoryParam === "D") matchCat = f.employment_status === "Full-Time Permanent";
      else if (activeCategoryParam === "E") matchCat = (f.notes && f.notes.includes("Ph.D.")) || f.highest_degree === "Doctorate";
      else if (activeCategoryParam === "F") matchCat = (f.publications_count || 0) > 2;
      else if (activeCategoryParam === "H") matchCat = Boolean(f.prc_license);
      else if (activeCategoryParam === "I") matchCat = (f.student_eval_rating || 0) >= 4.70;

      return matchSearch && matchDept && matchRank && matchStatus && matchDegree && matchCat;
    });
  }, [faculty, search, deptFilter, rankFilter, statusFilter, degreeFilter, activeCategoryParam]);

  // Statistical calculations for AACCUP indicators
  const totalCount = faculty.length;
  const doctorateCount = faculty.filter(f => f.highest_degree === "Doctorate").length;
  const mastersCount = faculty.filter(f => f.highest_degree === "Master's").length;
  const advancedPercent = totalCount ? Math.round(((doctorateCount + mastersCount) / totalCount) * 100) : 0;
  const fullTimeCount = faculty.filter(f => f.employment_status.includes("Full-Time")).length;
  const fullTimePercent = totalCount ? Math.round((fullTimeCount / totalCount) * 100) : 0;
  const ratingsList = faculty.filter(f => f.student_eval_rating != null).map(f => f.student_eval_rating as number);
  const avgRating = ratingsList.length ? (ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length).toFixed(2) : "—";

  function handleDelete() {
    if (!deleteId) return;
    setFaculty(prev => prev.filter(f => f.id !== deleteId));
    setDeleteId(null);
    toast.setMessage("Faculty member removed from roster.");
  }

  function handleSaveFaculty(data: Omit<FacultyMember, "id">, id?: string) {
    if (id) {
      setFaculty(prev => prev.map(f => f.id === id ? { ...data, id } : f));
      toast.setMessage("Faculty profile updated.");
    } else {
      const newMember: FacultyMember = {
        ...data,
        id: `fac-${Date.now()}`
      };
      setFaculty(prev => [newMember, ...prev]);
      toast.setMessage("New faculty member added to roster.");
    }
    setModalOpen(false);
  }

  const departments = useMemo(() => {
    const s = new Set<string>();
    faculty.forEach(f => s.add(f.department));
    return Array.from(s);
  }, [faculty]);

  return (
    <Layout>
      <div className="page faculty-page">
        {/* Top bar header */}
        <header className="topbar">
          <div>
            <span className="eyebrow">ACCREDITATION WORKSPACE · AREA II / III</span>
            <h1>Faculty</h1>
            <p>Faculty profile, credentials, teaching assignments, and evaluation records for AACCUP accreditation.</p>
          </div>
          <button className="btn primary" onClick={() => { setEditingFaculty(null); setModalOpen(true); }}>
            <Plus size={17} /> Add Faculty Member
          </button>
        </header>

        {/* Backend Accreditation Area Integration Banner */}
        {facultyArea ? (
          <div className="faculty-banner glass">
            <div className="banner-icon"><FolderOpen size={20} /></div>
            <div className="banner-content">
              <strong>Accreditation Area Connected: {facultyArea.name}</strong>
              <p>
                {facultyArea.parameters_count ?? facultyArea.parameters?.length ?? 0} evaluation parameters and{" "}
                {facultyArea.files_count ?? facultyArea.files?.length ?? 0} evidence files registered in local backend.
              </p>
            </div>
            <div className="banner-actions">
              <button 
                className="btn secondary banner-btn" 
                disabled={syncingParams} 
                onClick={handleSync9CategoriesToArea}
                title="Populate all 9 categories as parameters in the backend Area"
              >
                <RefreshCw size={14} className={syncingParams ? "spin" : ""} />
                {syncingParams ? "Syncing…" : "Sync 9 Categories to Area"}
              </button>
              <Link className="btn primary banner-btn" to={`/areas/${facultyArea.id}`}>
                Open Area III Evaluation <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="faculty-banner glass-sub">
            <div className="banner-icon"><BookOpen size={20} /></div>
            <div className="banner-content">
              <strong>AACCUP Area III: Faculty Benchmark</strong>
              <p>Create an Area in your accreditation workspace to rate parameters and attach faculty evidence documents.</p>
            </div>
            <button className="btn secondary banner-btn" disabled={creatingArea} onClick={handleCreateFacultyArea}>
              {creatingArea ? "Creating…" : "+ Create Area III: Faculty"}
            </button>
          </div>
        )}

        {/* Statistical Metrics Cards */}
        <div className="faculty-stats">
          <div className="glass-sub stat-card">
            <div className="stat-icon-wrap"><Users size={18} /></div>
            <span className="eyebrow">TOTAL FACULTY</span>
            <strong>{totalCount}</strong>
            <small>{fullTimeCount} Full-Time · {totalCount - fullTimeCount} Part-Time</small>
          </div>

          <div className="glass-sub stat-card">
            <div className="stat-icon-wrap"><GraduationCap size={18} /></div>
            <span className="eyebrow">ADVANCED DEGREES</span>
            <strong>{advancedPercent}%</strong>
            <small>{doctorateCount} Doctorate · {mastersCount} Master's</small>
          </div>

          <div className="glass-sub stat-card">
            <div className="stat-icon-wrap"><Briefcase size={18} /></div>
            <span className="eyebrow">FULL-TIME RATIO</span>
            <strong>{fullTimePercent}%</strong>
            <small>AACCUP Benchmark &gt; 80%</small>
          </div>

          <div className="glass-sub stat-card">
            <div className="stat-icon-wrap"><Star size={18} /></div>
            <span className="eyebrow">AVERAGE SET RATING</span>
            <strong>{avgRating} <small>/ 5.00</small></strong>
            <small>Student Evaluation of Teachers</small>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 9 AACCUP FACULTY EVALUATION CATEGORIES (PARAMETERS A THROUGH I) */}
        {/* ========================================================================= */}
        <section className="categories-section">
          <div className="section-header-wrap">
            <div>
              <span className="eyebrow">ACCREDITATION FRAMEWORK</span>
              <h2>9 Faculty Evaluation Categories (Parameters A – I)</h2>
              <p>Official AACCUP survey instrument parameters evaluating academic personnel qualifications, loading, tenure, and performance.</p>
            </div>
            {activeCategoryParam && (
              <button className="btn ghost reset-cat-btn" onClick={() => handleSelectCategoryFilter(null)}>
                Clear category filter ({activeCategoryParam}) <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Filter Pills (A - I) */}
          <div className="category-pills glass-sub">
            <button 
              className={`cat-pill ${activeCategoryParam === null ? "active" : ""}`}
              onClick={() => handleSelectCategoryFilter(null)}
            >
              <Layers size={13} />
              <span>All 9 Categories</span>
            </button>
            {FACULTY_CATEGORIES.map(cat => (
              <button
                key={cat.letter}
                className={`cat-pill ${activeCategoryParam === cat.letter ? "active" : ""}`}
                onClick={() => handleSelectCategoryFilter(activeCategoryParam === cat.letter ? null : cat.letter)}
                title={cat.name}
              >
                <span className="pill-letter">{cat.letter}</span>
                <span>{cat.shortName}</span>
              </button>
            ))}
          </div>

          {/* 9 Category Cards Grid */}
          <div className="categories-grid">
            {FACULTY_CATEGORIES.map(cat => {
              const isSelected = activeCategoryParam === cat.letter;
              return (
                <div 
                  key={cat.letter} 
                  className={`category-card glass ${isSelected ? "selected-category" : ""}`}
                >
                  <div className="cat-card-head">
                    <div className="cat-icon-letter">
                      <div className="cat-icon-badge">{getCategoryIcon(cat.letter, 17)}</div>
                      <span className="cat-badge-pill">PARAMETER {cat.letter}</span>
                    </div>
                    <span className="compliance-pill">
                      <CheckCircle2 size={11} /> {cat.status}
                    </span>
                  </div>

                  <div className="cat-card-body">
                    <h3 className="cat-title">{cat.name}</h3>
                    <p className="cat-desc">{cat.description}</p>
                    
                    <div className="cat-benchmark-box">
                      <span className="benchmark-tag">AACCUP BENCHMARK</span>
                      <p>{cat.benchmarkStatement}</p>
                    </div>

                    <div className="cat-metric-pill">
                      <Sparkles size={13} />
                      <span>{cat.metricsSummary}</span>
                    </div>
                  </div>

                  <div className="cat-card-foot">
                    <button 
                      className="btn secondary cat-details-btn"
                      onClick={() => setSelectedCategoryModal(cat)}
                    >
                      View Criteria & Evidence ({cat.evidenceRequired.length})
                    </button>
                    <button 
                      className={`icon-btn ${isSelected ? "active-filter-btn" : ""}`}
                      onClick={() => handleSelectCategoryFilter(isSelected ? null : cat.letter)}
                      title={isSelected ? "Remove category filter" : `Filter roster by Parameter ${cat.letter}`}
                    >
                      <Filter size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FACULTY ROSTER SECTION & TOOLBAR */}
        {/* ========================================================================= */}
        <div className="section-header-wrap" style={{ marginTop: "12px" }}>
          <div>
            <span className="eyebrow">PERSONNEL ROSTER</span>
            <h2>Faculty Directory &amp; Compliance Portfolio</h2>
            <p>
              {activeCategoryParam 
                ? `Filtered by Parameter ${activeCategoryParam}: ${FACULTY_CATEGORIES.find(c => c.letter === activeCategoryParam)?.name}`
                : "Active academic personnel registered for Area II/III accreditation exhibits."}
            </p>
          </div>
          <span className="count-pill">{filtered.length} Faculty Members</span>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="toolbar glass faculty-toolbar">
          <div className="search">
            <Search size={17} />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search faculty by name, specialization, or degree…" 
            />
          </div>

          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select value={rankFilter} onChange={e => setRankFilter(e.target.value)}>
            <option value="all">All Academic Ranks</option>
            <option value="Professor">Professor</option>
            <option value="Associate Professor">Associate Professor</option>
            <option value="Assistant Professor">Assistant Professor</option>
            <option value="Instructor">Instructor</option>
            <option value="Lecturer">Lecturer</option>
          </select>

          <select value={degreeFilter} onChange={e => setDegreeFilter(e.target.value)}>
            <option value="all">All Degrees</option>
            <option value="Doctorate">Doctorate Holders</option>
            <option value="Master's">Master's Holders</option>
            <option value="Baccalaureate">Baccalaureate</option>
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="Full-Time">Full-Time Only</option>
            <option value="Part-Time">Part-Time Only</option>
          </select>
        </div>

        {/* Faculty Roster Grid */}
        {!filtered.length ? (
          <div className="empty glass">
            <div className="empty-icon"><GraduationCap /></div>
            <h2>{search || deptFilter !== "all" || rankFilter !== "all" || activeCategoryParam ? "No matching faculty members" : "No faculty registered"}</h2>
            <p>{search || activeCategoryParam ? "Try adjusting your category filter or search terms." : "Add faculty members to begin documenting Area III qualifications."}</p>
            {activeCategoryParam && (
              <button className="btn secondary" onClick={() => handleSelectCategoryFilter(null)}>
                Show All Faculty
              </button>
            )}
            {!search && !activeCategoryParam && (
              <button className="btn primary" onClick={() => { setEditingFaculty(null); setModalOpen(true); }}>
                <Plus size={16} /> Add First Faculty Member
              </button>
            )}
          </div>
        ) : (
          <div className="faculty-grid">
            {filtered.map((f) => (
              <div className="faculty-card glass" key={f.id}>
                <div className="faculty-card-header">
                  <div className="avatar-circle">
                    {f.name.replace(/^Dr\.\s*|^Engr\.\s*|^Prof\.\s*|^Atty\.\s*/i, "").charAt(0)}
                  </div>
                  <div className="faculty-identity">
                    <div className="identity-top">
                      <h3>{f.name}</h3>
                      {f.title && <span className="title-tag">{f.title}</span>}
                    </div>
                    <span className="faculty-dept">{f.department} · {f.rank_detail || f.rank}</span>
                  </div>
                </div>

                <div className="faculty-body">
                  <div className="faculty-info-row">
                    <GraduationCap size={15} className="info-icon" />
                    <span>{f.degree_detail}</span>
                  </div>

                  {f.specialization && (
                    <div className="faculty-info-row">
                      <Award size={15} className="info-icon" />
                      <span>{f.specialization}</span>
                    </div>
                  )}

                  {f.prc_license && (
                    <div className="faculty-info-row">
                      <FileCheck size={15} className="info-icon" />
                      <span className="license-text">{f.prc_license}</span>
                    </div>
                  )}

                  <div className="faculty-tags">
                    <span className={`status-pill ${f.employment_status.includes("Full-Time") ? "ft" : "pt"}`}>
                      {f.employment_status}
                    </span>
                    <span className="load-pill">{f.teaching_load} units load</span>
                    {f.student_eval_rating != null && (
                      <span className="rating-pill">
                        <Star size={11} /> {Number(f.student_eval_rating).toFixed(2)} rating
                      </span>
                    )}
                  </div>
                </div>

                <div className="faculty-card-footer">
                  <button className="btn secondary dossier-btn" onClick={() => setDossierFaculty(f)}>
                    View Dossier
                  </button>
                  <div className="footer-actions">
                    <button className="icon-btn" onClick={() => { setEditingFaculty(f); setModalOpen(true); }} title="Edit Profile">
                      Edit
                    </button>
                    <button className="icon-btn danger-text" onClick={() => setDeleteId(f.id)} title="Delete Faculty Member">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit Faculty Modal */}
        <FacultyFormModal 
          open={modalOpen} 
          faculty={editingFaculty} 
          onClose={() => setModalOpen(false)} 
          onSave={handleSaveFaculty} 
        />

        {/* Full Dossier View Modal */}
        {dossierFaculty && (
          <FacultyDossierModal 
            faculty={dossierFaculty} 
            onClose={() => setDossierFaculty(null)} 
            onEdit={() => { 
              const m = dossierFaculty; 
              setDossierFaculty(null); 
              setEditingFaculty(m); 
              setModalOpen(true); 
            }} 
          />
        )}

        {/* Category Details & Compliance Exhibits Modal */}
        {selectedCategoryModal && (
          <CategoryDetailModal
            category={selectedCategoryModal}
            facultyList={faculty}
            facultyArea={facultyArea}
            onClose={() => setSelectedCategoryModal(null)}
            onFilterRoster={() => {
              handleSelectCategoryFilter(selectedCategoryModal.letter);
              setSelectedCategoryModal(null);
            }}
          />
        )}

        {/* Delete Confirmation */}
        <Confirm 
          open={deleteId !== null} 
          title="Remove Faculty Member?" 
          body="This faculty member's profile and credentials records will be removed from your local roster." 
          onCancel={() => setDeleteId(null)} 
          onConfirm={handleDelete} 
        />

        <Toast message={toast.message} />
      </div>
    </Layout>
  );
}

function CategoryDetailModal({
  category: cat,
  facultyList,
  facultyArea,
  onClose,
  onFilterRoster
}: {
  category: FacultyCategory;
  facultyList: FacultyMember[];
  facultyArea?: Area;
  onClose: () => void;
  onFilterRoster: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal glass category-modal">
        <button className="icon-btn close" onClick={onClose}><X size={18} /></button>
        
        <div className="cat-modal-head">
          <div className="cat-icon-badge large">{getCategoryIcon(cat.letter, 24)}</div>
          <div>
            <span className="eyebrow">AACCUP AREA II/III · PARAMETER {cat.letter}</span>
            <h2>{cat.name}</h2>
            <p className="modal-sub">{cat.description}</p>
          </div>
        </div>

        <div className="cat-benchmark-callout glass-sub">
          <strong>AACCUP Accrediting Benchmark Statement</strong>
          <p>{cat.benchmarkStatement}</p>
        </div>

        <div className="cat-modal-sections">
          <div className="cat-evidence-box glass-sub">
            <h4>Required Compliance Exhibits &amp; Evidence ({cat.evidenceRequired.length})</h4>
            <div className="evidence-list">
              {cat.evidenceRequired.map((doc, i) => (
                <div key={i} className="evidence-item">
                  <span className="check-icon">✓</span>
                  <span>{doc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="cat-metrics-box glass-sub">
            <h4>Accreditation Status &amp; Metrics</h4>
            <div className="metric-line">
              <label>Current Status:</label>
              <strong className="status-highlight">{cat.status}</strong>
            </div>
            <div className="metric-line">
              <label>Summary Measure:</label>
              <span>{cat.metricsSummary}</span>
            </div>
            <div className="metric-line">
              <label>Estimated Area Rating:</label>
              <strong>{cat.complianceRating?.toFixed(2)} / 5.00</strong>
            </div>
            {facultyArea && (
              <div className="metric-line">
                <label>Linked Backend Area:</label>
                <Link to={`/areas/${facultyArea.id}`} className="link-inline">
                  {facultyArea.name} →
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="actions">
          <button type="button" className="btn secondary" onClick={onFilterRoster}>
            Filter Faculty by This Category
          </button>
          <button type="button" className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function FacultyFormModal({
  open, 
  faculty, 
  onClose, 
  onSave 
}: {
  open: boolean; 
  faculty: FacultyMember | null; 
  onClose: () => void; 
  onSave: (data: Omit<FacultyMember, "id">, id?: string) => void;
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [rank, setRank] = useState<FacultyMember["rank"]>("Assistant Professor");
  const [rankDetail, setRankDetail] = useState("");
  const [department, setDepartment] = useState("");
  const [highestDegree, setHighestDegree] = useState<FacultyMember["highest_degree"]>("Master's");
  const [degreeDetail, setDegreeDetail] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<FacultyMember["employment_status"]>("Full-Time Permanent");
  const [teachingLoad, setTeachingLoad] = useState("18");
  const [prcLicense, setPrcLicense] = useState("");
  const [email, setEmail] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [rating, setRating] = useState("4.80");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (faculty) {
      setName(faculty.name);
      setTitle(faculty.title || "");
      setRank(faculty.rank);
      setRankDetail(faculty.rank_detail || "");
      setDepartment(faculty.department);
      setHighestDegree(faculty.highest_degree);
      setDegreeDetail(faculty.degree_detail);
      setEmploymentStatus(faculty.employment_status);
      setTeachingLoad(String(faculty.teaching_load));
      setPrcLicense(faculty.prc_license || "");
      setEmail(faculty.email);
      setSpecialization(faculty.specialization);
      setRating(faculty.student_eval_rating != null ? String(faculty.student_eval_rating) : "4.80");
      setNotes(faculty.notes || "");
    } else {
      setName("");
      setTitle("");
      setRank("Assistant Professor");
      setRankDetail("");
      setDepartment("Computer Science");
      setHighestDegree("Master's");
      setDegreeDetail("");
      setEmploymentStatus("Full-Time Permanent");
      setTeachingLoad("18");
      setPrcLicense("");
      setEmail("");
      setSpecialization("");
      setRating("4.80");
      setNotes("");
    }
  }, [faculty, open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name: name.trim(),
      title: title.trim(),
      rank,
      rank_detail: rankDetail.trim() || undefined,
      department: department.trim(),
      college: "College of Information & Computing Sciences",
      highest_degree: highestDegree,
      degree_detail: degreeDetail.trim(),
      employment_status: employmentStatus,
      teaching_load: Number(teachingLoad) || 0,
      prc_license: prcLicense.trim() || undefined,
      email: email.trim(),
      specialization: specialization.trim(),
      student_eval_rating: rating ? Number(rating) : undefined,
      notes: notes.trim() || undefined
    }, faculty ? faculty.id : undefined);
  }

  return (
    <Modal title={faculty ? "Edit Faculty Member" : "Add Faculty Member"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="faculty-form">
        <div className="form-grid">
          <label>
            Full Name
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Dr. Juan Dela Cruz" 
              required 
            />
          </label>
          <label>
            Post-nominal Title / Honorific
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="e.g. Ph.D., LPT, PECE" 
            />
          </label>
        </div>

        <div className="form-grid">
          <label>
            Academic Rank
            <select value={rank} onChange={e => setRank(e.target.value as FacultyMember["rank"])}>
              <option value="Professor">Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Assistant Professor">Assistant Professor</option>
              <option value="Instructor">Instructor</option>
              <option value="Lecturer">Lecturer</option>
            </select>
          </label>
          <label>
            Rank Detail / Sub-rank
            <input 
              value={rankDetail} 
              onChange={e => setRankDetail(e.target.value)} 
              placeholder="e.g. Professor IV, Assoc. Prof II" 
            />
          </label>
        </div>

        <div className="form-grid">
          <label>
            Department
            <input 
              value={department} 
              onChange={e => setDepartment(e.target.value)} 
              placeholder="e.g. Computer Science" 
              required 
            />
          </label>
          <label>
            Employment Status
            <select value={employmentStatus} onChange={e => setEmploymentStatus(e.target.value as FacultyMember["employment_status"])}>
              <option value="Full-Time Permanent">Full-Time Permanent</option>
              <option value="Full-Time Temporary">Full-Time Temporary</option>
              <option value="Part-Time">Part-Time</option>
              <option value="Adjunct">Adjunct</option>
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label>
            Highest Degree Level
            <select value={highestDegree} onChange={e => setHighestDegree(e.target.value as FacultyMember["highest_degree"])}>
              <option value="Doctorate">Doctorate (Ph.D. / D.Eng. / DIT)</option>
              <option value="Master's">Master's (M.S. / M.Eng. / MIT / MBA)</option>
              <option value="Baccalaureate">Baccalaureate (B.S. / B.A.)</option>
            </select>
          </label>
          <label>
            Teaching Load (Units)
            <input 
              type="number" 
              value={teachingLoad} 
              onChange={e => setTeachingLoad(e.target.value)} 
              min={0} 
              max={36} 
              required 
            />
          </label>
        </div>

        <label>
          Degree Detail & Alma Mater (AACCUP Area III Requirement)
          <input 
            value={degreeDetail} 
            onChange={e => setDegreeDetail(e.target.value)} 
            placeholder="e.g. Ph.D. in Computer Science — University of the Philippines Diliman" 
            required 
          />
        </label>

        <div className="form-grid">
          <label>
            PRC Professional License / Certification
            <input 
              value={prcLicense} 
              onChange={e => setPrcLicense(e.target.value)} 
              placeholder="e.g. PRC LPT #089421 or PECE" 
            />
          </label>
          <label>
            Student Evaluation Rating (0.00 – 5.00)
            <input 
              type="number" 
              step="0.01" 
              min="0" 
              max="5" 
              value={rating} 
              onChange={e => setRating(e.target.value)} 
              placeholder="4.85" 
            />
          </label>
        </div>

        <div className="form-grid">
          <label>
            Specialization / Research Fields
            <input 
              value={specialization} 
              onChange={e => setSpecialization(e.target.value)} 
              placeholder="e.g. Artificial Intelligence & Algorithms" 
            />
          </label>
          <label>
            Institutional Email
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="faculty@university.edu.ph" 
            />
          </label>
        </div>

        <label>
          Accreditation Notes / Administrative Role
          <textarea 
            value={notes} 
            onChange={e => setNotes(e.target.value)} 
            rows={2} 
            placeholder="e.g. Lead evaluator for curriculum development or thesis coordinator." 
          />
        </label>

        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">
            {faculty ? "Update Faculty" : "Add Faculty Member"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FacultyDossierModal({
  faculty: f, 
  onClose, 
  onEdit 
}: { 
  faculty: FacultyMember; 
  onClose: () => void; 
  onEdit: () => void; 
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal glass dossier-modal">
        <button className="icon-btn close" onClick={onClose}><X size={18} /></button>
        
        <div className="dossier-head">
          <div className="avatar-circle large">
            {f.name.replace(/^Dr\.\s*|^Engr\.\s*|^Prof\.\s*|^Atty\.\s*/i, "").charAt(0)}
          </div>
          <div>
            <span className="eyebrow">AACCUP AREA III · FACULTY DOSSIER</span>
            <h2>{f.name} {f.title && <small>({f.title})</small>}</h2>
            <p className="dossier-sub">{f.rank_detail || f.rank} · {f.department}</p>
          </div>
        </div>

        <div className="dossier-grid">
          <div className="dossier-section glass-sub">
            <h4>Academic Profile & Qualifications</h4>
            <div className="dossier-item">
              <label>Highest Degree:</label>
              <strong>{f.highest_degree}</strong>
            </div>
            <div className="dossier-item">
              <label>Degree & Institution:</label>
              <span>{f.degree_detail}</span>
            </div>
            <div className="dossier-item">
              <label>Specialization:</label>
              <span>{f.specialization || "General Computing"}</span>
            </div>
            {f.prc_license && (
              <div className="dossier-item">
                <label>PRC / Professional License:</label>
                <span className="license-badge">{f.prc_license}</span>
              </div>
            )}
          </div>

          <div className="dossier-section glass-sub">
            <h4>Teaching & Service Assignment</h4>
            <div className="dossier-item">
              <label>Employment Status:</label>
              <span className={`status-pill ${f.employment_status.includes("Full-Time") ? "ft" : "pt"}`}>
                {f.employment_status}
              </span>
            </div>
            <div className="dossier-item">
              <label>Current Teaching Load:</label>
              <strong>{f.teaching_load} units / week</strong>
            </div>
            <div className="dossier-item">
              <label>Student Evaluation (SET):</label>
              <strong>{f.student_eval_rating != null ? `${Number(f.student_eval_rating).toFixed(2)} / 5.00 (Exemplary)` : "Pending"}</strong>
            </div>
            <div className="dossier-item">
              <label>Institutional Email:</label>
              <span>{f.email || "N/A"}</span>
            </div>
          </div>
        </div>

        <div className="dossier-evidence-check glass-sub">
          <h4>AACCUP Evidence Compliance Checklist</h4>
          <div className="checklist-items">
            <div className="check-item"><span className="check-icon">✓</span> Transcripts of Records (TOR) & Diplomas Verified</div>
            <div className="check-item"><span className="check-icon">✓</span> Certificate of Employment & Plantilla Appointment</div>
            <div className="check-item"><span className="check-icon">✓</span> PRC Professional Board License Certificate</div>
            <div className="check-item"><span className="check-icon">✓</span> Teaching Load & Faculty Schedule (Form 47)</div>
            <div className="check-item"><span className="check-icon">✓</span> Student Evaluation of Teachers (SET) Ratings</div>
          </div>
        </div>

        {f.notes && (
          <div className="dossier-notes">
            <small>Evaluation Notes: {f.notes}</small>
          </div>
        )}

        <div className="actions">
          <button type="button" className="btn secondary" onClick={onEdit}>Edit Details</button>
          <button type="button" className="btn primary" onClick={onClose}>Close Dossier</button>
        </div>
      </div>
    </div>
  );
}
