// =============================================
// src/pages/Project.jsx
// =============================================
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import Swal from "sweetalert2";
import ProjectScopeViewer from "../components/ProjectScopeViewer";
import EditProjectRequestModal from "../components/modals/EditProjectRequestModal";
import { deleteDriveFiles, deleteDriveFolders } from "../lib/storageUtils";

// ================= GENERIC HELPERS =================
const C = { confirm: "#4f46e5", danger: "#e11d48", ok: "#10b981", cancel: "#94a3b8" };

const one = (x) => (Array.isArray(x) ? x[0] : x);

const confirmSwal = (title, text, opts = {}) =>
  Swal.fire({
    title, text, icon: opts.icon || "warning", showCancelButton: true, reverseButtons: true,
    confirmButtonColor: opts.danger ? C.danger : (opts.color || C.confirm),
    cancelButtonColor: C.cancel,
    confirmButtonText: opts.confirmText || "ยืนยัน",
    cancelButtonText: opts.cancelText || "ยกเลิก",
    input: opts.input, inputPlaceholder: opts.inputPlaceholder, inputValidator: opts.inputValidator,
    customClass: { popup: "rounded-2xl" },
  });

const toast = (title, icon = "success") =>
  Swal.fire({ toast: true, position: "bottom-end", icon, title, showConfirmButton: false, timer: 2000 });

const alertOk = (title, text) => Swal.fire({ title, text, icon: "success", confirmButtonColor: C.confirm, customClass: { popup: "rounded-2xl" } });
const alertErr = (err) => Swal.fire({ title: "ข้อผิดพลาด", text: err.message || String(err), icon: "error", confirmButtonColor: C.confirm });
const loadingSwal = (title = "กำลังดำเนินการ...") => Swal.fire({ title, allowOutsideClick: false, didOpen: () => Swal.showLoading() });

const runWithLoading = async (action, loadingTitle) => {
  loadingSwal(loadingTitle);
  try {
    await action();
  } catch (err) {
    alertErr(err);
  }
};

const confirmAndRun = async (title, text, opts, action) => {
  const result = await confirmSwal(title, text, opts);
  if (!result.isConfirmed) return;
  await runWithLoading(() => action(result.value), opts.loadingTitle);
};

const notify = (emails, message) => {
  const list = (emails || []).filter(Boolean);
  if (!list.length) return Promise.resolve();
  return supabase.from("notifications").insert(list.map((user_id) => ({ user_id, message })));
};

