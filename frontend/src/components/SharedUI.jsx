import React from "react";
import { 
  X, Plus, Trash2, Calendar, ExternalLink, FileText, FolderOpen, 
  Users, ArrowLeft, ChevronDown, TriangleAlert, Bell, LayoutGrid, 
  Search, ListChecks, Pencil, Upload, Inbox, Check, MessageCircle, 
  BellRing, Star, CircleCheck 
} from "lucide-react";

// ================= ICONS =================
const LUCIDE_ICON_MAP = {
  x: X,
  plus: Plus,
  trash: Trash2,
  calendar: Calendar,
  externalLink: ExternalLink,
  document: FileText,
  folderEmpty: FolderOpen,
  people: Users,
  backArrow: ArrowLeft,
  chevronDown: ChevronDown,
  warningTriangle: TriangleAlert,
  bell: Bell,
  grid: LayoutGrid,
  search: Search,
  scopeChecklist: ListChecks,
  pencil: Pencil,
  edit: Pencil,
  arrowsUp: Upload,
  tray: Inbox,
  check: Check,
  chat: MessageCircle,
  bellFilled: BellRing,
  star: Star,
  checkCircle: CircleCheck,
};

export const Icon = ({ name, className = "w-4 h-4 shrink-0" }) => {
  const LucideIcon = LUCIDE_ICON_MAP[name];
  if (LucideIcon) {
    // กำหนด strokeWidth ให้อิงกับขนาดหนาบางที่ต้องการ (ปกติ Lucide ใช้ 2.0 แต่บางจุด 2.5 จะดูเต็มกว่า)
    const isSmall = className.includes("w-3") || className.includes("h-3");
    return <LucideIcon className={className} strokeWidth={isSmall ? 3 : 2.5} />;
  }
  return null;
};

// ================= SMALL UI PIECES =================
export const Avatar = ({ src, name, size = "w-7 h-7", ring = "border-slate-200", tone = "bg-indigo-50 text-indigo-600 border-indigo-100" }) =>
  src ? (
    <img src={src} alt="" className={`${size} rounded-full object-cover border shadow-sm ${ring}`} />
  ) : (
    <div className={`${size} rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border shadow-sm ${tone}`}>
      {(name || "-").charAt(0).toUpperCase()}
    </div>
  );

export const getProgressColor = (score) => {
  if (score === "" || score === null || score === undefined) return "bg-slate-200";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-indigo-500";
  if (score >= 20) return "bg-amber-500";
  return "bg-rose-500";
};

export const ScoreBar = ({ label, score, thin }) => (
  <div>
    <div className="flex justify-between font-semibold text-slate-500 mb-1.5 text-[11px]">
      <span>{label}</span>
      <span className={score != null ? "text-slate-700 font-extrabold" : ""}>{score ?? "-"} / 100</span>
    </div>
    <div className={`w-full bg-slate-200 rounded-full overflow-hidden ${thin ? "h-1" : "h-1.5"}`}>
      <div className={`rounded-full ${thin ? "h-1" : "h-1.5"} ${getProgressColor(score)}`} style={{ width: `${score || 0}%` }}></div>
    </div>
  </div>
);

export const ScoreInput = ({ value, onChange, disabled, size = "md" }) => (
  <input
    type="number" min="0" max="100" placeholder="คะแนน" value={value ?? ""} disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    className={`shrink-0 text-center font-bold bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm ${
      size === "sm" ? "w-16 px-2 py-1 text-xs" : "w-16 px-2 py-1.5 text-xs"
    }`}
  />
);

export const PDF_TONE = {
  slate: { border: "border-slate-200", bg: "bg-slate-50", text: "text-rose-600 hover:text-rose-700", iconBorder: "border-slate-100" },
  indigo: { border: "border-indigo-100", bg: "bg-indigo-50", text: "text-indigo-700", iconBorder: "border-indigo-100" },
  emerald: { border: "border-emerald-100", bg: "bg-emerald-50", text: "text-emerald-700", iconBorder: "border-emerald-100" },
};

export const PdfFileRow = ({ name, url, onRemove, tone = "slate" }) => {
  const t = PDF_TONE[tone];
  // กำหนดสีไอคอนตาม tone 
  const iconColor = tone === "slate" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-indigo-600";
  
  const inner = (
    <>
      <div className={`p-1.5 bg-white rounded-lg shadow-sm border ${t.iconBorder} shrink-0 ${iconColor}`}><Icon name="document" className="w-4 h-4" /></div>
      <span className="truncate">{name}</span>
    </>
  );
  return (
    <div className={`flex items-center justify-between w-full ${t.bg} border ${t.border} rounded-xl px-3 py-2 mb-2 shadow-sm group hover:shadow-md transition-shadow`}>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-[12px] font-bold text-slate-800 group-hover:text-black truncate flex-1`} title={name}>{inner}</a>
      ) : (
        <div className={`flex items-center gap-2 text-[12px] font-bold text-slate-800 truncate flex-1`} title={name}>{inner}</div>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className={`text-slate-400 hover:text-rose-500 p-1.5 bg-white rounded-lg border ${t.border} shadow-sm transition-colors shrink-0 ml-2`} title="ลบไฟล์นี้">
          <Icon name="x" className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export const PdfUploadInput = ({ id, onSelect, label = "เพิ่มไฟล์ PDF" }) => (
  <>
    <input type="file" id={id} accept="application/pdf" multiple className="hidden" onChange={(e) => onSelect(Array.from(e.target.files))} />
    <label htmlFor={id} className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 mt-1 bg-white border border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl text-[12px] font-bold transition-all cursor-pointer shadow-sm w-full">
      <Icon name="plus" className="w-4 h-4" /> {label}
    </label>
  </>
);

export const ModalShell = ({ title, icon, onClose, children, footer, maxW = "max-w-lg" }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
    <div className={`bg-white rounded-[2rem] w-full ${maxW} shadow-2xl shadow-indigo-900/10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-white/50`} onClick={(e) => e.stopPropagation()}>
      <div className="px-6 py-5 border-b border-slate-100/80 flex justify-between items-center bg-white/50 backdrop-blur-xl shrink-0">
        <h2 className="text-[17px] font-black text-slate-800 flex items-center gap-3 tracking-tight">
          {icon && <div className="p-2 bg-indigo-50/80 rounded-xl text-indigo-600 shadow-sm border border-indigo-100/50">{icon}</div>}
          {title}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-full transition-all hover:scale-105 active:scale-95"><Icon name="x" className="w-4 h-4" /></button>
      </div>
      <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6 bg-slate-50/30">{children}</div>
      {footer && <div className="bg-white/80 backdrop-blur-xl border-t border-slate-100/80 p-5 flex gap-3 justify-end shrink-0">{footer}</div>}
    </div>
  </div>
);

export const LoadingSpinner = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FB]">
    <div className="w-12 h-12 border-4 border-blue-100 border-t-indigo-600 rounded-full animate-spin"></div>
    <div className="mt-4 text-sm font-medium text-slate-600">กำลังโหลดข้อมูล...</div>
  </div>
);