const formatForInput = (utcDateStr) => {
  if (!utcDateStr) return "";
  const d = new Date(utcDateStr);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatThaiDate = (utcDateStr) => {
  if (!utcDateStr) return "";
  const date = new Date(utcDateStr);
  const dateString = date.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const timeString = date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return `${dateString} เวลา ${timeString} น.`;
};

const pickLatestScores = (reports = []) => {
  if (!reports.length) return { work: null, doc: null };
  const sorted = [...reports].sort((a, b) => b.week_number - a.week_number);
  const graded = sorted.find((r) => r.weekly_score_work !== null || r.weekly_score_document !== null || r.status === "reviewed");
  return {
    work: graded?.weekly_score_work != null ? Number(graded.weekly_score_work) : null,
    doc: graded?.weekly_score_document != null ? Number(graded.weekly_score_document) : null,
  };
};

// ================= SHARED SUPABASE SELECTS =================
const PROJECT_DETAIL_SELECT = `*, leader:users!projects_leader_id_fkey(first_name, last_name, profile_image, email, faculty, major),
  project_members(student_id, status, users:users!project_members_student_id_fkey(first_name, last_name, profile_image, email, faculty, major)),
  project_reports(report_id, drive_link, weekly_score_work, weekly_score_document, week_number, status, due_date, task_assigned, task_submitted_title, advisor_feedback, instructor_feedback, pdf_url, advisor_pdf_url)`;

const PROJECT_LIST_SELECT = `project_id, project_code, title, status, created_at, description, advisor_id, co_advisor_id, co_advisor_status, leader_id,
  leader:users!projects_leader_id_fkey(first_name, last_name, profile_image),
  project_members(student_id, status, users:users!project_members_student_id_fkey(first_name, last_name, profile_image)),
  project_reports(report_id, drive_link, weekly_score_work, weekly_score_document, week_number, status, due_date, task_assigned, task_submitted_title, pdf_url, advisor_pdf_url)`;


const withScores = (project) => {
  const { work, doc } = pickLatestScores(project.project_reports);
  return { ...project, score_work: work, score_document: doc, scopes: Array.isArray(project.scopes) ? project.scopes : [] };
};

import { Icon, Avatar, ScoreBar, ScoreInput, PdfFileRow, PdfUploadInput, ModalShell, getProgressColor } from "../components/SharedUI";

const UpcomingReportBadge = ({ report }) => {
  const isSubmitted = report.status === "submitted";
  const isLate = new Date() > new Date(report.due_date);
  const tone = isSubmitted ? "emerald" : isLate ? "rose" : "amber";
  const title = isSubmitted
    ? "ส่งงานสัปดาห์นี้แล้ว"
    : isLate ? "ยังไม่ส่งงาน (เลยกำหนด)" : `นัดส่งงาน (W${report.week_number})`;
  const subtitle = isSubmitted ? `รอการตรวจให้คะแนน (W${report.week_number})` : `กำหนด: ${formatThaiDate(report.due_date)}`;
  const iconName = isSubmitted ? "check" : isLate ? "x" : "calendar";
  return (
    <div className={`p-3 bg-${tone}-50${tone}-900/30 border border-${tone}-100${tone}-800 rounded-xl flex items-start gap-2`}>
      <Icon name={iconName} className={`w-4 h-4 text-${tone}-600${tone}-400 mt-0.5 shrink-0`} />
      <div>
        <div className={`text-${tone}-700${tone}-300 font-bold text-[11px] mb-0.5`}>{title}</div>
        <div className={`text-[10px] text-${tone}-600${tone}-400 font-medium`}>{subtitle}</div>
      </div>
    </div>
  );
};

const ProjectListCard = ({ proj, authUserId, onOpen, onAccept, onReject }) => {
  const isPendingInvite = proj.co_advisor_id === authUserId && proj.co_advisor_status === "pending";
  return (
    <div onClick={() => onOpen(proj.project_id)}
      className={`bg-white p-5 rounded-2xl shadow-sm border cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col group h-full ${isPendingInvite ? "border-amber-200 bg-amber-50 hover:border-amber-400" : "border-slate-100 hover:border-indigo-300"}`}>
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {proj.project_code && (
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded-lg shrink-0 tracking-wide">{proj.project_code}</span>
          )}
          {proj.advisor_id === authUserId && <span className="px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-bold rounded-lg shrink-0">ที่ปรึกษาหลัก</span>}
          {proj.co_advisor_id === authUserId && (isPendingInvite
            ? <span className="px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg shrink-0 animate-pulse">มีคำเชิญ</span>
            : <span className="px-2.5 py-1 bg-sky-50 text-sky-600 border border-sky-100 text-[10px] font-bold rounded-lg shrink-0">ที่ปรึกษาร่วม</span>)}
        </div>
        <span className={`px-2.5 py-1 border text-[10px] font-extrabold tracking-wider rounded-lg shrink-0 ${proj.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"}`}>
          {(proj.status === "in_progress" || proj.status === "ongoing") ? "กำลังดำเนินการ" : proj.status === "completed" ? "เสร็จสิ้น" : proj.status}
        </span>
      </div>
      <h3 className="text-lg font-extrabold text-slate-900 mb-2 leading-snug break-words line-clamp-2" title={proj.title}>{proj.title}</h3>
      <p className="text-xs text-slate-500 mb-4 font-normal line-clamp-2 leading-relaxed" title={proj.description}>{proj.description || "ไม่มีคำอธิบายเพิ่มเติม"}</p>

      <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-auto">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">ความคืบหน้า</p>
        <div className="space-y-3">
          <ScoreBar label="ชิ้นงาน" score={proj.score_work} />
          <ScoreBar label="รูปเล่มโครงงาน" score={proj.score_document} />
        </div>
      </div>

      {proj.upcoming_report && <div className="mb-4"><UpcomingReportBadge report={proj.upcoming_report} /></div>}

      <div className="mb-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">สมาชิกในทีม</p>
        <div className="flex flex-wrap gap-2">
          {(() => {
            const members = [...(proj.project_members || [])];
            if (proj.leader && !members.some(m => m.student_id === proj.leader_id)) {
              members.unshift({ student_id: proj.leader_id, users: proj.leader, isLeader: true });
            }
            if (members.length === 0) {
              return <span className="text-[11px] text-slate-400 italic">ไม่มีข้อมูลสมาชิก</span>;
            }
            return members.map((member, idx) => {
              const u = one(member.users);
              return (
                <div key={idx} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                  <Avatar src={u?.profile_image} name={u?.first_name} size="w-5 h-5" tone="bg-slate-100 text-slate-600 border-slate-100" />
                  <span className="text-[11px] text-slate-700 font-semibold pr-1">{u?.first_name}</span>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-slate-400 font-bold tracking-wide">หัวหน้า:</p>
            <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[120px]">{proj.leader?.first_name}</p>
          </div>
          <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg font-bold shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">ดูรายละเอียด &gt;</span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-slate-400 font-bold tracking-wide">อ.ประจำวิชา:</p>
          <p className={`text-[11px] font-semibold ${proj.class_instructor ? "text-emerald-600" : "text-slate-400"}`}>
            {proj.class_instructor ? `${proj.class_instructor.prefix || ""}${proj.class_instructor.first_name} ${proj.class_instructor.last_name}` : "ยังไม่เข้าห้องเรียน"}
          </p>
        </div>
        {isPendingInvite && (
          <div className="mt-2 pt-3 border-t border-dashed border-slate-200 flex gap-2">
            <button onClick={(e) => onReject(e, proj.project_id)} className="flex-1 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-[11px] font-bold transition-all shadow-sm">ปฏิเสธ</button>
            <button onClick={(e) => onAccept(e, proj.project_id)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm">ยอมรับ</button>
          </div>
        )}
      </div>
    </div>
  );
};

const REPORT_STATUS_META = {
  reviewed: { bg: "bg-emerald-50 text-emerald-700 border-emerald-300", label: "ตรวจแล้ว", icon: "check" },
  submitted: { bg: "bg-sky-50 text-sky-700 border-sky-300", label: "ส่งงานแล้ว", icon: "check" },
};
const getWeekChipMeta = (report) => {
  if (report?.status && REPORT_STATUS_META[report.status]) return REPORT_STATUS_META[report.status];
  if (report?.status === "pending" || report?.due_date || report?.task_assigned) {
    return { bg: "bg-amber-50 text-amber-700 border-amber-300", label: report?.due_date ? "มีนัดหมาย" : "รอดำเนินการ", icon: "calendar" };
  }
  return { bg: "bg-white text-slate-500 border-slate-200 hover:border-slate-300", label: "ไม่มีกำหนด", icon: null };
};

// ================= ฟังก์ชันแปลง JSON URL กลับเป็น Object [{name, url}] =================
const parsePdfUrls = (jsonStr) => {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map(item => {
        if (typeof item === 'string') {
          const name = item.split('/').pop() || "ไฟล์แนบ.pdf";
          return { name: decodeURIComponent(name), url: item };
        }
        return item;
      });
    }
    return [{ name: "ไฟล์แนบ.pdf", url: jsonStr }];
  } catch {
    return [{ name: "ไฟล์แนบ.pdf", url: jsonStr }];
  }
};

// ---- Shared PDF-file helpers (dedupes the size-check & storage-upload logic) ----
const MAX_PDF_SIZE_MB = 35;

const findOversizedFile = (files, maxSizeMB = MAX_PDF_SIZE_MB) => {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return files.find((f) => f.size > maxBytes) || null;
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

const rawGas = import.meta.env.VITE_GAS_URL;
const rawFolder = import.meta.env.VITE_DRIVE_FOLDER_ID;

const SCRIPT_URL = (rawGas && rawGas.startsWith("http")) 
  ? rawGas 
  : (rawFolder && rawFolder.startsWith("http")) 
    ? rawFolder 
    : "https://script.google.com/macros/s/AKfycbwoUKTZc4n4p4FXdGDv2ZulyoItCRchlotQXl7zeYpumOAQpVUoowU9qM_oP-fsAEs3/exec";

const isValidFolderId = (id) => id && !id.startsWith("http") && !id.startsWith("AKfycb") && id.length < 45;

const FOLDER_ID = isValidFolderId(rawFolder) 
  ? rawFolder 
  : isValidFolderId(rawGas) 
    ? rawGas 
    : "1aGWh1P0Ry2yEI90NgZTCHz_SiSn7vLBG";

const uploadPdfFiles = async (files, keyPrefix, subfolderName, onProgress) => {
  if (!SCRIPT_URL || !FOLDER_ID) {
    throw new Error("ระบบยังไม่ได้ตั้งค่า VITE_GAS_URL หรือ VITE_DRIVE_FOLDER_ID ในไฟล์ .env");
  }

  const uploaded = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // แจ้งสถานะกำลังแปลงไฟล์
    if (onProgress) onProgress(0, i + 1, files.length, file.name, "กำลังเตรียมไฟล์...");
    const base64 = await fileToBase64(file);
    
    // 65MB = 65 * 1024 * 1024 bytes
    if (base64.length > 65 * 1024 * 1024) {
      throw new Error(`ไฟล์ ${file.name} มีขนาดใหญ่เกินกว่าที่เซิร์ฟเวอร์ Google จะรับไหว (เกิน 50MB)`);
    }

    const payload = {
      folderId: FOLDER_ID,
      filename: `${keyPrefix}_${Date.now()}_${i}.pdf`,
      mimeType: file.type || "application/pdf",
      subfolderName: subfolderName || "General",
      base64: base64
    };

    // แจ้งสถานะกำลังส่งไป Google Drive
    if (onProgress) onProgress(50, i + 1, files.length, file.name, "กำลังอัปโหลดไปที่ Google Drive... (ขั้นตอนนี้อาจใช้เวลาสักครู่)");

    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      credentials: "omit",
      redirect: "follow"
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("GAS raw response:", responseText);
      throw new Error(`ไม่สามารถอ่านข้อมูลตอบกลับจาก Google Drive ได้ (${responseText.substring(0, 80) || "Empty Response"}) โปรดตรวจสอบการ Deploy Web App ใน Google Apps Script ว่าเลือกผู้มีสิทธิ์เข้าถึงเป็น 'ทุกคน (Anyone)' หรือยัง`);
    }

    if (!result || !result.success) {
      throw new Error('ข้อผิดพลาดจาก Google Drive: ' + (result?.error || 'ไม่สามารถอัปโหลดไฟล์ได้'));
    }
    
    if (onProgress) onProgress(100, i + 1, files.length, file.name, "อัปโหลดสำเร็จ!");
    uploaded.push({ name: file.name, url: result.url });
  }
  return uploaded;
};

export default function Project() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("id");

  // ================= STATE =================
  const [authUser, setAuthUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem("dismissedAlerts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDismissAlert = (alertId) => {
    const updated = [...dismissedAlerts, alertId];
    setDismissedAlerts(updated);
    localStorage.setItem("dismissedAlerts", JSON.stringify(updated));
  };

  const [projectData, setProjectData] = useState(null);
  const [myProjects, setMyProjects] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [projectAdvisor, setProjectAdvisor] = useState(null);
  const [coAdvisor, setCoAdvisor] = useState(null);
  const [classInstructor, setClassInstructor] = useState(null);
  const [isAdvSameAsClassInst, setIsAdvSameAsClassInst] = useState(false);

  const [currentWeek, setCurrentWeek] = useState(1);
  const currentWeekRef = useRef(1);

  const [currentReportId, setCurrentReportId] = useState(null);
  const [reportStatus, setReportStatus] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  
  // State สำหรับนักศึกษา
  const [pdfFiles, setPdfFiles] = useState([]); 
  const [pdfUrls, setPdfUrls] = useState([]); // เก็บเป็น [{name, url}]
  const [deletedPdfUrls, setDeletedPdfUrls] = useState([]); // เก็บรายการไฟล์ PDF นศ. ที่ถูกกดลบรอส่งคำสั่งลบจริงใน Drive

  // State สำหรับอาจารย์แนบไฟล์ส่งกลับ
  const [advisorPdfFiles, setAdvisorPdfFiles] = useState([]);
  const [advisorPdfUrls, setAdvisorPdfUrls] = useState([]); // เก็บเป็น [{name, url}]
  const [deletedAdvPdfUrls, setDeletedAdvPdfUrls] = useState([]); // เก็บรายการไฟล์ PDF อ. ที่ถูกกดลบรอส่งคำสั่งลบจริงใน Drive

  const [dueDate, setDueDate] = useState("");
  const [isLate, setIsLate] = useState(false);
  const [isSavingUpdates, setIsSavingUpdates] = useState(false);
  const [isSubmittedInPerson, setIsSubmittedInPerson] = useState(false);

  const [taskAssigned, setTaskAssigned] = useState("");
  const [taskSubmittedTitle, setTaskSubmittedTitle] = useState("");

  const [reviewRole, setReviewRole] = useState("advisor"); 
  
  const [weeklyScoreWork, setWeeklyScoreWork] = useState("");
  const [weeklyScoreDoc, setWeeklyScoreDoc] = useState("");
  const [feedback, setFeedback] = useState("");

  const [instFeedback, setInstFeedback] = useState("");

  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isEditScopeModalOpen, setIsEditScopeModalOpen] = useState(false);
  const [tempScopes, setTempScopes] = useState([]);
  const [hasUnsavedScopeChanges, setHasUnsavedScopeChanges] = useState(false);

  const [originalRequest, setOriginalRequest] = useState(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [forceEdit, setForceEdit] = useState(false);

  const isFirstLoad = useRef(true);

  const [isAddWeekModalOpen, setIsAddWeekModalOpen] = useState(false);
  const [newWeekNumber, setNewWeekNumber] = useState(1);
  const [newWeekTask, setNewWeekTask] = useState("");
  const [newWeekDueDate, setNewWeekDueDate] = useState("");

  const [isInviteMemberModalOpen, setIsInviteMemberModalOpen] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [isSearchingInvite, setIsSearchingInvite] = useState(false);
  const [selectedStudentsToInvite, setSelectedStudentsToInvite] = useState([]);
  const [isInvitingMembers, setIsInvitingMembers] = useState(false);

  useEffect(() => { currentWeekRef.current = currentWeek; }, [currentWeek]);

  const isStudent = role === "STUDENT";
  const isAdvisorRole = role === "ADVISOR" || role === "ADMIN";
  const isAdmin = role === "ADMIN";

  const withSaving = useCallback(async (action) => {
    setIsSavingUpdates(true);
    try {
      await action();
    } catch (err) {
      alertErr(err);
    } finally {
      setIsSavingUpdates(false);
    }
  }, []);

  const applyReportToForm = useCallback((report) => {
    setCurrentReportId(report?.report_id ?? null);
    setReportStatus(report?.status || "");
    setDriveUrl(report?.drive_link || "");
    
    setPdfUrls(parsePdfUrls(report?.pdf_url));
    setAdvisorPdfUrls(parsePdfUrls(report?.advisor_pdf_url));
    setPdfFiles([]); 
    setAdvisorPdfFiles([]);
    setDeletedPdfUrls([]);
    setDeletedAdvPdfUrls([]);

    setDueDate(report?.due_date ? formatForInput(report.due_date) : "");
    setTaskAssigned(report?.task_assigned || "");
    setTaskSubmittedTitle(report?.task_submitted_title || "");
    
    setFeedback(report?.advisor_feedback || "");
    setWeeklyScoreWork(report?.weekly_score_work ?? "");
    setWeeklyScoreDoc(report?.weekly_score_document ?? "");

    setInstFeedback(report?.instructor_feedback || "");

    setIsSubmittedInPerson(false);
    setIsAssignmentOpen(false); // <--- แก้ให้พับอยู่เสมอตามความต้องการ
    setForceEdit(false);
  }, []);

  const resolveReportId = useCallback((week) => {
    if (currentReportId) return currentReportId;
    return projectData?.project_reports?.find((r) => r.week_number === week)?.report_id ?? null;
  }, [currentReportId, projectData]);

  // ================= FETCH DATA =================
  const fetchProjectDetails = useCallback(async () => {
    try {
      if (isFirstLoad.current) setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;
      if (!currentUser) return navigate("/login", { replace: true });

      let { data: profile } = await supabase.from("users").select("*").eq("auth_id", currentUser.id).maybeSingle();
      if (!profile) {
        const { data: byEmail } = await supabase.from("users").select("*").eq("email", currentUser.email).maybeSingle();
        profile = byEmail;
      }
      if (!profile) return;

      const prefix = profile.prefix || "";
      const lName = profile.last_name !== "ไม่ระบุ" && profile.last_name !== "-" ? profile.last_name : "";
      setFullName(`${prefix}${profile.first_name || ""} ${lName}`.trim());
      setProfileImage(profile.profile_image || "");
      const userRole = profile.role?.toUpperCase() || "STUDENT";
      setRole(userRole);
      setAuthUser(currentUser);

      if (projectId) {
        const { data: project, error: projectError } = await supabase
          .from("projects").select(PROJECT_DETAIL_SELECT).eq("project_id", projectId).single();
        if (projectError) throw projectError;
        if (!project) return;

        if (userRole === "STUDENT") {
          const isLeader = project.leader_id === currentUser.id;
          const isApprovedMember = project.project_members?.some(m => m.student_id === currentUser.id && m.status?.toLowerCase() === 'approved');
          if (!isLeader && !isApprovedMember) {
            Swal.fire("ปฏิเสธการเข้าถึง", "คุณยังไม่ได้เป็นสมาชิกในโครงงานนี้", "warning");
            return navigate("/project", { replace: true });
          }
        }

        setProjectData(withScores(project));

        let targetWeek = currentWeekRef.current;
        if (isFirstLoad.current) {
          targetWeek = project.project_reports?.length > 0 ? Math.max(...project.project_reports.map((r) => r.week_number)) : 1;
          setCurrentWeek(targetWeek);
          isFirstLoad.current = false;
        }

        fetchWeeklyReport(projectId, targetWeek, project.project_reports);

        if (project.leader_id && project.advisor_id) {
          const { data: reqData } = await supabase.from("requests")
            .select("request_id, project_scope, language_used, diagram_url, message")
            .eq("student_id", project.leader_id).eq("advisor_id", project.advisor_id).eq("project_title", project.title)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (reqData) setOriginalRequest(reqData);
        }
        let currentClassAdvId = null;
        const memberIds = project.project_members?.map((m) => m.student_id) || [];
        if (project.leader_id && !memberIds.includes(project.leader_id)) memberIds.push(project.leader_id);

        if (memberIds.length) {
          const { data: roomData } = await supabase.from("room_members")
            .select(`room_id, status, project_rooms ( advisor_id )`)
            .in("user_id", memberIds).eq("status", "approved").order("joined_at", { ascending: false }).limit(1).maybeSingle();
          currentClassAdvId = one(roomData?.project_rooms)?.advisor_id;
        }

        const [{ data: classInstructorData }, { data: mainAdvData }] = await Promise.all([
          currentClassAdvId ? supabase.from("users").select("*").eq("auth_id", currentClassAdvId).maybeSingle() : Promise.resolve({ data: null }),
          project.advisor_id ? supabase.from("users").select("*").eq("auth_id", project.advisor_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        let coAdvData = null;
        if (project.co_advisor_id && project.co_advisor_id !== project.advisor_id) {
          coAdvData = (await supabase.from("users").select("*").eq("auth_id", project.co_advisor_id).maybeSingle()).data;
        }

        setProjectAdvisor(mainAdvData);
        setCoAdvisor(coAdvData);
        setClassInstructor(classInstructorData);
        setIsAdvSameAsClassInst(!!currentClassAdvId && !!project.advisor_id && currentClassAdvId === project.advisor_id);
        return;
      }

      if (userRole === "ADVISOR" || userRole === "ADMIN") {
        let query = supabase.from("projects").select(PROJECT_LIST_SELECT).neq("status", "cancelled").order("created_at", { ascending: false });
        if (userRole !== "ADMIN") query = query.or(`advisor_id.eq.${profile.auth_id},co_advisor_id.eq.${profile.auth_id}`);

        const { data: advProjects, error: advErr } = await query;
        if (advErr || !advProjects) return;

        const leaderIds = advProjects.map((p) => p.leader_id).filter(Boolean);
        let classInstructorsMap = {};
        if (leaderIds.length) {
          const { data: rooms } = await supabase.from("room_members")
            .select(`user_id, project_rooms ( advisor:users!project_rooms_advisor_id_fkey(prefix, first_name, last_name) )`)
            .in("user_id", leaderIds).eq("status", "approved");
          rooms?.forEach((r) => {
            const roomInfo = one(r.project_rooms);
            const advInfo = roomInfo?.advisor || roomInfo?.users;
            if (advInfo) classInstructorsMap[r.user_id] = advInfo;
          });
        }

        setMyProjects(advProjects.map((p) => {
          const pending = (p.project_reports || []).filter((r) => r.due_date && r.status !== "reviewed").sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
          return { ...withScores(p), class_instructor: classInstructorsMap[p.leader_id] || null, upcoming_report: pending[0] || null };
        }));
        return;
      }

      // ฝั่งนักศึกษา: ตรวจสอบและดึงข้อมูลโครงงานทั้งหมดและคำขอ
      const { data: memberRows } = await supabase.from("project_members").select("project_id").eq("student_id", profile.auth_id).eq("status", "approved");
      const { data: leadRows } = await supabase.from("projects").select("project_id").eq("leader_id", profile.auth_id).neq("status", "cancelled");
      
      const projectIds = new Set([
        ...(memberRows?.map(r => r.project_id) || []),
        ...(leadRows?.map(r => r.project_id) || [])
      ]);

      const { data: stRequests } = await supabase.from("requests")
        .select(`request_id, project_title, status, created_at, advisor:users!requests_advisor_id_fkey(prefix, first_name, last_name)`)
        .eq("student_id", profile.auth_id)
        .in("status", ["pending", "rejected"]);
      
      const fetchedRequests = stRequests || [];
      setMyRequests(fetchedRequests);

      if (projectIds.size > 0 || fetchedRequests.length > 0) {
        let stProjects = [];
        if (projectIds.size > 0) {
          const { data, error: stErr } = await supabase.from("projects").select(PROJECT_LIST_SELECT).in("project_id", Array.from(projectIds)).neq("status", "cancelled").order("created_at", { ascending: false });
          if (!stErr && data) stProjects = data;
        }

        const isSingleActive = stProjects.length === 1 && stProjects[0].status !== "completed" && fetchedRequests.length === 0;
        
        if (isSingleActive) {
          return navigate(`/project?id=${stProjects[0].project_id}`, { replace: true });
        } else {
          const leaderIds = stProjects.map((p) => p.leader_id).filter(Boolean);
          let classInstructorsMap = {};
          if (leaderIds.length) {
            const { data: rooms } = await supabase.from("room_members")
              .select(`user_id, project_rooms ( advisor:users!project_rooms_advisor_id_fkey(prefix, first_name, last_name) )`)
              .in("user_id", leaderIds).eq("status", "approved");
            rooms?.forEach((r) => {
              const roomInfo = one(r.project_rooms);
              const advInfo = roomInfo?.advisor || roomInfo?.users;
              if (advInfo) classInstructorsMap[r.user_id] = advInfo;
            });
          }
          setMyProjects(stProjects.map((p) => {
            const pending = (p.project_reports || []).filter((r) => r.due_date && r.status !== "reviewed").sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
            return { ...withScores(p), class_instructor: classInstructorsMap[p.leader_id] || null, upcoming_report: pending[0] || null };
          }));
          return;
        }
      }
    } catch (error) {
      console.error("Fetch Project Error:", error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, projectId]);

  // eslint-disable-next-line
  useEffect(() => { fetchProjectDetails(); }, [fetchProjectDetails]);

  const openEditModal = () => {
    setIsEditModalOpen(true);
    setIsRequestModalOpen(false);
  };

  async function fetchWeeklyReport(pId, weekNum, allReports = projectData?.project_reports) {
    try {
      const { data: reports } = await supabase
        .from("project_reports").select("*")
        .eq("project_id", pId).eq("week_number", weekNum)
        .order("created_at", { ascending: false }).limit(1);

      const report = reports?.[0] || null;

      let workScore = report?.weekly_score_work ?? null;
      let docScore = report?.weekly_score_document ?? null;

      if ((workScore === null || docScore === null) && allReports) {
        const prev = [...allReports].filter((r) => r.week_number < weekNum).sort((a, b) => b.week_number - a.week_number);
        if (workScore === null) workScore = prev.find((r) => r.weekly_score_work !== null)?.weekly_score_work ?? null;
        if (docScore === null) docScore = prev.find((r) => r.weekly_score_document !== null)?.weekly_score_document ?? null;
      }

      applyReportToForm(report ? { 
        ...report, 
        weekly_score_work: workScore, 
        weekly_score_document: docScore
      } : null);

      if (report?.due_date) {
        const dueTime = new Date(report.due_date).getTime();
        setIsLate(report.status === "pending" || !report.status ? Date.now() > dueTime : report.status === "submitted" && report.updated_at ? new Date(report.updated_at).getTime() > dueTime : false);
      } else {
        setIsLate(false);
      }
    } catch (err) {
      console.error("Fetch Weekly Report Error:", err);
    }
  };

  const refreshAfterUpdate = async () => {
    if (!projectId) return;
    try {
      const { data: project } = await supabase.from("projects").select(PROJECT_DETAIL_SELECT).eq("project_id", projectId).single();
      if (project) {
        setProjectData(withScores(project));
        fetchWeeklyReport(projectId, currentWeekRef.current, project.project_reports);
      }
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  };

  useEffect(() => {
    const channel = supabase.channel(`realtime-project-${projectId || 'list'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_reports' }, (payload) => {
        console.log("Realtime project_reports update:", payload);
        if (projectId && (payload.new?.project_id === projectId || payload.old?.project_id === projectId)) {
           refreshAfterUpdate();
        } else if (!projectId) {
           fetchProjectDetails();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        if (projectId && (payload.new?.project_id === projectId || payload.old?.project_id === projectId)) {
           refreshAfterUpdate();
        } else if (!projectId) {
           fetchProjectDetails();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, (payload) => {
        if (projectId && (payload.new?.project_id === projectId || payload.old?.project_id === projectId)) {
           refreshAfterUpdate();
        } else if (!projectId) {
           fetchProjectDetails();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fetchProjectDetails]);

  const handleWeekChange = (weekNum) => {
    setCurrentWeek(weekNum);
    if (projectId) fetchWeeklyReport(projectId, weekNum, projectData?.project_reports);
  };

  // ================= SCOPE / CHECKLIST =================
  const handleOpenEditScope = () => {
    let scopes = projectData.scopes ? [...projectData.scopes] : [];
    if (scopes.length && scopes[0].title !== undefined) scopes = [{ mainTitle: "ขอบเขตทั่วไป", score: scopes[0].score || "", subScopes: scopes }];
    if (!scopes.length) scopes = [{ mainTitle: "", score: "", subScopes: [{ title: "", score: "" }] }];
    setTempScopes(JSON.parse(JSON.stringify(scopes)));
    setIsEditScopeModalOpen(true);
  };

  const updateTempScopes = (fn) => setTempScopes((prev) => {
    const next = JSON.parse(JSON.stringify(prev));
    fn(next);
    return next;
  });
  const handleMainScopeChange = (m, v) => updateTempScopes((s) => (s[m].mainTitle = v));
  const handleSubScopeChange = (m, s2, v) => updateTempScopes((s) => (s[m].subScopes[s2].title = v));
  const handleAddMainScope = () => setTempScopes((s) => [...s, { mainTitle: "", score: "", subScopes: [{ title: "", score: "" }] }]);
  const handleAddSubScope = (m) => updateTempScopes((s) => { if (!s[m].subScopes) s[m].subScopes = []; s[m].subScopes.push({ title: "", score: "" }); });
  const handleRemoveMainScope = (m) => setTempScopes((s) => s.filter((_, i) => i !== m));
  const handleRemoveSubScope = (m, s2) => updateTempScopes((s) => (s[m].subScopes = s[m].subScopes.filter((_, i) => i !== s2)));

  const handleSaveScopes = () => withSaving(async () => {
    const finalScopes = tempScopes
      .map((m) => ({
        mainTitle: m.mainTitle?.trim() || "ขอบเขตหลักเพิ่มเติม",
        score: m.score || "",
        subScopes: (m.subScopes || []).filter((s) => s.title?.trim() !== "").map((s) => ({ title: s.title, score: s.score || "" })),
      }))
      .filter((m) => m.subScopes.length || m.mainTitle !== "ขอบเขตหลักเพิ่มเติม");

    const { error } = await supabase.from("projects").update({ scopes: finalScopes }).eq("project_id", projectId);
    if (error) throw error;
    setProjectData((prev) => ({ ...prev, scopes: finalScopes }));
    setIsEditScopeModalOpen(false);
    setHasUnsavedScopeChanges(false);
    toast("อัปเดตขอบเขตเรียบร้อย");
  });

  const handleScopeScoreChange = (mIndex, sIndex, value) => {
    if (role !== "STUDENT" && !isAdmin) return;
    const scopes = JSON.parse(JSON.stringify(projectData?.scopes || []));
    const numValue = value === "" ? "" : Number(value);

    if (sIndex === null) scopes[mIndex].score = numValue;
    else {
      scopes[mIndex].subScopes[sIndex].score = numValue;
      const valid = scopes[mIndex].subScopes.filter((s) => s.score !== "" && s.score != null).map((s) => Number(s.score));
      scopes[mIndex].score = valid.length ? parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2)) : "";
    }
    setProjectData((prev) => ({ ...prev, scopes }));
    setHasUnsavedScopeChanges(true);
  };

  const handleSaveScopeStatus = () => withSaving(async () => {
    const { error } = await supabase.from("projects").update({ scopes: projectData.scopes }).eq("project_id", projectId);
    if (error) { Swal.fire("ผิดพลาด", "ไม่สามารถอัปเดตสถานะขอบเขตได้", "error"); return; }
    setHasUnsavedScopeChanges(false);
    toast("บันทึกคะแนนขอบเขตสำเร็จ");
  });

  // ================= TEAM MANAGEMENT =================
  const handleSearchStudentsForInvite = async (query) => {
    setInviteSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setInviteSearchResults([]);
      return;
    }
    setIsSearchingInvite(true);
    try {
      const memberIds = projectData?.project_members?.map(m => m.student_id) || [];
      const selectedIds = selectedStudentsToInvite.map(s => s.auth_id);
      
      let q = supabase
        .from("users")
        .select("auth_id, first_name, last_name, prefix, account_code, email, profile_image")
        .eq("role", "STUDENT")
        .or(`account_code.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
      
      const { data, error } = await q;
      if (error) throw error;
      
      // Filter out students who are already in the project, already selected, or already have a project
      // Actually we should check if they already have a project from project_members table
      const filtered = data.filter(u => !memberIds.includes(u.auth_id) && !selectedIds.includes(u.auth_id));
      
      // We can do a second query to filter out students who already have an active project
      if (filtered.length > 0) {
        const { data: pmData } = await supabase
          .from('project_members')
          .select('student_id, projects!inner(status)')
          .in('student_id', filtered.map(f => f.auth_id))
          .eq('status', 'approved')
          .not('projects.status', 'in', '("cancelled","completed")');
        const busyStudentIds = pmData?.map(pm => pm.student_id) || [];
        setInviteSearchResults(filtered.filter(f => !busyStudentIds.includes(f.auth_id)));
      } else {
        setInviteSearchResults([]);
      }
    } catch (err) {
      console.error("Error searching students:", err);
    } finally {
      setIsSearchingInvite(false);
    }
  };

  const handleAddStudentToList = (student) => {
    setSelectedStudentsToInvite(prev => [...prev, student]);
    setInviteSearchResults(prev => prev.filter(s => s.auth_id !== student.auth_id));
  };

  const handleRemoveStudentFromList = (student) => {
    setSelectedStudentsToInvite(prev => prev.filter(s => s.auth_id !== student.auth_id));
  };

  const handleConfirmInviteMembers = async () => {
    if (selectedStudentsToInvite.length === 0) return;
    setIsInvitingMembers(true);
    loadingSwal("กำลังส่งคำเชิญ...");
    try {
      const inserts = selectedStudentsToInvite.map(s => ({
        project_id: projectId,
        student_id: s.auth_id,
        status: 'pending'
      }));

      // Clear any existing row before inserting to ensure clean invite
      await supabase.from("project_members").delete().eq("project_id", projectId).in("student_id", selectedStudentsToInvite.map(s => s.auth_id));
      const { error } = await supabase.from("project_members").insert(inserts);
      if (error) throw error;

      // Clean up "kicked" system notes from requests.message if inviting the same student again
      if (originalRequest?.request_id) {
        let currentMsg = originalRequest.message || "";
        let modified = false;
        selectedStudentsToInvite.forEach(s => {
          // Remove any system note containing the student's email
          const regex = new RegExp(`\\[หมายเหตุระบบ\\]: .*?\\(${s.email}\\).*?(?:\\n|$)`, 'g');
          if (regex.test(currentMsg)) {
             currentMsg = currentMsg.replace(regex, '').trim();
             modified = true;
          }
        });
        
        if (modified) {
          await supabase.from("requests").update({ message: currentMsg }).eq("request_id", originalRequest.request_id);
          setOriginalRequest((prev) => ({ ...prev, message: currentMsg }));
        }
      }

      // Add their emails back to the [สมาชิกในกลุ่ม] section if not present
      if (originalRequest?.request_id) {
          let currentMsg = originalRequest.message || "";
          const memberLineRegex = /\[สมาชิกในกลุ่ม\]:\s*([^\n\r]*)/;
          const match = currentMsg.match(memberLineRegex);
          let modified = false;
          let newEmails = selectedStudentsToInvite.map(s => s.email);

          if (match) {
              const existingEmails = match[1].split(/[\s,]+/).filter(x => x.includes('@'));
              const toAdd = newEmails.filter(e => !existingEmails.includes(e));
              if (toAdd.length > 0) {
                  const updatedLine = `[สมาชิกในกลุ่ม]: ${existingEmails.join(', ')}, ${toAdd.join(', ')}`;
                  currentMsg = currentMsg.replace(memberLineRegex, updatedLine);
                  modified = true;
              }
          } else {
              currentMsg = `[สมาชิกในกลุ่ม]: ${newEmails.join(', ')}\n\n${currentMsg}`;
              modified = true;
          }

          if (modified) {
             await supabase.from("requests").update({ message: currentMsg }).eq("request_id", originalRequest.request_id);
             setOriginalRequest((prev) => ({ ...prev, message: currentMsg }));
          }
      }

      // Send persistent notification to invited students
      await notify(
        selectedStudentsToInvite.map(s => s.email || s.auth_id),
        `คุณได้รับคำเชิญให้เข้าร่วมกลุ่มโครงงาน "${projectData?.title || 'ไม่ระบุชื่อ'}"`
      );

      Swal.fire({ title: "สำเร็จ", text: `ส่งคำเชิญให้ ${selectedStudentsToInvite.length} คน แล้ว`, icon: "success", toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2000 });
      setIsInviteMemberModalOpen(false);
      setSelectedStudentsToInvite([]);
      setInviteSearchQuery("");
      fetchProjectDetails();
    } catch (err) {
      alertErr(err);
    } finally {
      setIsInvitingMembers(false);
    }
  };

  const handleAddMember = () => {
    if (!projectId) return Swal.fire("เกิดข้อผิดพลาด", "ไม่พบรหัสโครงงาน", "error");
    setIsInviteMemberModalOpen(true);
  };

  const handleAddCoAdvisor = async () => {
    if (!projectId) return Swal.fire("เกิดข้อผิดพลาด", "ไม่พบรหัสโครงงาน", "error");

    const { value: formValues } = await Swal.fire({
      title: "เชิญที่ปรึกษาร่วม",
      html: `
        <div class="text-left mt-2" style="font-family: 'Kanit', sans-serif;">
          <label class="block text-sm font-semibold text-slate-700 mb-1">ประเภท <span class="text-rose-500">*</span></label>
          <select id="swal-adv-type" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-4 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm">
            <option value="internal">อาจารย์ในสาขา (มีบัญชีในระบบ)</option>
            <option value="external_faculty">อาจารย์นอกสาขา (มีบัญชีในระบบ)</option>
            <option value="external_personnel">บุคลากรภายนอก</option>
          </select>
          <label class="block text-sm font-semibold text-slate-700 mb-1">อีเมล <span class="text-rose-500">*</span></label>
          <input id="swal-adv-email" type="email" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm" placeholder="อีเมลของอาจารย์หรือบุคลากร...">
        </div>`,
      focusConfirm: false, showCancelButton: true, reverseButtons: true, confirmButtonText: "ส่งคำเชิญ", cancelButtonText: "ยกเลิก",
      confirmButtonColor: C.confirm, cancelButtonColor: C.cancel, reverseButtons: true,
      preConfirm: () => {
        const type = document.getElementById("swal-adv-type").value;
        const email = document.getElementById("swal-adv-email").value;
        if (!email) return Swal.showValidationMessage("กรุณากรอกอีเมล");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Swal.showValidationMessage("รูปแบบอีเมลไม่ถูกต้อง");
        return { type, email };
      },
    });
    if (!formValues) return;

    const { type, email } = formValues;
    loadingSwal("กำลังตรวจสอบข้อมูล...");
    try {
      const { data: advUser, error: advErr } = await supabase.from("users").select("*").eq("email", email.trim()).maybeSingle();
      if (advErr) throw advErr;

      const inviteCoAdvisor = async (user) => {
        const { error } = await supabase.from("projects").update({ co_advisor_id: user.auth_id, co_advisor_status: "pending" }).eq("project_id", projectId);
        if (error) throw error;
        setProjectData((prev) => ({ ...prev, co_advisor_id: user.auth_id, co_advisor_status: "pending" }));
        setCoAdvisor(user);
      };

      if (type === "internal" || type === "external_faculty") {
        if (!advUser || advUser.role?.toUpperCase() !== "ADVISOR") {
          return Swal.fire({ icon: "error", title: "ไม่พบข้อมูลอาจารย์", text: 'ไม่พบอีเมลนี้ หรือผู้ใช้งานไม่ได้ลงทะเบียนในสถานะ "อาจารย์" กรุณาตรวจสอบอีเมลอีกครั้ง', confirmButtonColor: C.confirm });
        }
        if (advUser.auth_id === projectData.advisor_id) {
          return Swal.fire({ title: "แจ้งเตือน", text: "อาจารย์ท่านนี้เป็นที่ปรึกษาหลักอยู่แล้ว", icon: "warning", confirmButtonColor: C.confirm });
        }
        await inviteCoAdvisor(advUser);
        await notify([email.trim()], `คุณได้รับเชิญให้เป็นอาจารย์ที่ปรึกษาร่วมในโครงงาน: ${projectData.title}`);
        alertOk("สำเร็จ", `ส่งคำเชิญอาจารย์ ${advUser.first_name} เรียบร้อยแล้ว`);
      } else if (advUser) {
        await inviteCoAdvisor(advUser);
        alertOk("สำเร็จ", "ส่งคำเชิญบุคลากรภายนอกเรียบร้อยแล้ว");
      } else {
        Swal.fire({ icon: "info", title: "ส่งคำเชิญสำเร็จ", text: `เนื่องจากบุคคลนี้ยังไม่มีบัญชีในระบบ ระบบจะส่งลิงก์คำเชิญไปที่อีเมล ${email} เพื่อให้สมัครสมาชิกและตอบรับการเข้าร่วมโครงงานต่อไป`, confirmButtonColor: C.confirm });
      }
    } catch (err) { alertErr(err); }
  };

  const handleRemoveCoAdvisor = () => {
    if (!projectId) return;
    const isSelf = authUser?.id === projectData?.co_advisor_id;
    return confirmAndRun(
      isSelf ? "ออกจากโครงงาน?" : "ปลดที่ปรึกษาร่วม/ยกเลิกคำเชิญ?",
      isSelf ? "คุณต้องการออกจากการเป็นที่ปรึกษาร่วมในโครงงานนี้ใช่หรือไม่" : "คุณต้องการนำอาจารย์ท่านนี้ออกจากการเป็นที่ปรึกษาร่วมใช่หรือไม่",
      { danger: true, confirmText: isSelf ? "ยืนยันการออก" : "ยืนยันการปลดออก" },
      async () => {
        const { data, error } = await supabase.from("projects").update({ co_advisor_id: null, co_advisor_status: null }).eq("project_id", projectId).select();
        if (error) throw error;
        if (!data?.length) throw new Error("ไม่มีสิทธิ์ในการอัปเดต หรือไม่พบโครงงาน");

        if (isSelf) {
          await alertOk("สำเร็จ", "คุณได้ออกจากการเป็นที่ปรึกษาร่วมแล้ว");
          navigate("/project", { replace: true });
        } else {
          alertOk("สำเร็จ", "ปลดที่ปรึกษาร่วมเรียบร้อยแล้ว");
          setCoAdvisor(null);
          setProjectData((prev) => ({ ...prev, co_advisor_id: null, co_advisor_status: null }));
        }
      }
    );
  };

  const respondToCoAdvisorInvite = async (pId, accept, onSuccess) => {
    if (!accept) {
      const result = await confirmSwal("ปฏิเสธคำเชิญ?", "คุณต้องการปฏิเสธการเป็นที่ปรึกษาร่วมใช่หรือไม่", { danger: true, confirmText: "ปฏิเสธ" });
      if (!result.isConfirmed) return;
    }
    await runWithLoading(async () => {
      const payload = accept ? { co_advisor_status: "accepted" } : { co_advisor_id: null, co_advisor_status: null };
      const { data, error } = await supabase.from("projects").update(payload).eq("project_id", pId).select();
      if (error) throw error;
      if (!data?.length) throw new Error(accept ? "ไม่มีสิทธิ์ในการอัปเดตโครงงาน" : "ไม่มีสิทธิ์ในการแก้ไขข้อมูล");
      onSuccess?.();
      alertOk("สำเร็จ", accept ? "คุณได้ตอบรับการเป็นที่ปรึกษาร่วมเรียบร้อยแล้ว" : "ปฏิเสธคำเชิญเรียบร้อยแล้ว");
    });
  };

  const handleAcceptCoAdvisor = () =>
    respondToCoAdvisorInvite(projectId, true, () => setProjectData((prev) => ({ ...prev, co_advisor_status: "accepted" })));

  const handleAcceptInviteList = (e, pId) => {
    e.stopPropagation();
    respondToCoAdvisorInvite(pId, true, () => setMyProjects((prev) => prev.map((p) => (p.project_id === pId ? { ...p, co_advisor_status: "accepted" } : p))));
  };

  const handleRejectInviteList = (e, pId) => {
    e.stopPropagation();
    respondToCoAdvisorInvite(pId, false, () => setMyProjects((prev) => prev.filter((p) => p.project_id !== pId)));
  };

  const removeStudentFromProject = async (studentId, studentName, studentEmail, isSelf, isPendingInvite = false) => {
    await supabase.from("project_members").delete().eq("project_id", projectId).eq("student_id", studentId);
    await supabase.from("student_profiles").update({ student_status: "MEMBER", current_advisor_id: null }).eq("user_id", studentId);

    if (originalRequest?.request_id) {
      let currentMsg = originalRequest.message || "";
      const memberLineRegex = /\[สมาชิกในกลุ่ม\]:\s*([^\n\r]*)/;
      const match = currentMsg.match(memberLineRegex);
      if (match && studentEmail) {
        const existingEmails = match[1].split(/[\s,]+/).filter(x => x.includes('@'));
        const remainingEmails = existingEmails.filter(e => e.toLowerCase() !== studentEmail.toLowerCase());
        const updatedLine = remainingEmails.length > 0 ? `[สมาชิกในกลุ่ม]: ${remainingEmails.join(', ')}` : '';
        currentMsg = currentMsg.replace(match[0], updatedLine).trim();
      }

      if (!isPendingInvite) {
        const who = isSelf
          ? `${studentName} (${studentEmail}) ได้ออกจากโครงงานด้วยตนเอง`
          : `นำนักศึกษา ${studentName} (${studentEmail}) ออกจากโครงงาน`;
        currentMsg = `${currentMsg}\n\n[หมายเหตุระบบ]: ${who} เมื่อ ${new Date().toLocaleDateString("th-TH")}`;
      }

      try {
        await supabase.from("requests").update({ message: currentMsg }).eq("request_id", originalRequest.request_id);
        setOriginalRequest((prev) => ({ ...prev, message: currentMsg }));
      } catch (e) {
        console.error("Error updating requests message:", e);
      }
    }

    await notify(
      isSelf ? [projectData.leader?.email, projectAdvisor?.email] : [studentEmail],
      isPendingInvite
        ? `คำเชิญเข้าร่วมโครงงาน "${projectData.title}" ถูกยกเลิกแล้ว`
        : (isSelf ? `สมาชิก ${studentName} ได้ออกจากโครงงาน: ${projectData.title}` : `คุณถูกนำออกจากโครงงาน: ${projectData.title}`)
    );
  };

  const handleRemoveMember = (studentId, studentName, studentEmail, memberStatus) => {
    if (!isAdmin && authUser?.id !== projectData?.leader_id && authUser?.id !== projectData?.advisor_id) return;
    if (studentId === projectData.leader_id) return Swal.fire({ title: "แจ้งเตือน", text: "ไม่สามารถลบหัวหน้ากลุ่มได้", icon: "warning", confirmButtonColor: C.confirm });

    const isPending = memberStatus === 'pending';
    const titleText = isPending ? "ยกเลิกคำเชิญ?" : "นำสมาชิกออก?";
    const msgText = isPending ? `คุณต้องการยกเลิกคำเชิญของ ${studentName} ใช่หรือไม่?` : `คุณต้องการนำ ${studentName} ออกจากกลุ่มใช่หรือไม่?`;
    const btnText = isPending ? "ยืนยันยกเลิกคำเชิญ" : "ยืนยันการนำออก";

    return confirmAndRun(
      titleText, msgText, { danger: true, confirmText: btnText },
      async () => {
        await removeStudentFromProject(studentId, studentName, studentEmail, false, isPending);
        alertOk("สำเร็จ", isPending ? "ยกเลิกคำเชิญเรียบร้อยแล้ว สามารถเชิญใหม่ได้ทันที" : "นำสมาชิกออกจากกลุ่มแล้ว");
        setProjectData((prev) => ({ ...prev, project_members: prev.project_members.filter((m) => m.student_id !== studentId) }));
        fetchProjectDetails();
      }
    );
  };

  const handleLeaveProject = () =>
    confirmAndRun(
      "ออกจากโครงงาน?", "คุณต้องการออกจากโครงงานนี้ใช่หรือไม่?", { danger: true, confirmText: "ยืนยันการออก" },
      async () => {
        await removeStudentFromProject(authUser.id, fullName, authUser.email, true);
        await alertOk("สำเร็จ", "คุณได้ออกจากโครงงานแล้ว");
        navigate("/dashboard");
      }
    );

  const handleDisbandProject = async () => {
    const isAdvisor = authUser?.id === projectData?.advisor_id;
    const actor = isAdvisor ? "อาจารย์" : "หัวหน้าโครงงาน";

    const result = await Swal.fire({
      html: `
        <div class="text-left font-sans">
          <div class="flex items-center gap-3 mb-5">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg className="shrink-0" class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold text-slate-800 m-0">
                ${projectData?.status === "completed" ? "ลบโครงงานนี้อย่างถาวร?" : (isAdvisor ? "ยุบโครงงาน?" : "ยกเลิกโครงงาน?")}
              </h3>
              <p class="text-sm text-slate-500 mt-0.5">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
            </div>
          </div>
          
          <div class="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-5 text-sm text-slate-700 leading-relaxed">
            ข้อมูลโครงงาน ห้องสนทนา และรายงานจะถูกลบอย่างถาวร 
            <br/>หากคุณแน่ใจ โปรดพิมพ์ <span class="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">${projectData.title}</span> เพื่อยืนยัน
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">ชื่อโครงงาน <span class="text-red-500">*</span></label>
              <input id="swal-input-title" type="text" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm transition-colors" placeholder="พิมพ์ชื่อโครงงาน..." autocomplete="off" />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">หมายเหตุ (ไม่บังคับ)</label>
              <textarea id="swal-input-reason" rows="2" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 text-sm transition-colors resize-none" placeholder="ระบุเหตุผลให้ทราบ..."></textarea>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true, reverseButtons: true,
      showConfirmButton: true,
      confirmButtonText: "ยืนยันการลบ",
      cancelButtonText: "ยกเลิก",
      buttonsStyling: false,
      customClass: { 
        popup: "!rounded-2xl !p-6 !w-full !max-w-md",
        htmlContainer: "!m-0",
        actions: "!mt-8 !mb-0 !w-full flex gap-3 justify-end",
        confirmButton: "px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm",
        cancelButton: "px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors shadow-sm"
      },
      didOpen: () => {
        document.getElementById("swal-input-title").focus();
      },
      preConfirm: () => {
        const titleInput = document.getElementById("swal-input-title").value;
        const reasonInput = document.getElementById("swal-input-reason").value;
        if (titleInput !== projectData.title) {
          Swal.showValidationMessage("ชื่อโครงงานไม่ตรงกัน โปรดลองอีกครั้ง");
          return false;
        }
        return { reason: reasonInput };
      }
    });

    if (!result.isConfirmed) return;
    const revokeReason = result.value.reason.trim();

    await runWithLoading(async () => {
      if (originalRequest?.request_id) {
        const newMsg = `${originalRequest.message || ""}\n\n[หมายเหตุการยกเลิกจาก${actor}]: ${revokeReason}`;
        await supabase.from("requests").update({ status: isAdvisor ? "KICKED" : "LEFT", message: newMsg }).eq("request_id", originalRequest.request_id);
      }

      const memberIdsToReset = projectData.project_members.map((m) => m.student_id);
      if (projectData.leader_id && !memberIdsToReset.includes(projectData.leader_id)) memberIdsToReset.push(projectData.leader_id);

      // 🧹 ลบไฟล์ทั้งหมดใน Google Drive (PDF รายงาน & ไฟล์ในห้องแชท) ก่อนลบจากฐานข้อมูล
      try {
        const [{ data: rReports }, { data: rMessages }] = await Promise.all([
          supabase.from("project_reports").select("pdf_url, advisor_pdf_url").eq("project_id", projectId),
          supabase.from("project_messages").select("file_url").eq("project_id", projectId).not("file_url", "is", null)
        ]);
        const driveUrlsToDelete = [];
        rReports?.forEach(r => {
          if (r.pdf_url) parsePdfUrls(r.pdf_url).forEach(p => p.url && driveUrlsToDelete.push(p.url));
          if (r.advisor_pdf_url) parsePdfUrls(r.advisor_pdf_url).forEach(p => p.url && driveUrlsToDelete.push(p.url));
        });
        rMessages?.forEach(m => {
          if (m.file_url) driveUrlsToDelete.push(m.file_url);
        });
        if (driveUrlsToDelete.length > 0) {
          await deleteDriveFiles(driveUrlsToDelete);
        }

        // ลบโฟลเดอร์โครงงานและห้องแชทใน Google Drive
        const foldersToDelete = [
          `Project - ${projectData.title || projectId}`,
          `Chat - ${projectData.title || projectId}`,
          projectData.project_code ? `Chat - ${projectData.project_code}` : null,
          projectData.project_code ? `Chat - Project 1 ${projectData.project_code}` : null
        ].filter(Boolean);
        await deleteDriveFolders(foldersToDelete);
      } catch (e) {
        console.error("Error deleting Drive files/folders on project delete:", e);
      }

      await supabase.from("projects").update({ status: "cancelled" }).eq("project_id", projectId);
      await supabase.from("project_messages").delete().eq("project_id", projectId);
      await supabase.from("project_reports").delete().eq("project_id", projectId);
      await supabase.from("project_members").delete().eq("project_id", projectId);
      await supabase.from("projects").delete().eq("project_id", projectId);

      const { count: currentActiveCount } = await supabase.from("projects").select("*", { count: "exact", head: true }).eq("advisor_id", projectData.advisor_id).not("status", "in", '("cancelled","completed")');
      const { data: advProfile } = await supabase.from("advisor_profiles").select("max_groups").eq("user_id", projectData.advisor_id).single();
      if (advProfile) {
        const newMaxGroups = Math.max(1, currentActiveCount);
        await supabase.from("advisor_profiles").update({
          current_groups: currentActiveCount, max_groups: newMaxGroups, is_accepting_students: currentActiveCount < newMaxGroups,
        }).eq("user_id", projectData.advisor_id);
      }

      if (memberIdsToReset.length) await supabase.from("student_profiles").update({ student_status: "MEMBER", current_advisor_id: null }).in("user_id", memberIdsToReset);

      const memberEmails = projectData.project_members.map((m) => one(m.users)?.email).filter((e) => e && e !== authUser.email);
      const notifyEmails = [...memberEmails];
      if (isAdvisor && projectData.leader?.email && !notifyEmails.includes(projectData.leader.email)) notifyEmails.push(projectData.leader.email);
      if (!isAdvisor && projectAdvisor?.email && !notifyEmails.includes(projectAdvisor.email)) notifyEmails.push(projectAdvisor.email);
      await notify(notifyEmails, `โครงงาน ${projectData.title} ถูกยกเลิก/ยุบโดย ${actor} เนื่องจาก: ${revokeReason}`);

      Swal.fire("เรียบร้อย", "ลบข้อมูลโครงงานและคืนโควตาเรียบร้อยแล้ว", "success").then(() => navigate("/dashboard"));
    }, "กำลังลบข้อมูล...");
  };

  const handleViewStudentInfo = (student) => {
    Swal.fire({
      title: "ข้อมูลนักศึกษา",
      html: `
        <div class="text-left bg-slate-50 p-5 rounded-2xl text-[14px] text-slate-700 space-y-3 shadow-inner">
          <div class="flex items-center gap-4 mb-4 justify-center">
            ${student.image ? `<img src="${student.image}" class="w-20 h-20 rounded-full object-cover shadow-sm border-2 border-white" />` : `<div class="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-3xl shadow-sm border-2 border-white">${student.name.charAt(0)}</div>`}
          </div>
          <p><strong class="text-slate-900">ชื่อ-นามสกุล:</strong> ${student.name}</p>
          <p><strong class="text-slate-900">อีเมล:</strong> ${student.email || "-"}</p>
          <p><strong class="text-slate-900">คณะ:</strong> ${student.faculty || "-"}</p>
          <p><strong class="text-slate-900">สาขา:</strong> ${student.major || "-"}</p>
          <p><strong class="text-slate-900">ตำแหน่ง:</strong> ${student.isLeader ? '<span class="text-indigo-600 font-bold">หัวหน้าทีม</span>' : '<span class="text-slate-600">สมาชิก</span>'}</p>
        </div>`,
      confirmButtonColor: C.confirm, confirmButtonText: "ปิดหน้าต่าง", customClass: { popup: "rounded-2xl" },
    });
  };

  const handleCompleteProject = () =>
    confirmAndRun(
      "จบโครงงาน?", "คุณต้องการเปลี่ยนสถานะโครงงานนี้เป็น 'เสร็จสิ้น' ใช่หรือไม่? ข้อมูลทั้งหมดจะยังคงดูได้ตามปกติ",
      { icon: "question", color: C.ok, confirmText: "ยืนยันจบโครงงาน", loadingTitle: "กำลังบันทึกสถานะ..." },
      async () => {
        const { error } = await supabase.from("projects").update({ status: "completed" }).eq("project_id", projectId);
        if (error) throw error;
        setProjectData((prev) => ({ ...prev, status: "completed" }));
        alertOk("สำเร็จ", "เปลี่ยนสถานะโครงงานเป็นเสร็จสิ้นเรียบร้อยแล้ว");
      }
    );

  const filteredProjects = useMemo(() => {
    let list = myProjects;
    if (statusFilter !== "all") {
      list = list.filter((p) => {
        if (statusFilter === "in_progress" && p.status === "ongoing") return true;
        return p.status === statusFilter;
      });
    }
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((proj) => {
      const titleMatch = proj.title?.toLowerCase().includes(q);
      const codeMatch = proj.project_code?.toLowerCase().includes(q);
      const leaderMatch = `${proj.leader?.first_name || ""} ${proj.leader?.last_name || ""}`.toLowerCase().includes(q);
      const membersMatch = proj.project_members?.some((m) => {
        const u = one(m.users);
        return `${u?.first_name || ""} ${u?.last_name || ""}`.toLowerCase().includes(q);
      });
      return titleMatch || codeMatch || leaderMatch || membersMatch;
    });
  }, [myProjects, searchTerm, statusFilter]);

  // ================= WEEKLY REPORT FORM =================
  const handleSaveDueDate = async () => {
    const dateText = dueDate ? formatThaiDate(dueDate) : "ไม่ระบุกำหนดส่ง";
    const taskText = taskAssigned.trim() ? `\nสิ่งที่ต้องส่ง: ${taskAssigned.trim()}` : "";

    const richResult = await Swal.fire({
      title: "ยืนยันการบันทึกนัดหมาย?",
      html: `คุณต้องการกำหนดนัดหมายสัปดาห์ที่ ${currentWeek}<br/><b>วันที่กำหนดส่ง:</b> <span class="text-rose-600">${dateText}</span><br/><span class="text-sm text-slate-600">${taskText}</span>`,
      icon: "question", showCancelButton: true, reverseButtons: true, confirmButtonColor: C.confirm, cancelButtonColor: C.cancel,
      confirmButtonText: "ยืนยันบันทึก", cancelButtonText: "ยกเลิก", customClass: { popup: "rounded-2xl" },
    });
    if (!richResult.isConfirmed) return;

    await withSaving(async () => {
      const payload = {
        due_date: dueDate ? new Date(dueDate.includes('T') ? dueDate : `${dueDate}T23:59:59`).toISOString() : null,
        task_assigned: taskAssigned.trim(),
        weekly_score_work: weeklyScoreWork !== "" ? Number(weeklyScoreWork) : null,
        weekly_score_document: weeklyScoreDoc !== "" ? Number(weeklyScoreDoc) : null,
      };

      const targetId = resolveReportId(currentWeek);
      if (targetId) {
        const { error } = await supabase.from("project_reports").update(payload).eq("report_id", targetId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("project_reports").insert({ project_id: projectId, week_number: currentWeek, status: "pending", ...payload }).select().single();
        if (error) throw error;
        if (data) setCurrentReportId(data.report_id);
      }

      if (!isStudent) {
        const memberEmails = (projectData?.project_members || []).map((m) => one(m.users)?.email).filter((e) => e && e !== authUser.email);
        if (memberEmails.length > 0) {
          const taskMsg = payload.task_assigned ? `\nงานที่มอบหมาย: ${payload.task_assigned}` : "";
          await notify(memberEmails, `อาจารย์ได้อัปเดตนัดหมาย/สั่งงานสัปดาห์ที่ ${currentWeek} ในโครงงาน: ${projectData.title}${taskMsg}`);
        }
      }

      await refreshAfterUpdate();
      toast("บันทึกนัดหมายสำเร็จ");
    });
  };

  const handleCancelDueDate = async () => {
    if (!currentReportId) return;
    const result = await confirmSwal("ยกเลิกนัดหมาย?", "คุณต้องการยกเลิกการนัดหมายและสิ่งที่ต้องส่งในสัปดาห์นี้ใช่หรือไม่?", { danger: true, confirmText: "ยืนยันการยกเลิก", cancelText: "กลับ" });
    if (!result.isConfirmed) return;

    await withSaving(async () => {
      const { error } = await supabase.from("project_reports").update({ due_date: null, task_assigned: null }).eq("report_id", currentReportId);
      if (error) throw error;
      setDueDate(""); setTaskAssigned("");
      await refreshAfterUpdate();
      toast("ยกเลิกนัดหมายสำเร็จ");
    });
  };

  const handleSaveReportData = async (e) => {
    e.preventDefault();
    const targetId = resolveReportId(currentWeek);

    if (isStudent) {
      if (!taskSubmittedTitle.trim()) return alertErr(new Error("กรุณาระบุหัวชื่องานที่ส่ง"));

      // === เช็คขนาดไฟล์ PDF นักศึกษา (จำกัด 5MB) ===
      const oversizedFile = findOversizedFile(pdfFiles);
      if (oversizedFile) {
        return Swal.fire({
          title: "ขนาดไฟล์เกินกำหนด",
          text: `ไฟล์ ${oversizedFile.name} มีขนาดใหญ่กว่า ${MAX_PDF_SIZE_MB}MB`,
          icon: "warning",
          confirmButtonColor: C.confirm,
          customClass: { popup: "rounded-2xl" }
        });
      }

      const htmlText = (driveUrl.trim() || pdfFiles.length > 0 || pdfUrls.length > 0)
        ? `กรุณาตรวจสอบให้แน่ใจว่าลิงก์ส่งงาน หรือไฟล์ PDF ของคุณครบถ้วนแล้ว`
        : `คุณ <b>ไม่ได้แนบลิงก์ Google Drive หรือไฟล์ PDF</b> ยืนยันที่จะส่งงานสัปดาห์นี้ใช่หรือไม่?`;

      const confirmResult = await Swal.fire({
        title: "ยืนยันการส่งงาน?", html: htmlText, icon: "info", showCancelButton: true, reverseButtons: true,
        confirmButtonColor: C.confirm, cancelButtonColor: C.cancel, confirmButtonText: "ส่งงานเลย",
        cancelButtonText: "กลับไปแก้ไข", customClass: { popup: "rounded-2xl" },
      });
      if (!confirmResult.isConfirmed) return;

      await withSaving(async () => {
        const folderName = `Project - ${projectData.title || projectId}`;
        
        // เปิดหน้าต่าง Loading ก่อนเริ่มทำงาน เพื่อให้ Swal.update มีเป้าหมายในการอัปเดต
        Swal.fire({
          title: "กำลังบันทึกข้อมูล...",
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => Swal.showLoading(),
          customClass: { popup: "rounded-2xl" }
        });

        const onProgress = (filePercent, current, total, fileName, statusText) => {
          // คำนวณเปอร์เซ็นต์รวมทั้งหมด (Overall Percentage)
          const overallPercent = Math.round(((current - 1) * 100 + filePercent) / total);
          
          Swal.update({
            html: `
              <div class="text-left mt-2">
                <p class="text-sm font-bold text-slate-700 mb-1">ไฟล์ที่ ${current} จาก ${total}</p>
                <p class="text-xs text-slate-500 mb-3 truncate" title="${fileName}">${fileName}</p>
                <div class="w-full bg-slate-100 rounded-full h-3 mb-2 border border-slate-200 overflow-hidden">
                  <div class="bg-indigo-500 h-full transition-all duration-300 ease-out flex items-center justify-end" style="width: ${overallPercent}%"></div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-indigo-600 font-semibold animate-pulse">${statusText}</span>
                  <span class="text-sm font-bold text-slate-800">${overallPercent}%</span>
                </div>
              </div>
            `
          });
        };

        const uploadedPdfs = await uploadPdfFiles(pdfFiles, `W${currentWeek}_${projectId}_st`, folderName, onProgress);
        const finalPdfUrls = [...pdfUrls, ...uploadedPdfs];
        const pdfUrlToSave = finalPdfUrls.length > 0 ? JSON.stringify(finalPdfUrls) : null;

        // 🧹 ลบไฟล์ PDF ใน Google Drive ที่นักศึกษากดลบออก
        if (deletedPdfUrls.length > 0) {
          await deleteDriveFiles(deletedPdfUrls);
          setDeletedPdfUrls([]);
        }

        const payload = { 
          drive_link: driveUrl.trim(), 
          task_submitted_title: taskSubmittedTitle.trim(), 
          pdf_url: pdfUrlToSave, 
          status: "submitted", 
          updated_at: new Date().toISOString() 
        };

        if (targetId) {
          const { error } = await supabase.from("project_reports").update(payload).eq("report_id", targetId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("project_reports").insert({ project_id: projectId, week_number: currentWeek, ...payload }).select().single();
          if (error) throw error;
          if (data) setCurrentReportId(data.report_id);
        }
        await refreshAfterUpdate();
        Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", text: `ข้อมูลสัปดาห์ที่ ${currentWeek} ได้รับการอัปเดตเรียบร้อยแล้ว`, confirmButtonColor: C.ok, customClass: { popup: "rounded-2xl" } });
      });
      return;
    }

    if (isAdvisorRole) {
      if (!targetId) return alertErr(new Error("ไม่สามารถตรวจงานได้ เนื่องจากนักศึกษายังไม่ได้ส่งรายงาน หรือยังไม่ได้สร้างการนัดหมาย"));

      // === เช็คขนาดไฟล์ PDF อาจารย์ (จำกัด 5MB) ===
      const oversizedAdvFile = findOversizedFile(advisorPdfFiles);
      if (oversizedAdvFile) {
        return Swal.fire({
          title: "ขนาดไฟล์เกินกำหนด",
          text: `ไฟล์ ${oversizedAdvFile.name} มีขนาดใหญ่กว่า ${MAX_PDF_SIZE_MB}MB`,
          icon: "warning",
          confirmButtonColor: C.confirm,
          customClass: { popup: "rounded-2xl" }
        });
      }

      const confirmResult = await Swal.fire({
        title: `ยืนยันบันทึกผล W${currentWeek}?`, html: `คุณต้องการบันทึกคะแนนและข้อเสนอแนะ<br/>ให้นักศึกษากลุ่มนี้ใช่หรือไม่?`,
        icon: "question", showCancelButton: true, reverseButtons: true, confirmButtonColor: C.ok, cancelButtonColor: C.cancel,
        confirmButtonText: "ยืนยันบันทึกผล", cancelButtonText: "ยกเลิก", customClass: { popup: "rounded-2xl" },
      });
      if (!confirmResult.isConfirmed) return;

      await withSaving(async () => {
        const folderName = `Project - ${projectData.title || projectId}`;
        
        // เปิดหน้าต่าง Loading ก่อนเริ่มทำงาน เพื่อให้ Swal.update มีเป้าหมายในการอัปเดต
        Swal.fire({
          title: "กำลังบันทึกข้อมูล...",
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => Swal.showLoading(),
          customClass: { popup: "rounded-2xl" }
        });

        const onProgress = (filePercent, current, total, fileName, statusText) => {
          // คำนวณเปอร์เซ็นต์รวมทั้งหมด (Overall Percentage)
          const overallPercent = Math.round(((current - 1) * 100 + filePercent) / total);
          
          Swal.update({
            html: `
              <div class="text-left mt-2">
                <p class="text-sm font-bold text-slate-700 mb-1">ไฟล์ที่ ${current} จาก ${total}</p>
                <p class="text-xs text-slate-500 mb-3 truncate" title="${fileName}">${fileName}</p>
                <div class="w-full bg-slate-100 rounded-full h-3 mb-2 border border-slate-200 overflow-hidden">
                  <div class="bg-indigo-500 h-full transition-all duration-300 ease-out flex items-center justify-end" style="width: ${overallPercent}%"></div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-indigo-600 font-semibold animate-pulse">${statusText}</span>
                  <span class="text-sm font-bold text-slate-800">${overallPercent}%</span>
                </div>
              </div>
            `
          });
        };

        const uploadedAdvPdfs = await uploadPdfFiles(advisorPdfFiles, `W${currentWeek}_${projectId}_adv`, folderName, onProgress);
        const finalAdvPdfUrls = [...advisorPdfUrls, ...uploadedAdvPdfs];
        const advPdfUrlToSave = finalAdvPdfUrls.length > 0 ? JSON.stringify(finalAdvPdfUrls) : null;

        // 🧹 ลบไฟล์ PDF ใน Google Drive ที่อาจารย์กดลบออก
        if (deletedAdvPdfUrls.length > 0) {
          await deleteDriveFiles(deletedAdvPdfUrls);
          setDeletedAdvPdfUrls([]);
        }

        const payload = {
          advisor_feedback: feedback.trim(),
          weekly_score_work: weeklyScoreWork !== "" ? Number(weeklyScoreWork) : null,
          weekly_score_document: weeklyScoreDoc !== "" ? Number(weeklyScoreDoc) : null,
          instructor_feedback: instFeedback.trim(),
          advisor_pdf_url: advPdfUrlToSave,
          status: "reviewed",
        };
        if (reportStatus === "pending" && isSubmittedInPerson) {
          payload.task_submitted_title = "[อาจารย์บันทึก]: นักศึกษามาส่งงานด้วยตนเอง";
        }
        const { error } = await supabase.from("project_reports").update(payload).eq("report_id", targetId);
        if (error) throw error;
        await refreshAfterUpdate();
        Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", text: `ข้อมูลสัปดาห์ที่ ${currentWeek} ได้รับการอัปเดตเรียบร้อยแล้ว`, confirmButtonColor: C.ok, customClass: { popup: "rounded-2xl" } });
      });
    }
  };

  const handleGoToChat = () => {
    if (!projectData) return;
    const partnerId = isStudent ? projectData.advisor_id : projectData.leader_id;
    navigate("/chat", { state: { chatPartnerId: partnerId, projectTitle: projectData.title } });
  };

  const handleDeleteWeek = async (weekNum) => {
    const result = await confirmSwal(`ลบข้อมูล W${weekNum}?`, "คุณต้องการลบข้อมูลสัปดาห์นี้ใช่หรือไม่? ข้อมูลการส่งงานและคะแนนจะหายไปทั้งหมด และไม่สามารถกู้คืนได้", { danger: true, confirmText: "ยืนยันการลบ" });
    if (!result.isConfirmed) return;

    await withSaving(async () => {
      // ดึงข้อมูล report ก่อนลบเพื่อเอา URL ไฟล์ไปลบใน Google Drive
      const reportToDelete = (projectData?.project_reports || []).find((r) => r.week_number === weekNum);
      
      const { error } = await supabase.from("project_reports").delete().eq("project_id", projectId).eq("week_number", weekNum);
      if (error) throw error;

      // ลบไฟล์ใน Google Drive
      if (reportToDelete) {
        const urlsToDelete = [];
        try {
          if (reportToDelete.pdf_url) {
            const parsed = JSON.parse(reportToDelete.pdf_url);
            urlsToDelete.push(...parsed.map(p => p.url));
          }
        } catch (e) {}
        try {
          if (reportToDelete.advisor_pdf_url) {
            const parsed = JSON.parse(reportToDelete.advisor_pdf_url);
            urlsToDelete.push(...parsed.map(p => p.url));
          }
        } catch (e) {}

        if (urlsToDelete.length > 0) {
          await deleteDriveFiles(urlsToDelete);
        }
      }

      if (!isStudent) {
        const memberEmails = (projectData?.project_members || []).map((m) => {
          const user = Array.isArray(m.users) ? m.users[0] : m.users;
          return user?.email;
        }).filter((e) => e && e !== authUser.email);
        if (memberEmails.length > 0) {
          await notify(memberEmails, `อาจารย์ได้ลบรายงานความคืบหน้าสัปดาห์ที่ ${weekNum} ในโครงงาน: ${projectData.title}`);
        }
      }

      if (currentWeek === weekNum) applyReportToForm(null);

      const remainingReports = (projectData?.project_reports || []).filter((r) => r.week_number !== weekNum);
      const newMax = remainingReports.length > 0 ? Math.max(...remainingReports.map((r) => r.week_number)) : 1;
      setProjectData((prev) => ({ ...prev, project_reports: remainingReports }));

      if (currentWeek === weekNum) {
        setCurrentWeek(newMax);
        await fetchWeeklyReport(projectId, newMax, remainingReports);
      }

      toast(`ลบ W${weekNum} สำเร็จ`);
    });
  };

  const handleGenerateCode = async () => {
    const randomCode = `P-${Math.floor(100000 + Math.random() * 900000)}`;
    const { error } = await supabase.from('projects').update({ project_code: randomCode }).eq('project_id', projectData.project_id);
    if (error) {
      Swal.fire("เกิดข้อผิดพลาด", error.message, "error");
    } else {
      setProjectData(prev => ({ ...prev, project_code: randomCode }));
      Swal.fire({ title: "สร้างรหัสสำเร็จ", text: `รหัสโครงงานใหม่คือ ${randomCode}`, icon: "success", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50" style={{ fontFamily: "'Kanit', sans-serif" }}>
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
        <p className="text-slate-500 text-sm font-medium tracking-wide">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  // ========================================================
  // RENDER 1: หน้า List สำหรับอาจารย์ และนักศึกษาที่มีหลายโครงงาน
  // ========================================================
  if (!projectId && (isAdvisorRole || (isStudent && (myProjects.length > 0 || myRequests.length > 0)))) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col relative" style={{ fontFamily: "'Kanit', sans-serif" }}>
        <Header user={authUser} fullName={fullName} profileImage={profileImage} role={role} />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 relative z-10">
          <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
                <div className="p-2 bg-indigo-50 rounded-xl shrink-0"><Icon name="grid" className="w-5 h-5 text-indigo-600" /></div>
                {isStudent ? `รายการโครงงานของคุณ (${filteredProjects.length})` : `โครงงานในการดูแล (${filteredProjects.length})`}
              </h1>
              <p className="text-slate-500 mt-1 text-sm font-medium">{isStudent ? "เลือกเพื่อดูรายละเอียดและจัดการข้อมูลโครงงานแต่ละเรื่อง" : "ตรวจสอบงานกลุ่ม รายชื่อสมาชิก และรายละเอียดความคืบหน้า"}</p>
            </div>
            {myProjects.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium shadow-sm transition-all">
                  <option value="all">สถานะทั้งหมด</option>
                  <option value="in_progress">กำลังดำเนินการ</option>
                  <option value="completed">เสร็จสิ้น</option>
                </select>
                <div className="w-full md:w-72 shrink-0 relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                    <Icon name="search" className="w-4 h-4 shrink-0" />
                  </span>
                  <input type="text" placeholder="ค้นหาชื่อ, รหัส, ผู้จัดทำ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all shadow-sm placeholder:text-slate-400 font-medium" />
                </div>
              </div>
            )}
          </div>

          {(filteredProjects.length === 0 && (!isStudent || myRequests?.length === 0)) ? (
            <div className="bg-white p-10 rounded-2xl text-center shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 shrink-0">
                <Icon name="folderEmpty" className="w-8 h-8 text-slate-300" />
              </div>
              <h2 className="text-lg font-bold text-slate-700">{searchTerm || statusFilter !== "all" ? "ไม่พบโครงงานที่ค้นหาตามเงื่อนไข" : "คุณยังไม่มีโครงงานที่ดูแล"}</h2>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((proj) => (
                <ProjectListCard
                  key={proj.project_id} proj={proj} authUserId={authUser?.id}
                  onOpen={(id) => navigate(`/project?id=${id}`)}
                  onAccept={handleAcceptInviteList} onReject={handleRejectInviteList}
                />
              ))}
              {isStudent && myRequests && myRequests.map(req => {
                const isRejected = req.status === 'rejected';
                const statusText = isRejected ? 'คำขอถูกปฏิเสธ' : 'คำขอรอการตอบรับ';
                const statusIcon = isRejected ? 'x' : 'clock';
                
                // Tailwind classes explicitly defined to prevent purge
                const containerClass = isRejected 
                  ? "bg-gradient-to-br from-white to-rose-50/50 border border-rose-200" 
                  : "bg-gradient-to-br from-white to-amber-50/50 border border-amber-200";
                const topBarClass = isRejected ? "bg-rose-400" : "bg-amber-400";
                const badgeClass = isRejected 
                  ? "bg-rose-50 text-rose-600 border border-rose-100" 
                  : "bg-amber-50 text-amber-600 border border-amber-100";
                const iconContainerClass = isRejected ? "bg-rose-100/50" : "bg-amber-100";
                const iconClass = isRejected ? "text-rose-500" : "text-amber-500";

                return (
                 <div key={req.request_id} className={`${containerClass} rounded-3xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-[260px] relative overflow-hidden group opacity-100`}>
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${topBarClass}`}></div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className={`${badgeClass} px-3 py-1 rounded-lg text-[11px] font-extrabold tracking-wide flex items-center gap-1.5`}>
                         <Icon name={statusIcon} className="w-3.5 h-3.5" /> {statusText}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center text-center px-1">
                       <div className={`${iconContainerClass} w-14 h-14 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                          <Icon name="document" className={`w-6 h-6 ${iconClass} opacity-80`} />
                       </div>
                       <h3 className="text-[15px] font-bold text-slate-700 leading-snug line-clamp-2 w-full">
                          {req.project_title && req.project_title !== '...' ? req.project_title : "โครงงานยังไม่ได้ระบุชื่อ"}
                       </h3>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
                       <p className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                          <Icon name="people" className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-500 font-normal">ยื่นถึง:</span> <span>{req.advisor?.prefix || ""}{req.advisor?.first_name} {req.advisor?.last_name}</span>
                       </p>
                       {req.created_at && (
                         <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                           <Icon name="calendar" className="w-3 h-3" />
                           {new Date(req.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                         </p>
                       )}
                    </div>
                 </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ========================================================
  // RENDER 2: หน้า Error (ไม่มีกลุ่ม)
  // ========================================================
  if (!projectData && !loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col relative transition-colors duration-200" style={{ fontFamily: "'Kanit', sans-serif" }}>
        <Header user={authUser} fullName={fullName} profileImage={profileImage} role={role} />

        <main className="flex-1 flex items-center justify-center p-4 relative z-10">
          <div className="bg-white/90 backdrop-blur-md p-8 md:p-10 rounded-3xl shadow-[0_4px_25px_rgb(0,0,0,0.04)] border border-white max-w-md w-full text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shrink-0 text-amber-500 border border-amber-100 shadow-sm">
              <Icon name="warningTriangle" className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">{isStudent && !projectId ? "คุณยังไม่มีกลุ่มโครงงาน" : "ไม่พบข้อมูลโครงงาน"}</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed font-light">{isStudent && !projectId ? "กรุณาไปค้นหาอาจารย์ที่ปรึกษาเพื่อยื่นข้อเสนอโครงงานเริ่มต้น" : "ลิงก์ไม่ถูกต้อง หรือโครงงานนี้ไม่อยู่ในการดูแลของคุณ"}</p>
            <button onClick={() => navigate(isStudent && !projectId ? "/advisorsearch" : -1)} className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-semibold rounded-xl w-full transition-all shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2">
              {isStudent && !projectId ? "ค้นหาอาจารย์ที่ปรึกษา" : "ย้อนกลับ"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  let memberList = (projectData?.project_members || []).map((m) => {
    const u = one(m.users);
    return { id: m.student_id, name: u ? `${u.first_name} ${u.last_name}` : "ไม่ระบุชื่อ", image: u?.profile_image, isLeader: m.student_id === projectData.leader_id, email: u?.email, faculty: u?.faculty, major: u?.major, status: m.status };
  });

  if (projectData?.leader_id) {
    const leaderIndex = memberList.findIndex(m => m.id === projectData.leader_id);
    if (leaderIndex !== -1) {
      memberList[leaderIndex].isLeader = true;
      const leaderItem = memberList.splice(leaderIndex, 1)[0];
      memberList.unshift(leaderItem);
    } else {
      const lu = one(projectData.leader);
      if (lu || projectData.leader_id) {
        memberList.unshift({
          id: projectData.leader_id,
          name: lu ? `${lu.first_name || ""} ${lu.last_name || ""}`.trim() || "หัวหน้ากลุ่ม" : "หัวหน้ากลุ่ม",
          image: lu?.profile_image,
          isLeader: true,
          email: lu?.email,
          faculty: lu?.faculty,
          major: lu?.major,
          status: "approved"
        });
      }
    }
  }

  const currentUserPm = memberList.find(m => m.id === authUser?.id);
  const isPendingMember = currentUserPm?.status === 'pending';

  const wScore = projectData?.score_work;
  const dScore = projectData?.score_document;
  let totalScore = 0;
  if (wScore != null && dScore != null) totalScore = Math.round((wScore + dScore) / 2);
  else if (wScore != null) totalScore = wScore;
  else if (dScore != null) totalScore = dScore;

  const isCoAdvisor = authUser?.id === projectData?.co_advisor_id;
  const isPendingCoAdvisor = isCoAdvisor && projectData?.co_advisor_status === "pending";
  const canRemoveCoAdvisor = isAdmin || authUser?.id === projectData?.advisor_id || authUser?.id === projectData?.leader_id || isCoAdvisor;
  const isProjectCompleted = projectData.status === "completed";

  const reportsByWeek = {};
  (projectData?.project_reports || []).forEach((r) => { reportsByWeek[r.week_number] = r; });

  const alertsList = [];
  if (!isProjectCompleted && projectId) {
    const sortedReports = [...(projectData?.project_reports || [])].sort((a, b) => a.week_number - b.week_number);
    if (isStudent) {
      const pendingReports = sortedReports.filter(r => r.status === "pending" && (r.due_date || r.task_assigned));
      if (pendingReports.length > 0) {
        const nextPending = pendingReports[0];
        const isOverdue = nextPending.due_date && new Date() > new Date(nextPending.due_date);
        const alertId = `p${projectId}-pending-${nextPending.week_number}`;
        alertsList.push({
          id: alertId,
          type: isOverdue ? "danger" : "warning",
          week: nextPending.week_number,
          icon: isOverdue ? "warningTriangle" : "bell",
          title: isOverdue ? `เลยกำหนดส่งงานสัปดาห์ที่ ${nextPending.week_number}` : `แจ้งเตือนกำหนดส่งงานสัปดาห์ที่ ${nextPending.week_number}`,
          desc: `กำหนดส่ง: ${nextPending.due_date ? formatThaiDate(nextPending.due_date) : "ไม่ระบุ"}`,
          actionText: "ส่งงานสัปดาห์นี้",
          onClick: () => { handleDismissAlert(alertId); handleWeekChange(nextPending.week_number); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }
        });
      }
      const submittedReports = sortedReports.filter(r => r.status === "submitted");
      if (submittedReports.length > 0) {
         const latestSubmitted = submittedReports[submittedReports.length - 1];
         const alertId = `p${projectId}-submitted-${latestSubmitted.week_number}`;
         alertsList.push({
          id: alertId,
          type: "info",
          week: latestSubmitted.week_number,
          icon: "arrowsUp",
          title: `คุณส่งงานสัปดาห์ที่ ${latestSubmitted.week_number} แล้ว`,
          desc: "ระบบกำลังรออาจารย์ที่ปรึกษาตรวจและให้คะแนน",
          actionText: "ดูรายละเอียด",
          onClick: () => { handleDismissAlert(alertId); handleWeekChange(latestSubmitted.week_number); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }
         });
      }
      const reviewedReports = sortedReports.filter(r => r.status === "reviewed");
      if (reviewedReports.length > 0) {
         const latestReviewed = reviewedReports.sort((a, b) => b.week_number - a.week_number)[0];
         const alertId = `p${projectId}-reviewed-${latestReviewed.week_number}`;
         alertsList.push({
          id: alertId,
          type: "success",
          week: latestReviewed.week_number,
          icon: "checkCircle",
          title: `อาจารย์ตรวจงานสัปดาห์ที่ ${latestReviewed.week_number} แล้ว!`,
          desc: "มีคะแนนและข้อเสนอแนะใหม่จากอาจารย์",
          actionText: "ดูผลการตรวจ",
          onClick: () => { handleDismissAlert(alertId); handleWeekChange(latestReviewed.week_number); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }
         });
      }
    } else if (isAdvisorRole) {
      const submittedReports = sortedReports.filter(r => r.status === "submitted");
      if (submittedReports.length > 0) {
         const firstSubmitted = submittedReports[0];
         const alertId = `p${projectId}-advisor-submitted-${firstSubmitted.week_number}`;
         alertsList.push({
          id: alertId,
          type: "danger",
          week: firstSubmitted.week_number,
          icon: "bell",
          title: `แจ้งเตือน: นศ. ส่งงานสัปดาห์ที่ ${firstSubmitted.week_number} แล้ว`,
          desc: "รออาจารย์ตรวจและให้คะแนน",
          actionText: "ตรวจงานสัปดาห์นี้",
          onClick: () => { handleDismissAlert(alertId); handleWeekChange(firstSubmitted.week_number); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }
         });
      }
    }
  }
  const priorityMap = { danger: 1, warning: 2, success: 3, info: 4 };
  const topAlerts = alertsList.filter(a => !dismissedAlerts.includes(a.id)).sort((a, b) => priorityMap[a.type] - priorityMap[b.type]).slice(0, 2);

  const isLeader = authUser?.id === projectData?.leader_id;
  const isMainAdvisor = authUser?.id === projectData?.advisor_id;
  const isMainAdvisorOrAdmin = isMainAdvisor || isAdmin;
  const isViewOnlyAdvisor = isAdvisorRole && !isMainAdvisorOrAdmin;
  const isProjectAdvisor = isMainAdvisorOrAdmin;
  const isNormalMember = isStudent && !isLeader;

  const displayWeeksSet = new Set(projectData?.project_reports?.map((r) => r.week_number) || []);
  const displayWeeks = Array.from(displayWeeksSet).sort((a, b) => a - b);
  const totalWeeks = displayWeeks.length > 0 ? Math.max(...displayWeeks) : 0;

  const handleOpenAddWeekModal = () => {
    setNewWeekTask("");
    setNewWeekDueDate("");
    setNewWeekNumber(totalWeeks + 1);
    setIsAddWeekModalOpen(true);
  };

  const handleConfirmAddWeek = () => {
    if (!isProjectAdvisor) return Swal.fire("ปฏิเสธการเข้าถึง", "เฉพาะอาจารย์ที่ปรึกษาโครงงานเท่านั้นที่สามารถสร้างสัปดาห์ใหม่ได้", "error");
    const nextWk = Number(newWeekNumber);
    if (!nextWk || nextWk <= 0) return toast("กรุณาระบุสัปดาห์ที่ถูกต้อง", "error");

    const exists = projectData?.project_reports?.find((r) => r.week_number === nextWk);
    if (exists) return Swal.fire("แจ้งเตือน", `สัปดาห์ที่ ${nextWk} มีอยู่แล้ว`, "warning");

    return withSaving(async () => {
      const payload = {
        project_id: projectId, week_number: nextWk, status: "pending",
        task_assigned: !isStudent ? (newWeekTask.trim() || null) : null,
        due_date: (!isStudent && newWeekDueDate) ? new Date(newWeekDueDate.includes('T') ? newWeekDueDate : `${newWeekDueDate}T23:59:59`).toISOString() : null,
      };

      const { data, error } = await supabase.from("project_reports").insert(payload).select().single();
      if (error) throw error;

      setIsAddWeekModalOpen(false);
      applyReportToForm(data);

      const newReports = [...(projectData?.project_reports || []), data];
      setProjectData((prev) => ({ ...prev, project_reports: newReports }));
      setCurrentWeek(nextWk);

      if (!isStudent) {
        const memberEmails = (projectData?.project_members || []).map((m) => one(m.users)?.email).filter((e) => e && e !== authUser.email);
        if (memberEmails.length > 0) {
          const taskMsg = payload.task_assigned ? `\nงานที่มอบหมาย: ${payload.task_assigned}` : "";
          await notify(memberEmails, `อาจารย์ได้สร้างรายงานความคืบหน้าสัปดาห์ที่ ${nextWk} ในโครงงาน: ${projectData.title}${taskMsg}`);
        }
      }

      toast(`สร้างสัปดาห์ที่ ${nextWk} สำเร็จ`);

      setTimeout(() => {
        const scrollContainer = document.getElementById("week-scroll-container");
        if (scrollContainer) scrollContainer.scrollLeft = scrollContainer.scrollWidth;
      }, 100);
    });
  };

  const isEditingStudent = forceEdit || (reportStatus !== "submitted" && reportStatus !== "reviewed");
  const isEditingAdvisor = forceEdit || (reportStatus !== "reviewed" && (reportStatus !== "pending" || isSubmittedInPerson));
  const isEditingMode = isStudent ? isEditingStudent : isEditingAdvisor;

  return (
    <div className="min-h-screen bg-transparent flex flex-col relative" style={{ fontFamily: "'Kanit', sans-serif" }}>
      <Header user={authUser} fullName={fullName} profileImage={profileImage} role={role} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 relative z-10">

        {isPendingCoAdvisor && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div>
              <h3 className="text-base font-extrabold text-amber-900 flex items-center gap-2 mb-1">
                <Icon name="bellFilled" className="w-5 h-5 text-amber-500" />
                คำเชิญเป็นที่ปรึกษาร่วมจากกลุ่มนักศึกษา
              </h3>
              <p className="text-amber-800 text-xs font-medium">คุณสามารถอ่านรายละเอียด ขอบเขตงาน และดูรายชื่อนักศึกษาด้านล่างได้เลยครับ เมื่อตัดสินใจได้แล้วค่อยกดปุ่มด้านขวา</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto shrink-0 mt-2 md:mt-0">
              <button onClick={handleRemoveCoAdvisor} className="flex-1 md:flex-none px-4 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs transition-colors shadow-sm">ปฏิเสธคำเชิญ</button>
              <button onClick={handleAcceptCoAdvisor} className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm">ยอมรับ</button>
            </div>
          </div>
        )}

        {topAlerts.length > 0 && (
          <div className="flex flex-col gap-4 mb-5">
            {topAlerts.map(alert => (
              <div key={alert.id} className={`border-2 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in ${
                alert.type === 'danger' ? "bg-rose-50 border-rose-300" :
                alert.type === 'warning' ? "bg-amber-50 border-amber-300" :
                alert.type === 'success' ? "bg-emerald-50 border-emerald-300" :
                "bg-sky-50 border-sky-300"
              }`}>
                <div>
                  <h3 className={`text-[15px] font-black flex items-center gap-2 mb-1 ${
                    alert.type === 'danger' ? "text-rose-800" :
                    alert.type === 'warning' ? "text-amber-900" :
                    alert.type === 'success' ? "text-emerald-800" :
                    "text-sky-800"
                  }`}>
                    <Icon name={alert.icon} className={`w-5 h-5 ${
                      alert.type === 'danger' ? "text-rose-600" :
                      alert.type === 'warning' ? "text-amber-600" :
                      alert.type === 'success' ? "text-emerald-600" :
                      "text-sky-600"
                    }`} />
                    {alert.title}
                  </h3>
                  <p className={`${
                    alert.type === 'danger' ? "text-rose-700" :
                    alert.type === 'warning' ? "text-amber-800" :
                    alert.type === 'success' ? "text-emerald-700" :
                    "text-sky-700"
                  } text-xs ml-7 font-bold`}>
                    {alert.desc}
                  </p>
                </div>
                <button onClick={alert.onClick}
                  className={`w-full md:w-auto shrink-0 px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                    alert.type === 'danger' ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/30" :
                    alert.type === 'warning' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/30" :
                    alert.type === 'success' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30" :
                    "bg-sky-500 hover:bg-sky-600 shadow-sky-500/30"
                  }`}>
                  {alert.actionText}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center mb-5">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors px-2 py-1 rounded-lg">
            <Icon name="backArrow" className="w-4 h-4" />
            ย้อนกลับ
          </button>

          <div className="flex flex-wrap gap-2 justify-end">
            {isNormalMember && !isProjectCompleted && (
              <button type="button" onClick={handleLeaveProject} className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
                <Icon name="tray" className="w-4 h-4" /> ออกจากโครงงาน
              </button>
            )}
            {(isLeader || isMainAdvisor || isAdmin) && (
              <button type="button" onClick={handleDisbandProject} className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
                <Icon name="trash" className="w-4 h-4" /> {isProjectCompleted ? "ลบโครงงานถาวร" : "ยุบโครงงาน"}
              </button>
            )}
            {!isProjectCompleted && (isMainAdvisor || (isCoAdvisor && !isPendingCoAdvisor) || isAdmin) && (
              <button type="button" onClick={handleCompleteProject} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
                <Icon name="checkCircle" className="w-3.5 h-3.5" /> จบโครงงาน
              </button>
            )}
            <button type="button" onClick={handleGoToChat} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
              <Icon name="chat" className="w-4 h-4 text-indigo-500" /> เปิดห้องสนทนา
            </button>
          </div>
        </div>

        {/* ================= TOP SECTION ================= */}
        <section className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-100 mb-6 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-1.5 h-full ${isProjectCompleted ? "bg-emerald-500" : "bg-indigo-600"}`}></div>
          <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-6">

            <div className="flex-1 w-full min-w-0 pl-2">
              <div className="flex items-center gap-2 mb-3">
                {projectData.project_code ? (
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-extrabold tracking-widest">{projectData.project_code}</span>
                ) : (
                  (isAdvisorRole || isAdmin) && (
                    <button onClick={handleGenerateCode} className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[10px] font-bold hover:bg-amber-100 transition-colors flex items-center gap-1">
                      <Icon name="plus" className="w-3 h-3" /> สร้างรหัสโครงงาน
                    </button>
                  )
                )}
                {isProjectCompleted && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-extrabold tracking-widest">โครงงานเสร็จสิ้น</span>}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4 leading-tight break-words">{projectData.title}</h1>

              {originalRequest && (
                <button onClick={() => setIsRequestModalOpen(true)} className="mb-5 flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors w-fit shadow-sm">
                  <Icon name="document" className="w-4 h-4 text-indigo-500" /> ดูข้อเสนอโครงงานเริ่มต้น
                </button>
              )}

              <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-100 mb-5">
                <div className="flex justify-between items-center mb-4">
                  <strong className="text-slate-900 font-extrabold flex items-center gap-1.5 text-sm">
                    <Icon name="scopeChecklist" className="w-4 h-4 text-indigo-500" /> ขอบเขตโครงงาน
                  </strong>
                  <div className="flex items-center gap-2">
                    {hasUnsavedScopeChanges && !isProjectCompleted && (
                      <button onClick={handleSaveScopeStatus} disabled={isSavingUpdates} className="text-[11px] px-3 py-1.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg font-bold transition-all shadow-sm flex items-center gap-1">
                        {isSavingUpdates ? "กำลังบันทึก..." : "บันทึกคะแนน"}
                      </button>
                    )}
                    {(isStudent || isAdmin) && !isProjectCompleted && (
                      <button onClick={handleOpenEditScope} className="text-[11px] px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg font-bold transition-colors shadow-sm">แก้ไขหัวข้อ</button>
                    )}
                  </div>
                </div>

                {projectData.description && (
                  <p className="text-slate-600 text-[13px] leading-relaxed font-medium whitespace-pre-line mb-4 border-b border-slate-200 pb-4 break-words">
                    {projectData.description.replace(/\[สมาชิกในกลุ่ม\]:\s*([^\n\r]*)/g, "").trim()}
                  </p>
                )}

                {projectData?.scopes?.length ? (
                  <div className="space-y-3 max-h-[35vh] overflow-y-auto custom-scrollbar pr-2">
                    {projectData.scopes.map((scope, idx) =>
                      scope.title !== undefined ? (
                        <div key={idx} className={`flex items-center justify-between gap-2 p-2 rounded-lg transition-colors border border-transparent ${!isProjectCompleted && "hover:bg-white hover:border-slate-200 hover:shadow-sm"}`}>
                          <span className="text-[13px] font-semibold text-slate-800 transition-all break-words">{scope.title}</span>
                          <ScoreInput value={scope.score} onChange={(v) => handleScopeScoreChange(idx, null, v)} disabled={isProjectCompleted || (!isStudent && !isAdmin)} />
                        </div>
                      ) : (
                        <div key={idx} className="mb-2">
                          <h4 className="font-extrabold text-slate-900 text-[13px] mb-2 flex items-center gap-1.5 break-words">
                            <span className="w-1 h-3 bg-indigo-500 rounded-full shrink-0"></span>
                            {scope.mainTitle}
                            {scope.subScopes?.length > 0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-100">คะแนนเฉลี่ย: {scope.score || 0}</span>}
                          </h4>
                          <div className="space-y-1.5 pl-3 border-l border-slate-200 ml-0.5">
                            {scope.subScopes?.map((sub, sIdx) => (
                              <div key={sIdx} className={`flex items-center justify-between gap-3 p-1.5 -ml-1.5 rounded-lg transition-colors ${!isProjectCompleted && "hover:bg-white hover:shadow-sm hover:border hover:border-slate-100 border border-transparent"}`}>
                                <span className={`text-[12px] ${sub.score !== "" && sub.score !== null ? "text-emerald-700" : "text-slate-600"} font-semibold transition-all break-words`}>{sub.title}</span>
                                <ScoreInput value={sub.score} onChange={(v) => handleScopeScoreChange(idx, sIdx, v)} disabled={isProjectCompleted || (!isStudent && !isAdmin)} size="sm" />
                              </div>
                            ))}
                            {!scope.subScopes?.length && <span className="text-[10px] text-slate-400 font-medium italic block py-1">ไม่มีขอบเขตย่อย</span>}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs font-medium italic text-center py-4 bg-white rounded-xl border border-dashed border-slate-200">ยังไม่มีการระบุขอบเขตย่อย</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                {isAdvSameAsClassInst && classInstructor ? (
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <span className="text-[11px] font-extrabold text-slate-500">อาจารย์ประจำวิชา / ที่ปรึกษาหลัก:</span>
                    <span className="text-[12px] font-bold text-slate-800">{classInstructor.prefix || ""}{classInstructor.first_name} {classInstructor.last_name}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                      <span className="text-[11px] font-extrabold text-slate-500">อ.ประจำวิชา:</span>
                      <span className="text-[12px] font-bold text-slate-800">
                        {classInstructor ? `${classInstructor.prefix || ""}${classInstructor.first_name} ${classInstructor.last_name}` : <span className="text-rose-500">ยังไม่เข้าห้องเรียน</span>}
                      </span>
                    </div>
                    {projectAdvisor && (
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-[11px] font-extrabold text-slate-500">ที่ปรึกษาหลัก:</span>
                        <span className="text-[12px] font-bold text-slate-800">{projectAdvisor.prefix || ""}{projectAdvisor.first_name} {projectAdvisor.last_name}</span>
                      </div>
                    )}
                  </>
                )}

                {coAdvisor ? (
                  <div className="flex items-center gap-1.5 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100 shadow-sm relative">
                    <span className="text-[11px] font-extrabold text-sky-600">ที่ปรึกษาร่วม:</span>
                    <span className="text-[12px] font-bold text-sky-900">{coAdvisor.prefix || ""}{coAdvisor.first_name} {coAdvisor.last_name}</span>
                    {projectData.co_advisor_status === "pending" && <span className="text-[9px] font-extrabold text-amber-600 bg-amber-100 px-1 py-0.5 rounded ml-0.5">(รอตอบรับ)</span>}
                  </div>
                ) : (
                  (isAdmin || isMainAdvisor || isLeader) && !isProjectCompleted && (
                    <button onClick={handleAddCoAdvisor} className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-[11px] font-bold shadow-sm">
                      <Icon name="plus" className="w-3.5 h-3.5" /> เพิ่มที่ปรึกษาร่วม / ภายนอก
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="shrink-0 flex flex-col gap-4 w-full lg:w-[280px] xl:w-[300px]">
              <div className={`border px-4 py-3 rounded-xl flex items-center justify-center gap-2 w-full shadow-sm ${isPendingMember ? "bg-sky-50 border-sky-200 text-sky-700" : isProjectCompleted ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-indigo-50 border-indigo-200 text-indigo-700"}`}>
                {!isProjectCompleted && !isPendingMember && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>}
                {isPendingMember && <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>}
                <span className="text-xs font-extrabold tracking-wide">{isPendingMember ? "สถานะ: คุณถูกเชิญ" : isProjectCompleted ? "โครงงานเสร็จสิ้นแล้ว" : "สถานะ: กำลังดำเนินงาน"}</span>
              </div>

              <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-sky-400"></div>
                <div className="text-center mb-5 pt-1">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">คะแนนรวมเฉลี่ย</p>
                  <p className="text-4xl font-black text-slate-900">{totalScore} <span className="text-lg text-slate-400 font-bold">/ 100</span></p>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
                    <div className={`h-1.5 rounded-full transition-all duration-1000 ${getProgressColor(totalScore)}`} style={{ width: `${totalScore}%` }}></div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <ScoreBar label="ความคืบหน้าชิ้นงาน" score={wScore} thin />
                  <ScoreBar label="ความคืบหน้ารูปเล่ม" score={dScore} thin />
                </div>
              </div>

              <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 mb-3">
                  <Icon name="people" className="w-4 h-4 text-indigo-500" /> สมาชิกในทีม
                </h2>
                {memberList.length === 0 ? (
                  <p className="text-[11px] text-slate-400 font-medium text-center py-3 bg-slate-50 rounded-xl border border-slate-100">ไม่มีข้อมูลสมาชิก</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 mb-3">
                    {memberList.slice(0, 4).map((member, idx) => (
                      <li key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer group" onClick={() => handleViewStudentInfo(member)}>
                        <div className="flex items-center gap-2.5">
                          <Avatar src={member.image} name={member.name} size="w-10 h-10" />
                          <span className="text-[12px] font-bold text-slate-700 truncate max-w-[100px] group-hover:text-indigo-600 transition-colors" title={member.name}>{member.name}</span>
                        </div>
                        {member.isLeader ? (
                          <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-center whitespace-nowrap">หัวหน้า</span>
                        ) : member.status === 'pending' ? (
                          <span className="text-[9px] font-extrabold bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded text-center whitespace-nowrap">รอตอบรับ</span>
                        ) : (
                          <span className="text-[9px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-center whitespace-nowrap">สมาชิก</span>
                        )}
                      </li>
                    ))}
                    {memberList.length > 4 && <div className="text-[10px] text-center text-slate-400 font-bold pt-1.5">และสมาชิกอีก {memberList.length - 4} คน</div>}
                  </ul>
                )}
                <button onClick={() => setIsMemberModalOpen(true)} className="w-full py-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 text-[11px] font-bold rounded-lg border border-slate-200 transition-all shadow-sm">จัดการสิทธิ์สมาชิก</button>
              </div>
            </div>
          </div>
        </section>

        {/* ================= WEEKLY SUBMIT / REVIEW SECTION ================= */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-5">

          <div className="px-5 md:px-6 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg"><Icon name="calendar" className="w-4 h-4" /></span>
                รายงานความคืบหน้ารายสัปดาห์
              </h2>
              <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 border border-emerald-500 shadow-sm"></span>ตรวจแล้ว</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400 border border-sky-500 shadow-sm"></span>ส่งงานแล้ว</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 border border-amber-500 shadow-sm"></span>นัดส่งงาน</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-300 shadow-sm"></span>ยังไม่มีกำหนด</span>
              </div>
            </div>

            {displayWeeks.length > 0 && (
              <div id="week-scroll-container" className="flex gap-3 overflow-x-auto custom-scrollbar pb-4 px-1 scroll-smooth items-center">
                {displayWeeks.map((wk) => {
                  const reportForWeek = reportsByWeek[wk];
                  const meta = getWeekChipMeta(reportForWeek);
                  const active = currentWeek === wk;
                  const activeStyle = active
                    ? "border-b-[4px] border-b-indigo-500 shadow-md transform -translate-y-1 bg-indigo-50 text-indigo-800 border-indigo-200"
                    : "border-b-[4px] border-b-transparent shadow-sm hover:shadow-md hover:-translate-y-0.5";

                  return (
                    <button key={wk} type="button" onClick={() => handleWeekChange(wk)}
                      className={`shrink-0 flex flex-col items-start justify-center w-[84px] h-[72px] rounded-xl border p-3 transition-all duration-200 ${meta.bg} ${activeStyle}`}>
                      <div className="flex w-full justify-between items-center mb-1.5">
                        <span className="font-black text-sm tracking-wide">W{wk}</span>
                        {meta.icon ? <Icon name={meta.icon} className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>}
                      </div>
                      <span className="text-[10px] font-bold opacity-80 truncate w-full text-left">{meta.label}</span>
                    </button>
                  );
                })}

                {isProjectAdvisor && !isProjectCompleted && (
                  <button type="button" onClick={handleOpenAddWeekModal} title="เพิ่มสัปดาห์ใหม่"
                    className="shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-400 transition-all bg-slate-50 hover:bg-white hover:shadow-sm">
                    <Icon name="plus" className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {displayWeeks.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 shrink-0">
              <Icon name="calendar" className="w-16 h-16 mb-4 text-slate-300 opacity-50" />
              <p className="font-extrabold text-base mb-1">ยังไม่มีรายงานความคืบหน้ารายสัปดาห์</p>
              {isProjectAdvisor && !isProjectCompleted ? (
                <>
                  <p className="text-xs mb-5 opacity-80">คลิกที่ปุ่มด้านล่างเพื่อสร้างสัปดาห์แรกและเริ่มต้นการสั่งงาน</p>
                  <button type="button" onClick={handleOpenAddWeekModal}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-indigo-500/20 flex items-center gap-2">
                    <Icon name="plus" className="w-4 h-4" /> สร้างสัปดาห์ส่งงาน
                  </button>
                </>
              ) : isProjectCompleted ? (
                <p className="text-xs mt-1 opacity-80">โครงงานนี้เสร็จสิ้นแล้ว โดยไม่มีประวัติการส่งงานรายสัปดาห์</p>
              ) : (
                <p className="text-xs mt-1 opacity-80">รออาจารย์ที่ปรึกษาสร้างสัปดาห์ส่งงาน</p>
              )}
            </div>
          ) : (
            <>
              <div className={`mx-5 md:mx-6 mb-5 border p-4 rounded-2xl shadow-sm relative overflow-hidden ${
                reportStatus === 'reviewed' ? 'bg-emerald-50 border-emerald-200' :
            reportStatus === 'submitted' ? 'bg-sky-50 border-sky-200' :
            'bg-amber-50 border-amber-200'
          }`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${
              reportStatus === 'reviewed' ? 'bg-emerald-500' :
              reportStatus === 'submitted' ? 'bg-sky-400' :
              'bg-amber-400'
            }`}></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className={`font-black text-base flex items-center gap-2 ${
                  reportStatus === 'reviewed' ? 'text-emerald-800' :
                  reportStatus === 'submitted' ? 'text-sky-800' :
                  'text-amber-800'
                }`}>
                  <Icon name={reportStatus === 'reviewed' ? "checkCircle" : reportStatus === 'submitted' ? "arrowsUp" : "bell"} className={`w-5 h-5 shrink-0 ${
                    reportStatus === 'reviewed' ? 'text-emerald-500' :
                    reportStatus === 'submitted' ? 'text-sky-500' :
                    'text-amber-500'
                  }`} /> 
                  สถานะงานสัปดาห์ที่ {currentWeek}
                </h4>
                <p className={`text-[14px] font-extrabold mt-1.5 flex items-center gap-1.5 ${
                  reportStatus === 'reviewed' ? 'text-emerald-700' :
                  reportStatus === 'submitted' ? 'text-sky-700' :
                  'text-amber-700'
                }`}>
                  {reportStatus === 'reviewed' ? 'นักศึกษาส่งงานแล้ว และ อาจารย์ตรวจให้คะแนนแล้ว' :
                   reportStatus === 'submitted' ? 'นักศึกษาส่งงานแล้ว (กำลังรออาจารย์ตรวจ)' :
                   (taskAssigned || dueDate) ? 'อาจารย์มอบหมายงานแล้ว (ยังไม่ส่งงาน)' :
                   'รอดำเนินการ (ยังไม่กำหนดเป้าหมายและยังไม่ส่งงาน)'}
                </p>
              </div>
              {dueDate && (
                <span className={`text-[11px] font-extrabold px-3 py-1.5 rounded-lg border shadow-sm flex items-center gap-1.5 shrink-0 ${
                  isLate && reportStatus !== 'reviewed' && reportStatus !== 'submitted' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                  'bg-white text-slate-600 border-slate-200'
                }`}>
                  <Icon name="calendar" className={`w-3.5 h-3.5 ${isLate && reportStatus !== 'reviewed' && reportStatus !== 'submitted' ? 'text-rose-500' : 'text-slate-400'}`} /> 
                  กำหนดส่ง: {formatThaiDate(dueDate)}
                </span>
              )}
            </div>
            {taskAssigned && (
              <div className={`text-[13px] font-semibold whitespace-pre-wrap leading-relaxed p-3 rounded-xl border ${
                reportStatus === 'reviewed' ? 'bg-emerald-100/50 text-emerald-900 border-emerald-100' :
                reportStatus === 'submitted' ? 'bg-sky-100/50 text-sky-900 border-sky-100' :
                'bg-white text-amber-900 border-amber-100'
              }`}>
                <div className="font-bold mb-1 opacity-70 text-[10px] uppercase">สิ่งที่ต้องส่งสัปดาห์นี้</div>
                {taskAssigned}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 border-t border-slate-100">

            {/* -------- LEFT: SUBMIT PANEL -------- */}
            <div className="p-5 md:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon name="arrowsUp" className="w-3.5 h-3.5" /></span>
                  ส่งงานสัปดาห์นี้
                </h3>
                <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border shadow-sm ${driveUrl || taskSubmittedTitle || pdfUrls.length > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                  {driveUrl || taskSubmittedTitle || pdfUrls.length > 0 ? "นศ.ส่งงานแล้ว" : "ยังไม่ส่งงาน"}
                </span>
              </div>

              {isLate && reportStatus !== 'reviewed' && (
                <div className="mb-4 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0">
                  <Icon name="warningTriangle" className="w-3.5 h-3.5 shrink-0" /> งานสัปดาห์นี้ถูกส่งล่าช้ากว่ากำหนด
                </div>
              )}

              <form onSubmit={handleSaveReportData} className="flex flex-col flex-1 space-y-4">
                <div>
                  <label className="text-[12px] font-extrabold text-slate-700 block mb-1.5">หัวชื่องานที่ส่ง <span className="text-rose-500">*</span></label>
                  {isStudent && !isProjectCompleted && isEditingMode ? (
                    <input type="text" value={taskSubmittedTitle} onChange={(e) => setTaskSubmittedTitle(e.target.value)} placeholder="เช่น บทที่ 1-3 สมบูรณ์ หรือ แผนภาพระบบ" required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm" />
                  ) : (
                    <div className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-[13px] font-semibold break-words shadow-sm">
                      {taskSubmittedTitle || <span className="text-slate-400 font-medium italic">- ไม่ได้ระบุหัวชื่องาน -</span>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[12px] font-extrabold text-slate-700 block mb-1.5">
                    ลิงก์ Google Drive แนบงาน <span className="text-slate-400 font-normal ml-1">(ไม่บังคับ)</span>
                  </label>
                  {isStudent && !isProjectCompleted && isEditingMode ? (
                    <input type="url" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://docs.google.com/... (ถ้ามี)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm mb-2" />
                  ) : (
                    <div className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2.5 text-[13px] mb-2 font-semibold shadow-sm">
                      <span className="truncate block max-w-full">{driveUrl || <span className="text-slate-400 font-medium italic">- ไม่ได้แนบลิงก์ส่งงาน -</span>}</span>
                    </div>
                  )}
                  {driveUrl && (
                    <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-indigo-600 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-lg text-[11px] font-bold transition-all w-fit shadow-sm">
                      <Icon name="externalLink" className="w-4 h-4 shrink-0" /> เปิดลิงก์ผลงาน
                    </a>
                  )}
                </div>

                {/* ===== อัปโหลด PDF รองรับหลายไฟล์ (นักศึกษา) ===== */}
                <div>
                  <label className="text-[12px] font-extrabold text-slate-700 block mb-1.5">
                    ไฟล์ PDF แนบงาน <span className="text-slate-400 font-normal ml-1">(ไม่บังคับ, ไฟล์ละไม่เกิน {MAX_PDF_SIZE_MB}MB)</span>
                  </label>

                  {/* List of previously uploaded files */}
                  {pdfUrls.map((item, idx) => (
                    <PdfFileRow key={`url-${idx}`} name={item.name} url={item.url} tone="slate"
                      onRemove={isStudent && !isProjectCompleted && isEditingMode ? async () => {
                        const res = await confirmSwal("ยืนยันการลบ", `ต้องการลบไฟล์ ${item.name} หรือไม่? (ระบบจะลบไฟล์ออกจาก Google Drive เมื่อกดบันทึก)`, { danger: true });
                        if (res.isConfirmed) {
                          setDeletedPdfUrls((prev) => [...prev, item]);
                          setPdfUrls(pdfUrls.filter((_, i) => i !== idx));
                        }
                      } : null} />
                  ))}

                  {/* List of new files to upload */}
                  {isStudent && !isProjectCompleted && isEditingMode && pdfFiles.map((file, idx) => (
                    <PdfFileRow key={`file-${idx}`} name={file.name} tone="indigo"
                      onRemove={async () => {
                        const res = await confirmSwal("ยืนยันการลบ", `ต้องการลบไฟล์ ${file.name} ที่เพิ่งเลือก หรือไม่?`, { danger: true });
                        if (res.isConfirmed) setPdfFiles(pdfFiles.filter((_, i) => i !== idx));
                      }} />
                  ))}

                  {/* Add Button */}
                  {isStudent && !isProjectCompleted && isEditingMode && (
                    <PdfUploadInput id="pdf-upload" onSelect={(files) => setPdfFiles([...pdfFiles, ...files])} />
                  )}

                  {/* Empty state for non-students or non-editing mode */}
                  {(!isStudent || (!isEditingMode && pdfUrls.length === 0)) && pdfUrls.length === 0 && (
                    <div className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2.5 text-[13px] mb-2 font-semibold shadow-sm">
                      <span className="text-slate-400 font-medium italic">- ไม่ได้แนบไฟล์ PDF -</span>
                    </div>
                  )}
                </div>
                {/* ======================================================= */}

                {isStudent && !isProjectCompleted && (
                  <div className="pt-4 mt-auto border-t border-slate-100 flex flex-col gap-2">
                    {!isEditingMode ? (
                      <div className="flex gap-2">
                        <button type="button" disabled className="flex-1 px-5 py-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 text-[13px] font-bold shadow-sm flex items-center justify-center gap-2">
                          <Icon name="check" className="w-4 h-4" /> {reportStatus === "reviewed" ? "อาจารย์ตรวจแล้ว" : "นักศึกษาส่งงานให้แล้วรอตรวจ"}
                        </button>
                        <button type="button" onClick={() => setForceEdit(true)} className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[13px] font-bold shadow-sm flex items-center justify-center gap-2 transition-colors">
                          <Icon name="edit" className="w-4 h-4" /> แก้ไขข้อมูล
                        </button>
                      </div>
                    ) : (
                      <>
                        <button type="submit" disabled={isSavingUpdates} className="w-full px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold transition-all shadow-sm shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50">
                          <Icon name="check" className="w-4 h-4" /> {isSavingUpdates ? "กำลังบันทึก..." : (reportStatus === "submitted" || reportStatus === "reviewed" ? "บันทึกการแก้ไข" : `ส่งงานสัปดาห์ที่ ${currentWeek}`)}
                        </button>
                        <p className="text-[10px] text-slate-400 font-medium text-center mt-1">ระบบจะแจ้งเตือนอาจารย์ที่ปรึกษาทันทีที่กดบันทึก</p>
                      </>
                    )}
                  </div>
                )}
              </form>
            </div>

            {/* -------- RIGHT: REVIEW PANEL -------- */}
            <div className="p-5 md:p-6 flex flex-col bg-slate-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Icon name="check" className="w-3.5 h-3.5" /></span>
                  ผลการตรวจงาน W{currentWeek}
                </h3>
                <div className="flex items-center gap-2">
                  {isMainAdvisorOrAdmin && !isProjectCompleted && (
                    <button type="button" onClick={() => handleDeleteWeek(currentWeek)}
                      className="flex items-center gap-1.5 text-[11px] font-extrabold text-rose-600 bg-white border border-rose-200 px-3 py-1.5 rounded-full hover:bg-rose-50 hover:border-rose-300 transition-all shadow-sm group"
                      title={`ลบข้อมูลของสัปดาห์ที่ ${currentWeek}`}>
                      <Icon name="trash" className="w-3.5 h-3.5 text-rose-400 group-hover:text-rose-600 transition-colors" /> ลบสัปดาห์นี้
                    </button>
                  )}
                  <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border shadow-sm ${reportStatus === "reviewed" ? "bg-emerald-50 text-emerald-700 border-emerald-300" : reportStatus === "submitted" ? "bg-sky-50 text-sky-700 border-sky-300" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                    {reportStatus === "reviewed" ? "อาจารย์ตรวจแล้ว" : reportStatus === "submitted" ? "รออาจารย์ตรวจ" : "ยังไม่ตรวจ"}
                  </span>
                </div>
              </div>

              <div className="flex bg-slate-200/60 p-1 rounded-xl mb-4 w-full">
                <button
                  type="button"
                  onClick={() => setReviewRole("advisor")}
                  className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${reviewRole === "advisor" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  อาจารย์ที่ปรึกษา
                </button>
                <button
                  type="button"
                  onClick={() => setReviewRole("instructor")}
                  className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${reviewRole === "instructor" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  อาจารย์ประจำวิชา
                </button>
              </div>

              {isAdvisorRole && !isProjectCompleted && isPendingCoAdvisor && (
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-center flex-1 flex flex-col items-center justify-center shrink-0">
                  <Icon name="warningTriangle" className="w-10 h-10 text-amber-300 mb-2" />
                  <p className="text-amber-800 font-extrabold text-xs">กรุณาตอบรับคำเชิญด้านบน ก่อนดำเนินการตรวจงานนักศึกษา</p>
                </div>
              )}
              {isMainAdvisorOrAdmin && !isProjectCompleted && !isPendingCoAdvisor && !currentReportId && (
                <div className="flex-1 flex flex-col items-center justify-center text-center bg-white border border-dashed border-slate-200 rounded-2xl py-8 px-4 shrink-0">
                  <Icon name="edit" className="w-9 h-9 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-500 mb-1">ยังไม่มีการนัดหมายหรือส่งงานในสัปดาห์นี้</p>
                  <p className="text-[11px] text-slate-400">ตั้งเป้าหมายและวันนัดส่งด้านล่าง เพื่อเปิดให้นักศึกษาส่งงาน</p>
                </div>
              )}

              {isMainAdvisorOrAdmin && !isProjectCompleted && !isPendingCoAdvisor && (
                <form onSubmit={handleSaveReportData} className="flex flex-col flex-1 space-y-4">
                  {reviewRole === "advisor" && (
                    <details className="bg-white rounded-2xl border border-slate-200 shadow-sm group" open={isAssignmentOpen} onToggle={(e) => setIsAssignmentOpen(e.target.open)}>
                      <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between text-[12px] font-black text-slate-900">
                        <span className="flex items-center gap-1.5">
                          <Icon name="calendar" className="w-4 h-4 text-indigo-500" />
                          {(taskAssigned || dueDate) ? "แก้ไขการนัดหมาย / กำหนดงาน" : "กำหนดงาน / นัดส่งสัปดาห์นี้"}
                        </span>
                        <Icon name="chevronDown" className="w-3.5 h-3.5 text-slate-400 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                        <div>
                          <label className="text-[11px] font-extrabold text-slate-600 block mb-1">สิ่งที่ต้องการให้ส่งสัปดาห์นี้</label>
                          <textarea value={taskAssigned} onChange={(e) => setTaskAssigned(e.target.value)} placeholder={"เช่น 1. บทที่ 1-2 \n2. แผนภาพ ER Diagram..."}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none min-h-[60px] shadow-sm" />
                        </div>
                        <div>
                          <label className="text-[11px] font-extrabold text-slate-600 block mb-1">วันที่และเวลากำหนดส่ง</label>
                          <div className="flex flex-wrap gap-2">
                            <div className="relative flex-1 min-w-[200px] flex gap-2">
                              <input type="date" lang="en-GB" value={dueDate ? dueDate.split('T')[0] : ""}
                                onChange={(e) => {
                                  const d = e.target.value;
                                  const t = dueDate && dueDate.includes('T') ? dueDate.split('T')[1] : "";
                                  setDueDate(d ? (t ? `${d}T${t}` : d) : "");
                                }}
                                className="w-1/2 bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm" />
                              <div className="relative w-1/2">
                                <input type="text" placeholder="HH:mm" maxLength="5" value={dueDate && dueDate.includes('T') ? dueDate.split('T')[1] : ""}
                                  onChange={(e) => {
                                    let t = e.target.value.replace(/[^0-9:]/g, '');
                                    if (!t.includes(':') && t.length > 2) t = t.substring(0, 2) + ':' + t.substring(2);
                                    let parts = t.split(':');
                                    if (parts[0].length > 2) parts[0] = parts[0].substring(0, 2);
                                    if (parts[0].length === 2 && parseInt(parts[0]) > 23) parts[0] = '23';
                                    if (parts[0].length === 1 && parseInt(parts[0]) > 2 && e.nativeEvent?.inputType !== 'deleteContentBackward' && parts.length === 1) parts[0] = '0' + parts[0];
                                    if (parts.length > 1 && parts[0].length === 1) parts[0] = '0' + parts[0];
                                    if (parts[0].length === 2 && parts.length === 1 && e.nativeEvent?.inputType !== 'deleteContentBackward') parts.push('');
                                    if (parts.length > 1) {
                                      let min = parts[1];
                                      if (min.length > 0 && parseInt(min[0]) > 5) min = '5' + min.substring(1);
                                      if (min.length > 2) min = min.substring(0, 2);
                                      t = parts[0] + ':' + min;
                                    } else {
                                      t = parts[0];
                                    }
                                    const d = dueDate ? dueDate.split('T')[0] : new Date().toISOString().split('T')[0];
                                    setDueDate(t ? `${d}T${t}` : d);
                                  }}
                                  disabled={!dueDate}
                                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" />
                                <svg className="w-[12px] h-[12px] text-slate-700 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M12 6v6l4 2" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex gap-1.5 w-full sm:w-auto">
                              <button type="button" onClick={handleSaveDueDate} disabled={isSavingUpdates} className="flex-1 sm:flex-none px-4 py-1.5 bg-indigo-50 border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-extrabold transition-all shadow-sm whitespace-nowrap">
                                {(taskAssigned || dueDate) ? "บันทึกการแก้ไข" : "บันทึกนัด"}
                              </button>
                              {(taskAssigned || dueDate) && (
                                <button type="button" onClick={handleCancelDueDate} disabled={isSavingUpdates} className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-[11px] font-extrabold transition-all shadow-sm whitespace-nowrap">
                                  ยกเลิกนัดหมาย
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  )}

                  {currentReportId && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                      {reviewRole === "advisor" ? (
                        <>
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                              <label className="text-[11px] font-extrabold text-slate-700 block mb-1">คะแนนชิ้นงาน <span className="text-slate-400 font-medium">(เต็ม 100)</span></label>
                              <input type="number" min="0" max="100" 
                                value={weeklyScoreWork} 
                                onChange={(e) => setWeeklyScoreWork(e.target.value)} 
                                placeholder="0-100" disabled={!isEditingMode}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[11px] font-extrabold text-slate-700 block mb-1">คะแนนรูปเล่ม <span className="text-slate-400 font-medium">(เต็ม 100)</span></label>
                              <input type="number" min="0" max="100" 
                                value={weeklyScoreDoc} 
                                onChange={(e) => setWeeklyScoreDoc(e.target.value)} 
                                placeholder="0-100" disabled={!isEditingMode}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed" />
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-[11px] font-extrabold text-slate-700 block mb-1">ข้อเสนอแนะเพิ่มเติม</label>
                            <textarea 
                              value={feedback} 
                              onChange={(e) => setFeedback(e.target.value)} 
                              placeholder={`คอมเมนต์งานสัปดาห์ที่ ${currentWeek}...`} disabled={!isEditingMode}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium resize-none outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 min-h-[80px] shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"></textarea>
                          </div>

                          <div className="pt-2 border-t border-slate-100">
                            <label className="text-[11px] font-extrabold text-slate-700 block mb-1.5">
                              แนบไฟล์ PDF ส่งกลับ <span className="text-slate-400 font-normal ml-1">(ไม่บังคับ, ไฟล์ละไม่เกิน {MAX_PDF_SIZE_MB}MB)</span>
                            </label>

                            {/* List of previously uploaded files */}
                            {advisorPdfUrls.map((item, idx) => (
                              <PdfFileRow key={`adv-url-${idx}`} name={item.name} url={item.url} tone="slate"
                                onRemove={isEditingMode ? async () => {
                                  const res = await confirmSwal("ยืนยันการลบ", `ต้องการลบไฟล์ ${item.name} หรือไม่? (ระบบจะลบไฟล์ออกจาก Google Drive เมื่อกดบันทึก)`, { danger: true });
                                  if (res.isConfirmed) {
                                    setDeletedAdvPdfUrls((prev) => [...prev, item]);
                                    setAdvisorPdfUrls(advisorPdfUrls.filter((_, i) => i !== idx));
                                  }
                                } : null} />
                            ))}

                            {/* List of new files to upload */}
                            {isEditingMode && advisorPdfFiles.map((file, idx) => (
                              <PdfFileRow key={`adv-file-${idx}`} name={file.name} tone="emerald"
                                onRemove={() => setAdvisorPdfFiles(advisorPdfFiles.filter((_, i) => i !== idx))} />
                            ))}

                            {/* Add Button */}
                            {isEditingMode && (
                              <PdfUploadInput id="adv-pdf-upload" onSelect={(files) => setAdvisorPdfFiles([...advisorPdfFiles, ...files])} label="เพิ่มไฟล์ PDF ส่งกลับให้นักศึกษา" />
                            )}
                            
                            {/* Empty state for non-editing mode */}
                            {!isEditingMode && advisorPdfUrls.length === 0 && (
                              <div className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2.5 text-[13px] mb-2 font-semibold shadow-sm">
                                <span className="text-slate-400 font-medium italic">- ไม่ได้แนบไฟล์ PDF ส่งกลับ -</span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="text-[11px] font-extrabold text-slate-700 block mb-1.5">
                            ข้อเสนอแนะเพิ่มเติมจากอาจารย์ประจำวิชา
                          </label>
                          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium min-h-[80px] shadow-inner text-slate-700 whitespace-pre-wrap flex items-start">
                            {instFeedback ? (
                              <span>{instFeedback}</span>
                            ) : (
                              <span className="text-slate-400 italic flex items-center gap-1.5 mx-auto self-center">
                                <Icon name="document" className="w-4 h-4 opacity-50" /> ไม่มีข้อเสนอแนะจากอาจารย์ประจำวิชา
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {reviewRole === "advisor" && reportStatus === "pending" && (
                        <div className="mt-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-sm">
                          <label className="flex items-start sm:items-center gap-3 cursor-pointer group">
                            <div className="relative inline-flex items-center cursor-pointer mt-0.5 sm:mt-0 shrink-0">
                              <input type="checkbox" checked={isSubmittedInPerson} onChange={(e) => setIsSubmittedInPerson(e.target.checked)} className="sr-only peer" />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-50"></div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[13px] font-bold text-amber-900 group-hover:text-amber-800 transition-colors">ปลดล็อกการให้คะแนนพิเศษ</span>
                              <span className="text-[11px] font-medium text-amber-700 mt-0.5">นักศึกษามาส่งงานต่อหน้า (ไม่ต้องรอระบบ)</span>
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {reviewRole === "advisor" && (
                    <div className="pt-1 mt-auto">
                      {(!isEditingMode && reportStatus === "reviewed") ? (
                        <div className="flex gap-2 mt-4">
                          <button type="button" disabled className="flex-1 px-5 py-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 text-[13px] font-bold shadow-sm flex items-center justify-center gap-2">
                            <Icon name="check" className="w-4 h-4" /> อาจาร์ยตรวจแล้ว
                          </button>
                          <button type="button" onClick={() => setForceEdit(true)} className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[13px] font-bold shadow-sm flex items-center justify-center gap-2 transition-colors">
                            <Icon name="edit" className="w-4 h-4" /> แก้ไขคะแนน
                          </button>
                        </div>
                      ) : (!isEditingMode && reportStatus === "pending") ? (
                        <button type="button" disabled className="w-full mt-4 px-5 py-3 rounded-xl bg-slate-50 text-slate-400 border border-slate-200 text-[13px] font-bold shadow-sm flex items-center justify-center gap-2">
                          <Icon name="time" className="w-4 h-4" /> รอรับงานจากนักศึกษา
                        </button>
                      ) : (
                        <button type="submit" disabled={isSavingUpdates || !currentReportId || (reportStatus === "pending" && !isSubmittedInPerson)}
                          className={`w-full px-5 py-3 mt-4 text-white rounded-xl text-[13px] font-bold disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none shadow-sm transition-all flex items-center justify-center gap-2 border border-transparent ${reportStatus === "submitted" ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"}`}>
                          {isSavingUpdates ? (
                             <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> กำลังบันทึก...</>
                          ) : (reportStatus === "pending" && !isSubmittedInPerson) ? (
                             <><Icon name="time" className="w-4 h-4" /> รอรับงานจากนักศึกษา</>
                          ) : reportStatus === "submitted" ? (
                             <><Icon name="document" className="w-4 h-4" /> นักศึกษาส่งงานให้แล้วรอตรวจ (คลิกเพื่อบันทึกผล)</>
                          ) : (
                             <><Icon name="check" className="w-4 h-4" /> บันทึกผลสัปดาห์ที่ {currentWeek}</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </form>
              )}

              {/* View Panel for Students, View-Only Advisors, or Completed Projects */}
              {(isStudent || isProjectCompleted || isViewOnlyAdvisor) && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 flex flex-col flex-1 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
                  {/* Decorative Background Blob */}
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-gradient-to-br from-blue-50 to-sky-50 blur-3xl opacity-60 pointer-events-none"></div>

                  {isViewOnlyAdvisor && !isProjectCompleted && (
                    <div className="mb-4 px-3.5 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-xs font-bold flex items-center gap-2 shadow-sm relative z-10">
                      <Icon name="user" className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>สิทธิ์การเข้าถึง: ดูข้อมูลความก้าวหน้า (อาจารย์ที่ปรึกษาร่วม / บุคลากรภายนอก)</span>
                    </div>
                  )}

                  {reviewRole === "advisor" && (
                    <div className="flex gap-4 mb-6 relative z-10">
                      <div className="flex-1 bg-gradient-to-br from-white to-slate-50 rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                        <span className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">คะแนนชิ้นงาน</span>
                        <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800">
                          {reportStatus === "reviewed" && weeklyScoreWork !== "" ? weeklyScoreWork : "-"}
                        </span>
                      </div>
                      <div className="flex-1 bg-gradient-to-br from-white to-slate-50 rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-blue-500"></div>
                        <span className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">คะแนนรูปเล่ม</span>
                        <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-blue-700">
                          {reportStatus === "reviewed" && weeklyScoreDoc !== "" ? weeklyScoreDoc : "-"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="relative z-10 flex flex-col h-full">
                    
                    {/* Status Banner (if not reviewed) */}
                    {reportStatus !== "reviewed" && (
                      <div className={`mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl border ${reportStatus === 'submitted' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                        <div className={`p-2 rounded-full ${reportStatus === 'submitted' ? 'bg-white shadow-sm border border-blue-100' : 'bg-white shadow-sm border border-slate-100'}`}>
                          <Icon name={reportStatus === 'submitted' ? 'calendar' : 'document'} className={`w-5 h-5 ${reportStatus === 'submitted' ? 'text-blue-500 animate-[pulse_3s_ease-in-out_infinite]' : 'opacity-40'}`} />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold">{reportStatus === 'submitted' ? 'ส่งงานแล้ว กำลังรออาจารย์ตรวจ' : 'ยังไม่มีข้อมูลผลการตรวจ'}</p>
                          <p className="text-[11px] font-medium opacity-70 mt-0.5">{reportStatus === 'submitted' ? 'ผลการตรวจจะแสดงด้านล่างเมื่ออาจารย์ให้คะแนน' : 'ส่งงานเพื่อให้ได้รับคำแนะนำและคะแนน'}</p>
                        </div>
                      </div>
                    )}

                    {/* Feedback Text */}
                    <div className="flex-1 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`p-1.5 rounded-lg ${reviewRole === "advisor" ? "bg-blue-100 text-blue-600" : "bg-sky-100 text-sky-600"}`}>
                          <Icon name="chat" className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black text-slate-700">
                          ข้อเสนอแนะจาก{reviewRole === "advisor" ? "อาจารย์ที่ปรึกษา" : "อาจารย์ประจำวิชา"}
                        </span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 shadow-inner">
                        {reportStatus === "reviewed" ? (
                          (reviewRole === "advisor" ? feedback : instFeedback) ? (
                            <p className="text-[13px] font-medium text-slate-700 whitespace-pre-line leading-relaxed">
                              {reviewRole === "advisor" ? feedback : instFeedback}
                            </p>
                          ) : (
                            <span className="text-slate-400 italic text-[13px] flex items-center justify-center gap-1.5 opacity-70">
                              ไม่มีข้อเสนอแนะเพิ่มเติม
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 italic text-[13px] flex items-center justify-center gap-1.5 opacity-50">
                            - รอการประเมิน -
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Attached PDFs from Advisor */}
                    {reviewRole === "advisor" && (
                      <div className="mt-auto pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                            <Icon name="document" className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-black text-slate-700">ไฟล์แนบจากอาจารย์ที่ปรึกษา</span>
                        </div>
                        
                        {reportStatus === "reviewed" ? (
                          advisorPdfUrls.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {advisorPdfUrls.map((item, idx) => (
                                <a key={`adv-read-url-${idx}`} href={item.url} target="_blank" rel="noreferrer" 
                                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md hover:-translate-y-1 transition-all group" title={item.name}>
                                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                    <Icon name="document" className="w-5 h-5" />
                                  </div>
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="text-[11px] font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{item.name}</span>
                                    <span className="text-[9px] font-medium text-slate-400 mt-0.5">คลิกเพื่อเปิดดู</span>
                                  </div>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-center">
                              <span className="text-slate-400 italic text-[12px] opacity-70">ไม่มีไฟล์แนบ</span>
                            </div>
                          )
                        ) : (
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-center">
                            <span className="text-slate-400 italic text-[12px] opacity-50">- รอการประเมิน -</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </section>
      </main>

      {/* ================= MODAL: ข้อเสนอโครงงานเริ่มต้น ================= */}
      {isRequestModalOpen && originalRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsRequestModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="bg-white px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-fit uppercase tracking-wide">หัวข้อโครงงาน</div>
                  {isStudent && projectData.leader_id === authUser?.auth_id && (
                    <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md w-fit flex items-center gap-1 shadow-sm">
                      นักศึกษาหลัก 
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 leading-tight break-words whitespace-normal">{projectData.title}</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 shrink-0 mt-2 sm:mt-0">
                <button onClick={handleGoToChat} className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  สนทนา
                </button>
                {isStudent && projectData.leader_id === authUser?.auth_id && (
                  <button onClick={openEditModal} className="px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    แก้ไขข้อมูล
                  </button>
                )}
                <button onClick={() => setIsRequestModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-full transition-colors border border-slate-100">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-5 overflow-y-auto flex flex-col lg:flex-row gap-4 bg-slate-50/50 custom-scrollbar">
              
              {/* ซ้าย: ข้อมูลโปรเจกต์ */}
              <div className="flex-[3] space-y-4">
                
                {/* ผู้เกี่ยวข้อง & สถานะ */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden shrink-0">
                      {(() => {
                        const leaderUser = one(projectData.leader) || one(projectData.project_members?.find(m => m.student_id === projectData.leader_id)?.users);
                        const partnerImg = isStudent ? projectAdvisor?.profile_image : leaderUser?.profile_image;
                        const partnerName = isStudent ? (projectAdvisor?.first_name || "U") : (leaderUser?.first_name || "U");
                        return partnerImg ? <img src={partnerImg} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-lg">{partnerName.charAt(0)}</div>;
                      })()}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 mb-0.5 uppercase tracking-wider">คู่สนทนา / ผู้เกี่ยวข้อง</p>
                      <p className="text-sm font-bold text-slate-800">
                        {(() => {
                          const leaderUser = one(projectData.leader) || one(projectData.project_members?.find(m => m.student_id === projectData.leader_id)?.users);
                          const pUser = isStudent ? projectAdvisor : leaderUser;
                          return pUser ? `${pUser.first_name || ""} ${pUser.last_name || ""}`.trim() || "-" : "-";
                        })()}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                          {isStudent ? 'อาจารย์ที่ปรึกษา' : 'นักศึกษา'}
                        </span>
                        {isStudent && projectAdvisor?.major && (
                          <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            สาขา: {projectAdvisor.major}
                          </span>
                        )}
                        {!isStudent && (
                          <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            สาขา: {(one(projectData.leader) || one(projectData.project_members?.find(m => m.student_id === projectData.leader_id)?.users))?.major || 'วิศวกรรมคอมพิวเตอร์'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-4">
                    <p className="text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">สถานะคำขอ</p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>อนุมัติแล้ว
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ขอบเขตโปรเจกต์ */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-1 md:col-span-2">
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                      <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md shrink-0">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      ขอบเขตโปรเจกต์
                    </div>
                    <div className="text-[13px] text-slate-700 font-medium relative">
                      <ProjectScopeViewer scopeString={originalRequest.project_scope} />
                    </div>
                  </div>

                  {/* ภาษา / เครื่องมือที่ใช้ */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                      <div className="p-1 bg-sky-50 text-sky-600 rounded-md shrink-0">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      </div>
                      ภาษา/เครื่องมือที่ใช้
                    </div>
                    <div className="text-[13px] font-bold text-slate-800 break-words leading-relaxed">
                      {originalRequest.language_used || <span className="text-slate-400 italic font-medium">ไม่ได้ระบุ</span>}
                    </div>
                  </div>

                  {/* เอกสารอ้างอิง / ลิงก์แนบ */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                      <div className="p-1 bg-emerald-50 text-emerald-600 rounded-md shrink-0">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      เอกสารอ้างอิง / ลิงก์แนบ
                    </div>
                    <div className="text-[13px] font-bold break-all">
                      {originalRequest.diagram_url ? (
                        <a href={originalRequest.diagram_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline decoration-blue-300 underline-offset-4 transition-all">
                          {originalRequest.diagram_url}
                        </a>
                      ) : <span className="text-slate-400 font-medium italic">- ไม่มีเอกสารแนบ -</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* ขวา: สมาชิก & รายละเอียด */}
              <div className="flex-[2] space-y-4">
                
                {/* รายละเอียดเพิ่มเติม */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[120px]">
                  <div className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    รายละเอียดเพิ่มเติม
                  </div>
                  <div className="flex-1 text-[13px] text-slate-700 font-medium whitespace-pre-wrap break-words leading-relaxed overflow-y-auto custom-scrollbar">
                    {(originalRequest.message || "").replace(/\[หมายเหตุระบบ\]:[^\n]*/g, "").replace(/\[สมาชิกในกลุ่ม\]:[\s\S]*/, "").replace(/\[หมายเหตุ(.*?)\]:\s*([\s\S]*)$/, "").trim() || (
                      <div className="h-full flex items-center justify-center text-slate-400 italic bg-slate-50 rounded-xl p-4">
                        ไม่มีรายละเอียดเพิ่มเติม
                      </div>
                    )}
                  </div>
                </div>

                {/* สมาชิกในทีม */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[220px]">
                  <div className="text-xs font-bold text-slate-400 mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <svg className="w-4 h-4 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      สมาชิกในทีม
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                    {(() => {
                      const leaderMember = projectData.project_members?.find(m => m.student_id === projectData.leader_id);
                      const u = one(leaderMember?.users) || one(projectData.leader);
                      if(!u) return null;
                      return (
                        <div className="flex items-center gap-3 p-2.5 rounded-xl border border-amber-200 bg-amber-50">
                          <div className="relative">
                            {u.profile_image ? (
                              <img src={u.profile_image} className="w-10 h-10 rounded-full object-cover shadow-sm border border-white shrink-0" alt="" />
                            ) : (
                              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold shadow-sm border border-white">{u.first_name?.charAt(0)}</div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white rounded-full p-0.5 border-2 border-white shadow-sm shrink-0" title="หัวหน้าทีม">
                              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-slate-800 truncate">{u.first_name} {u.last_name}</p>
                            <p className="text-[10px] text-amber-600 font-bold bg-amber-100/50 w-fit px-1.5 py-0.5 rounded mt-0.5">หัวหน้าทีม</p>
                          </div>
                        </div>
                      );
                    })()}

                    {projectData.project_members?.filter(m => m.student_id !== projectData.leader_id).length === 0 ? (
                      <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 gap-2 h-[80px]">
                        <span className="text-[11px] font-medium">ไม่มีสมาชิกทีมเพิ่มเติม</span>
                      </div>
                    ) : (
                      projectData.project_members?.filter(m => m.student_id !== projectData.leader_id).map(m => {
                        const u = Array.isArray(m.users) ? m.users[0] : m.users;
                        if (!u) return null;
                        return (
                          <div key={m.student_id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 bg-white hover:border-blue-100 transition-colors shadow-sm">
                            {u.profile_image ? (
                              <img src={u.profile_image} className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-100 shrink-0" alt="" />
                            ) : (
                              <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold shadow-sm border border-slate-100">{u.first_name?.charAt(0)}</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-slate-700 truncate">{u.first_name} {u.last_name}</p>
                              <p className="text-[11px] text-slate-400">สมาชิก</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <EditProjectRequestModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        projectData={projectData}
        originalRequest={originalRequest}
        projectId={projectId}
        onSuccess={fetchProjectDetails}
      />

      {/* ================= MODAL: จัดการขอบเขตงาน ================= */}
      {isEditScopeModalOpen && (
        <ModalShell title="จัดการขอบเขตงาน" onClose={() => setIsEditScopeModalOpen(false)} icon={<Icon name="pencil" className="w-5 h-5" />}
          footer={<>
            <button onClick={() => setIsEditScopeModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-xs">ยกเลิก</button>
            <button onClick={handleSaveScopes} disabled={isSavingUpdates} className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm text-xs disabled:opacity-50">{isSavingUpdates ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
          </>}>
          <p className="text-[11px] text-slate-500 font-medium">ระบุรายการขอบเขตโครงงาน แบ่งตามหมวดหมู่หลักและย่อย (คะแนนจะถูกคำนวณอัตโนมัติ)</p>
          {tempScopes.map((mainScope, mIdx) => (
            <div key={mIdx} className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  <span className="text-slate-400 mr-2 font-extrabold text-[9px] uppercase tracking-widest">หมวดหมู่หลัก</span>
                  <input type="text" value={mainScope.mainTitle || ""} placeholder="เช่น ระบบจัดการผู้ใช้งาน" onChange={(e) => handleMainScopeChange(mIdx, e.target.value)} className="w-full bg-transparent text-[13px] text-slate-900 font-extrabold outline-none" />
                </div>
                <button onClick={() => handleRemoveMainScope(mIdx)} className="w-9 h-9 flex items-center justify-center text-rose-500 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-colors shadow-sm shrink-0" title="ลบขอบเขตหลัก">
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 pl-2 border-l-2 border-slate-200 ml-3">
                {mainScope.subScopes?.map((sub, sIdx) => (
                  <div key={sIdx} className="flex items-center gap-2 pl-3">
                    <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center focus-within:border-indigo-500 transition-all shadow-sm">
                      <span className="text-slate-300 mr-2 text-[10px] font-extrabold">ย่อย</span>
                      <input type="text" value={sub.title || ""} placeholder={`ขอบเขตย่อยที่ ${sIdx + 1}`} onChange={(e) => handleSubScopeChange(mIdx, sIdx, e.target.value)} className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none" />
                    </div>
                    <button onClick={() => handleRemoveSubScope(mIdx, sIdx)} className="text-slate-300 hover:text-rose-500 p-1.5 transition-colors"><Icon name="x" className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => handleAddSubScope(mIdx)} className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2 ml-3 px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg w-fit transition-colors">
                  <Icon name="plus" className="w-3 h-3" /> เพิ่มหัวข้อย่อย
                </button>
              </div>
            </div>
          ))}
          <button onClick={handleAddMainScope} className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 rounded-2xl text-slate-600 hover:text-indigo-600 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5">
            <Icon name="plus" className="w-4 h-4" /> เพิ่มหมวดหมู่ขอบเขตหลัก
          </button>
        </ModalShell>
      )}

      {/* ================= MODAL: จัดการสมาชิก / ที่ปรึกษาร่วม ================= */}
      {isMemberModalOpen && (
        <ModalShell title="จัดการสิทธิ์สมาชิก & ที่ปรึกษา" maxW="max-w-2xl" onClose={() => setIsMemberModalOpen(false)} icon={<Icon name="people" className="w-5 h-5" />}>
          <div>
            <h3 className="text-[11px] font-extrabold text-slate-500 mb-3 uppercase tracking-widest flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span> หมวดอาจารย์ที่ปรึกษา</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectAdvisor && (
                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar src={projectAdvisor.profile_image} name={projectAdvisor.first_name} size="w-10 h-10" />
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">{projectAdvisor.first_name} {projectAdvisor.last_name}</p>
                      <p className="text-[10px] font-extrabold text-indigo-600 mt-1 bg-indigo-50 px-2 py-0.5 rounded flex items-center w-fit">ที่ปรึกษาหลัก</p>
                    </div>
                  </div>
                </div>
              )}
              {coAdvisor ? (
                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar src={coAdvisor.profile_image} name={coAdvisor.first_name} size="w-10 h-10" tone="bg-sky-50 text-sky-600 border-sky-100" />
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">{coAdvisor.first_name} {coAdvisor.last_name}</p>
                      <p className="text-[10px] font-extrabold text-sky-600 mt-1 bg-sky-50 px-2 py-0.5 rounded flex items-center w-fit">ที่ปรึกษาร่วม {projectData.co_advisor_status === "pending" && <span className="text-amber-500 ml-1">(รอตอบรับ)</span>}</p>
                    </div>
                  </div>
                  {canRemoveCoAdvisor && !isProjectCompleted && (
                    <button onClick={handleRemoveCoAdvisor} className="p-2 bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shadow-sm" title={isCoAdvisor ? "ออกจากการดูแล" : "ปลดออก/ยกเลิกคำเชิญ"}><Icon name="trash" className="w-4 h-4" /></button>
                  )}
                </div>
              ) : (
                (isAdmin || isMainAdvisor || isLeader) && !isProjectCompleted && (
                  <button onClick={handleAddCoAdvisor} className="w-full h-full min-h-[60px] border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 rounded-2xl text-slate-500 hover:text-indigo-600 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5">
                    <Icon name="plus" className="w-4 h-4" /> เชิญที่ปรึกษาร่วมเพิ่ม
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-extrabold text-slate-500 mb-3 uppercase tracking-widest flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span> หมวดนักศึกษาผู้จัดทำ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {memberList.map((member, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => handleViewStudentInfo(member)}>
                  <div className="flex items-center gap-3">
                    <Avatar src={member.image} name={member.name} size="w-10 h-10" />
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[140px]">{member.name}</p>
                      {member.isLeader ? (
                        <p className="text-[10px] font-extrabold text-indigo-700 mt-1 bg-indigo-100 px-2 py-0.5 rounded flex items-center w-fit gap-1">
                          <Icon name="star" className="w-2.5 h-2.5" /> หัวหน้าทีม
                        </p>
                      ) : (
                        <p className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded flex items-center w-fit ${member.status === 'pending' ? 'text-amber-600 bg-amber-50 border border-amber-100' : 'text-slate-500 bg-slate-100'}`}>
                          สมาชิก {member.status === 'pending' && <span className="ml-1 opacity-80">(รอตอบรับ)</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  {!member.isLeader && (isAdmin || isLeader || isMainAdvisor) && !isProjectCompleted && (
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.id, member.name, member.email, member.status); }} className="p-2 bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shadow-sm" title={member.status === 'pending' ? "ยกเลิกคำเชิญ" : "นำออกจากกลุ่ม"}>
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              { !isProjectCompleted && (
                <button onClick={handleAddMember} className="w-full h-full min-h-[60px] border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 rounded-2xl text-slate-500 hover:text-indigo-600 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5">
                  <Icon name="plus" className="w-4 h-4" /> เชิญสมาชิกทีมเพิ่ม
                </button>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* ================= MODAL: เชิญสมาชิกทีมเพิ่ม ================= */}
      {isInviteMemberModalOpen && (
        <ModalShell
          title={
            <div>
              <div className="font-bold text-[17px] m-0 truncate">เชิญสมาชิกทีม</div>
              <div className="text-[13px] text-slate-500 font-bold mt-0.5">ค้นหาและเพิ่มนักศึกษาเข้าสู่โครงงานของคุณ</div>
            </div>
          }
          icon={<Icon name="search" />}
          onClose={() => {
            setIsInviteMemberModalOpen(false);
            setInviteSearchQuery("");
            setInviteSearchResults([]);
            setSelectedStudentsToInvite([]);
          }}
          maxW="max-w-xl"
        >
          <div className="flex flex-col h-[550px] max-h-[80vh]">
            {/* Search Box */}
            <div className="p-5 border-b border-slate-200 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="รหัสนักศึกษา, ชื่อ, นามสกุล หรืออีเมล"
                  value={inviteSearchQuery}
                  onChange={(e) => handleSearchStudentsForInvite(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-[14px] text-slate-700 font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 placeholder:font-medium shadow-inner"
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            </div>

            {/* Selected Students List */}
            {selectedStudentsToInvite.length > 0 && (
              <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                <div className="text-[12px] font-bold text-slate-500 mb-2">เลือกแล้ว ({selectedStudentsToInvite.length})</div>
                <div className="flex flex-wrap gap-2">
                  {selectedStudentsToInvite.map(student => (
                    <div key={student.auth_id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-[13px] font-medium border border-blue-200">
                      <span>{student.first_name} {student.last_name}</span>
                      <button onClick={() => handleRemoveStudentFromList(student)} className="w-4 h-4 flex items-center justify-center hover:bg-blue-200 rounded-full transition-colors text-blue-500 hover:text-blue-800">
                        <svg className="shrink-0" width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
              {isSearchingInvite ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-blue-600 font-bold text-[13px] tracking-wide">กำลังค้นหา...</span>
                </div>
              ) : inviteSearchQuery.trim().length >= 2 ? (
                inviteSearchResults.length > 0 ? (
                  <div className="p-2">
                    {inviteSearchResults.map((student) => (
                      <div key={student.auth_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 hover:shadow-sm mb-1 gap-3">
                        <div className="flex items-center gap-3">
                          <img src={student.profile_image || `https://ui-avatars.com/api/?name=${student.first_name}+${student.last_name}&background=eff6ff&color=3b82f6`} alt="profile" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
                          <div>
                            <div className="font-bold text-slate-800 text-[14px]">{student.prefix || ''}{student.first_name} {student.last_name}</div>
                            <div className="text-[12px] font-semibold text-slate-500 mt-0.5">{student.account_code || 'ไม่มีรหัสนักศึกษา'} • {student.email}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddStudentToList(student)}
                          className="w-full sm:w-auto px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[13px] font-bold rounded-xl transition-colors border border-blue-100 shrink-0"
                        >
                          เลือก
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-10 shrink-0">
                    <svg className="w-12 h-12 mb-2 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p className="font-bold text-[14px]">ไม่พบนักศึกษา</p>
                    <p className="text-[12px]">ลองค้นหาด้วยคำอื่น (ที่ยังไม่อยู่ในโครงงานนี้)</p>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-10 shrink-0">
                  <svg className="w-12 h-12 mb-2 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  <p className="font-bold text-[14px]">พิมพ์เพื่อเริ่มค้นหา</p>
                  <p className="text-[12px]">ค้นหาด้วยรหัสนักศึกษา ชื่อ นามสกุล หรืออีเมล</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-white shrink-0 flex justify-end gap-2 sm:gap-3 rounded-b-2xl">
              <button
                onClick={() => {
                  setIsInviteMemberModalOpen(false);
                  setInviteSearchQuery("");
                  setInviteSearchResults([]);
                  setSelectedStudentsToInvite([]);
                }}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-[13px] border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmInviteMembers}
                disabled={selectedStudentsToInvite.length === 0 || isInvitingMembers}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all text-[13px] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
              >
                {isInvitingMembers ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังส่งคำเชิญ...
                  </>
                ) : (
                  `ส่งคำเชิญ (${selectedStudentsToInvite.length})`
                )}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ================= MODAL: สร้างสัปดาห์ใหม่ ================= */}
      {isAddWeekModalOpen && (
        <ModalShell title="สร้างกำหนดการนัดหมาย" onClose={() => setIsAddWeekModalOpen(false)} icon={<Icon name="calendar" className="w-5 h-5" />}
          footer={<>
            <button onClick={() => setIsAddWeekModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-xs shadow-sm">ยกเลิก</button>
            <button onClick={handleConfirmAddWeek} disabled={isSavingUpdates} className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm text-xs disabled:opacity-50 flex items-center gap-1.5">
              {isSavingUpdates ? "กำลังสร้าง..." : <><Icon name="plus" className="w-3.5 h-3.5" /> สร้างและบันทึก</>}
            </button>
          </>}>
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
              คุณสามารถเลือกระบุเลขสัปดาห์ {!isStudent && "รายละเอียดงาน และกำหนดส่งล่วงหน้าได้เลย (หรือไม่ระบุแล้วค่อยกลับมากำหนดทีหลังก็ได้)"}
            </p>
            <div>
              <label className="text-[11px] font-extrabold text-slate-600 block mb-1.5">สัปดาห์ที่ <span className="text-rose-500">*</span></label>
              <input type="number" min="1" value={newWeekNumber} onChange={(e) => setNewWeekNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm" required />
            </div>
            {!isStudent && (
              <>
                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 block mb-1.5">สิ่งที่ต้องการให้ส่ง <span className="text-slate-400 font-medium">(ไม่บังคับ)</span></label>
                  <textarea value={newWeekTask} onChange={(e) => setNewWeekTask(e.target.value)} placeholder={"เช่น 1. บทที่ 1-2 \n2. แผนภาพ ER Diagram..."}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none min-h-[80px] shadow-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 block mb-1.5">วันที่และเวลากำหนดส่ง <span className="text-slate-400 font-medium">(ไม่บังคับ)</span></label>
                  <div className="flex gap-2">
                    <input type="date" lang="en-GB" value={newWeekDueDate ? newWeekDueDate.split('T')[0] : ""}
                      onChange={(e) => {
                        const d = e.target.value;
                        const t = newWeekDueDate && newWeekDueDate.includes('T') ? newWeekDueDate.split('T')[1] : "";
                        setNewWeekDueDate(d ? (t ? `${d}T${t}` : d) : "");
                      }}
                      className="w-1/2 bg-white border border-slate-300 text-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm" />
                    
                    <div className="relative w-1/2">
                      <input type="text" placeholder="HH:mm" maxLength="5" value={newWeekDueDate && newWeekDueDate.includes('T') ? newWeekDueDate.split('T')[1] : ""}
                        onChange={(e) => {
                          let t = e.target.value.replace(/[^0-9:]/g, '');
                          if (!t.includes(':') && t.length > 2) t = t.substring(0, 2) + ':' + t.substring(2);
                          let parts = t.split(':');
                          if (parts[0].length > 2) parts[0] = parts[0].substring(0, 2);
                          if (parts[0].length === 2 && parseInt(parts[0]) > 23) parts[0] = '23';
                          if (parts[0].length === 1 && parseInt(parts[0]) > 2 && e.nativeEvent?.inputType !== 'deleteContentBackward' && parts.length === 1) parts[0] = '0' + parts[0];
                          if (parts.length > 1 && parts[0].length === 1) parts[0] = '0' + parts[0];
                          if (parts[0].length === 2 && parts.length === 1 && e.nativeEvent?.inputType !== 'deleteContentBackward') parts.push('');
                          if (parts.length > 1) {
                            let min = parts[1];
                            if (min.length > 0 && parseInt(min[0]) > 5) min = '5' + min.substring(1);
                            if (min.length > 2) min = min.substring(0, 2);
                            t = parts[0] + ':' + min;
                          } else {
                            t = parts[0];
                          }
                          const d = newWeekDueDate ? newWeekDueDate.split('T')[0] : new Date().toISOString().split('T')[0];
                          setNewWeekDueDate(t ? `${d}T${t}` : d);
                        }}
                        disabled={!newWeekDueDate}
                        className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl pl-3 pr-8 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" />
                      <svg className="w-[14px] h-[14px] text-slate-700 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ModalShell>
      )}

      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { background-color: transparent; padding: 4px; cursor: pointer; border-radius: 6px; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { background-color: #f1f5f9; }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>
    </div>
  );
}
