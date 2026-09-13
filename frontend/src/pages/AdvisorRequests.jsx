// ===============================================
// src/pages/AdvisorRequests.jsx 
// ===============================================
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import SwalBase from "sweetalert2";
import Header from "../components/Header";
import { ProjectScopeViewer } from "../components/ProjectScopeViewer";
import EditProjectRequestModal from "../components/modals/EditProjectRequestModal";
import { deleteDriveFiles, deleteDriveFolders } from "../lib/storageUtils";

// ==========================================
// 1. เพิ่ม CSS Animations สำหรับ Pop-up
// ==========================================
const swalCustomStyles = `
  @keyframes bounceInSwal {
    0% { opacity: 0; transform: scale(0.6) translateY(20px); }
    50% { opacity: 1; transform: scale(1.05) translateY(-5px); }
    70% { transform: scale(0.98) translateY(2px); }
    100% { transform: scale(1) translateY(0); }
  }
  @keyframes bounceOutSwal {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.7); opacity: 0; }
  }
  .swal-bounce-in { animation: bounceInSwal 0.5s cubic-bezier(0.28, 0.84, 0.42, 1) forwards; }
  .swal-bounce-out { animation: bounceOutSwal 0.25s ease-in forwards; }
`;

const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = swalCustomStyles;
document.head.appendChild(styleSheet);

// ==========================================
// 2. ตั้งค่า SweetAlert2 Mixin
// ==========================================
const Swal = SwalBase.mixin({
  width: 'min(600px, 95%)',
  customClass: {
    container: 'backdrop-blur-sm bg-slate-900/40',
    popup: 'rounded-3xl shadow-2xl border border-slate-100 bg-white/95 backdrop-blur-md p-6 sm:p-8',
    title: 'text-2xl font-bold text-slate-800 font-kanit tracking-tight mb-1',
    htmlContainer: 'text-slate-500 font-medium font-kanit text-[15px] leading-relaxed', 
    confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2.5 font-kanit font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 outline-none focus:ring-4 focus:ring-blue-100 mx-1.5',
    cancelButton: 'bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 rounded-xl px-6 py-2.5 font-kanit font-bold transition-all outline-none mx-1.5',
    actions: 'w-full flex justify-center mt-7',
    icon: 'border-0 scale-125 mb-4'
  },
  buttonsStyling: false,
  showClass: { popup: 'swal-bounce-in' },
  hideClass: { popup: 'swal-bounce-out' }
});

// ฟังก์ชัน Helpers
const prepareModalData = (req) => {
  if (!req) return { displayMessage: "", displayMembers: [], remark: null };
  let displayMessage = req.message || "";
  let displayMembers = [];
  let remark = null;
  
  const regex = /\[สมาชิกในกลุ่ม\]:\s*([^\n\r]*)/;
  const match = displayMessage.match(regex);
  if (match) {
    const emailsString = match[1];
    const extractedEmails = emailsString.split(/[\s,]+/).filter(x => x.includes('@'));
    displayMembers = [...extractedEmails];
    displayMessage = displayMessage.replace(match[0], "").trim();
  }

  const remarkRegex = /\[หมายเหตุ(.*?)\]:\s*([\s\S]*)$/;
  const remarkMatch = displayMessage.match(remarkRegex);
  if (remarkMatch) {
    remark = {
      title: "หมายเหตุ" + remarkMatch[1],
      content: remarkMatch[2].trim()
    };
    displayMessage = displayMessage.replace(remarkMatch[0], "").trim();
  }

  displayMembers = [...new Set(displayMembers)];
  return { displayMessage, displayMembers, remark };
};

const escapeHtml = (unsafe) => {
  return (unsafe || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const extractMemberEmailsFromMessage = (message) => {
  const regex = /\[สมาชิกในกลุ่ม\]:\s*([^\n\r]*)/;
  const match = (message || "").match(regex);
  if (match) {
    return [...new Set(match[1].split(/[\s,]+/).filter(x => x.includes('@')))];
  }
  return [];
};

export default function AdvisorRequests() {
  const navigate = useNavigate();

  // --- State สำหรับ User ---
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [fullName, setFullName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [advisorStats, setAdvisorStats] = useState({ current: 0, max: 0 }); 

  // --- State สำหรับข้อมูล ---
  const [requests, setRequests] = useState([]);
  const [currentUserMemberships, setCurrentUserMemberships] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberDetails, setMemberDetails] = useState([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  
  // State สำหรับเก็บรายชื่อว่าใครได้โควตาหลักบ้าง
  const [mainProjectIds, setMainProjectIds] = useState([]); 

  // --- State สำหรับแก้ไขข้อมูลนักศึกษา ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // --- State สำหรับ Features ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);

  // ----------------------------------------------
  // 1. Authentication & User Loading
  // ----------------------------------------------
  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      navigate("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("email", authUser.email)
      .maybeSingle();

    if (!profile) {
      navigate("/login");
      return;
    }

    setUser(profile);
    setRole(profile.role);
    setFullName(`${profile.first_name} ${profile.last_name}`);
    setProfileImage(profile.profile_image || "");

    if (profile.role?.toUpperCase() === "ADVISOR") {
      fetchAdvisorQuota(profile.auth_id);
    }

    await loadRequests(profile);
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAdvisorQuota = async (userId) => {
    try {
      const { data: profile } = await supabase.from("advisor_profiles").select("max_groups").eq("user_id", userId).single();
      const { count } = await supabase.from("projects").select("*", { count: 'exact', head: true }).eq("advisor_id", userId).not("status", "in", '("cancelled","completed")');
      setAdvisorStats({ current: count || 0, max: profile?.max_groups ?? 5 });
    } catch (err) {
      console.error("Error fetching quota:", err);
    }
  };

  // ----------------------------------------------
  // 2. Load Requests Data (Merge Requests + Co-Advisor Projects)
  // ----------------------------------------------
  const loadRequests = useCallback(async (profile) => {
    try {
      const safeAuthId = profile.auth_id || '00000000-0000-0000-0000-000000000000';

      const { data: requestsData, error: reqError } = await supabase
        .from("requests")
        .select(`
          request_id, project_title, message, project_scope, language_used, diagram_url, status, created_at, student_id, advisor_id,
          student:users!requests_student_id_fkey (
            auth_id, first_name, last_name, profile_image, role, email, faculty, major, advisor_type,
            student_profiles!student_profiles_user_id_fkey (student_status)
          ),
          advisor:users!requests_advisor_id_fkey (
            auth_id, first_name, last_name, profile_image, role, email, expertise, advisor_type,
            advisor_profiles (is_accepting_students, max_groups)
          )
        `)
        .or(`student_id.eq.${safeAuthId},advisor_id.eq.${safeAuthId},message.ilike.%${profile.email}%`);

      if (reqError) throw reqError;

      // 🌟 ดึงข้อมูลที่ปรึกษาร่วม โดยเพิ่ม advisor_id ให้มองเห็นคำขอที่ตัวเองเป็นคนชวนได้ด้วย
      const { data: coAdvData, error: coAdvError } = await supabase
        .from("projects")
        .select(`
          project_id, title, description, status, created_at, leader_id, advisor_id, co_advisor_id, co_advisor_status, scopes,
          student:users!projects_leader_id_fkey (
            auth_id, first_name, last_name, profile_image, role, email, faculty, major, advisor_type
          ),
          main_advisor:users!projects_advisor_id_fkey (
            auth_id, first_name, last_name, profile_image, role, email, expertise, advisor_type
          ),
          co_advisor:users!projects_co_advisor_id_fkey (
            auth_id, first_name, last_name, profile_image, role, email, expertise, advisor_type
          )
        `)
        .not('co_advisor_id', 'is', null)
        .or(`co_advisor_id.eq.${safeAuthId},leader_id.eq.${safeAuthId},advisor_id.eq.${safeAuthId}`);

      if (coAdvError) throw coAdvError;

      const mappedCoRequests = (coAdvData || []).map(p => {
        let reqStatus = 'co_advisor_pending';
        if (p.co_advisor_status?.toLowerCase() === 'accepted') reqStatus = 'co_advisor_accepted';
        if (p.co_advisor_status?.toLowerCase() === 'rejected') reqStatus = 'rejected';
        
        // 🌟 กำหนดผู้ส่งคำร้อง (Sender) ให้ตรงกับคนที่กำลังเปิดดูอยู่ (เพื่อให้เตะ/ยกเลิกคำขอตัวเองได้ถูกต้อง)
        let senderId = p.leader_id;
        let senderProfile = p.student;
        
        // ถ้าอาจารย์ที่ปรึกษาหลักเป็นคนเปิดดู ให้แสดงในฐานะคนส่งคำเชิญ
        if (safeAuthId === p.advisor_id) {
          senderId = p.advisor_id;
          senderProfile = p.main_advisor;
        }
        
        return {
          request_id: p.project_id,
          is_co_advisor_request: true,
          project_title: `[ที่ปรึกษาร่วม] ${p.title}`,
          message: p.description || "ขอเชิญเป็นที่ปรึกษาร่วมในโครงงานนี้",
          project_scope: typeof p.scopes === 'string' ? p.scopes : JSON.stringify(p.scopes || []),
          language_used: "อ้างอิงจากโครงงานหลัก",
          diagram_url: "",
          status: reqStatus,
          created_at: p.created_at,
          student_id: senderId, 
          advisor_id: p.co_advisor_id,
          student: senderProfile,
          advisor: p.co_advisor
        };
      });

      const combinedData = [...(requestsData || []), ...mappedCoRequests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      if (combinedData.length > 0) {
        const advIds = [...new Set(combinedData.filter(r => r.status?.toLowerCase() === 'accepted').map(r => r.advisor_id))];
        if (advIds.length > 0) {
          const { data: projectsData } = await supabase
            .from("projects")
            .select("advisor_id, leader_id")
            .in("advisor_id", advIds)
            .neq("status", "cancelled")
            .order("created_at", { ascending: true });

          if (projectsData) {
            const mainIds = [];
            advIds.forEach(advId => {
              const advProjects = projectsData.filter(p => p.advisor_id === advId);
              if (advProjects.length > 0) {
                mainIds.push(advProjects[0].leader_id); 
              }
            });
            setMainProjectIds(mainIds);
          }
        }
      }

      // Fetch current user memberships to accurately display member status & direct invites
      const { data: myPmData, error: myPmError } = await supabase
        .from('project_members')
        .select(`
          id, project_id, status, joined_at,
          projects (
            project_id, title, description, leader_id, advisor_id, status, created_at, scopes,
            student:users!projects_leader_id_fkey (auth_id, first_name, last_name, profile_image, role, email),
            advisor:users!projects_advisor_id_fkey (auth_id, first_name, last_name, profile_image, role, email, expertise, advisor_type)
          )
        `)
        .eq('student_id', safeAuthId);

      if (myPmError) {
        console.error("Error fetching myPmData:", myPmError);
      }
      setCurrentUserMemberships(myPmData || []);

      const mappedMemberInvites = (myPmData || [])
        .filter(pm => pm.projects && pm.projects.status !== 'cancelled')
        .map(pm => {
          const pmStat = pm.status?.toLowerCase();
          let reqStat = 'invited';
          if (pmStat === 'approved') reqStat = 'approved';
          else if (pmStat === 'left') reqStat = 'left';
          else if (pmStat === 'kicked') reqStat = 'kicked';
          else if (pmStat === 'rejected') reqStat = 'rejected';

          return {
            request_id: pm.projects.project_id || pm.id,
            pm_id: pm.id,
            is_member_request: true,
            project_title: pm.projects.title,
            message: pm.projects.description || `คุณได้รับคำเชิญให้เข้าร่วมกลุ่มโครงงาน "${pm.projects.title}"`,
            project_scope: typeof pm.projects.scopes === 'string' ? pm.projects.scopes : JSON.stringify(pm.projects.scopes || []),
            language_used: "-",
            diagram_url: "",
            status: reqStat,
            created_at: pm.joined_at || pm.projects.created_at || new Date().toISOString(),
            student_id: pm.projects.leader_id,
            advisor_id: pm.projects.advisor_id,
            student: pm.projects.student,
            advisor: pm.projects.advisor
          };
        });

      const hiddenKey = `hidden_requests_${safeAuthId}`;
      let hiddenIds = [];
      try {
        hiddenIds = JSON.parse(localStorage.getItem(hiddenKey) || "[]");
      } catch (e) {
        hiddenIds = [];
      }

      // Combine member invites with combinedData; member invites come first
      const allCombined = [...mappedMemberInvites, ...combinedData];

      const finalRequests = allCombined
        .filter(r => {
          const s = r.status?.toLowerCase();
          const isLive = ['invited', 'pending', 'co_advisor_pending', 'approved', 'accepted', 'co_advisor_accepted'].includes(s);
          if (isLive) return true;
          return !hiddenIds.includes(String(r.request_id));
        })
        .sort((a, b) => {
          if (a.status === 'invited' && b.status !== 'invited') return -1;
          if (b.status === 'invited' && a.status !== 'invited') return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });
      
      // Deduplicate to show only the latest status for a given project (title + leader)
      const uniqueRequests = [];
      const seenKeys = new Set();
      
      for (const req of finalRequests) {
        const key = `${req.project_title}-${req.student_id}`;
        if (!seenKeys.has(key)) {
          uniqueRequests.push(req);
          seenKeys.add(key);
        }
      }

      setRequests(uniqueRequests);
    } catch (error) {
      console.error("Supabase Error:", error);
      Swal.fire({ title: "โหลดข้อมูลผิดพลาด", text: `สาเหตุ: ${error.message || "ไม่ทราบสาเหตุ"}`, icon: "error" });
    }
  }, []);

  // ----------------------------------------------
  // 2.5 Real-time Subscription
  // ----------------------------------------------
  useEffect(() => {
    if (!user) return;
    let timeoutId;

    const requestSubscription = supabase
      .channel(`realtime:requests-${user.auth_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, (payload) => {
          const isRelated = payload.new?.student_id === user.auth_id || 
                            payload.new?.advisor_id === user.auth_id ||
                            payload.old?.student_id === user.auth_id || 
                            payload.old?.advisor_id === user.auth_id ||
                            (user.email && (
                              (payload.new?.message && payload.new.message.includes(user.email)) ||
                              (payload.old?.message && payload.old.message.includes(user.email))
                            ));
          if (isRelated) {
            clearTimeout(timeoutId); 
            timeoutId = setTimeout(() => { loadRequests(user); if (role?.toUpperCase() === "ADVISOR") fetchAdvisorQuota(user.auth_id); }, 600);
          }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
          const isRelated = payload.new?.leader_id === user.auth_id || 
                            payload.new?.advisor_id === user.auth_id || 
                            payload.new?.co_advisor_id === user.auth_id ||
                            payload.old?.leader_id === user.auth_id || 
                            payload.old?.advisor_id === user.auth_id || 
                            payload.old?.co_advisor_id === user.auth_id;
          if (isRelated) {
            clearTimeout(timeoutId); 
            timeoutId = setTimeout(() => { loadRequests(user); if (role?.toUpperCase() === "ADVISOR") fetchAdvisorQuota(user.auth_id); }, 600);
          }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, (payload) => {
          const isRelated = payload.new?.student_id === user.auth_id || payload.old?.student_id === user.auth_id;
          if (isRelated) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => { loadRequests(user); }, 600);
          }
      })
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(requestSubscription);
    };
  }, [user, role, loadRequests]);

  // ----------------------------------------------
  // 3. Status Helpers & Roles
  // ----------------------------------------------
  const isReceiver = useCallback((req) => req?.advisor_id === user?.auth_id, [user]);
  const isLeader = useCallback((req) => req?.student_id === user?.auth_id, [user]);
  const isInvitedMember = useCallback((req) => !isReceiver(req) && !isLeader(req), [isReceiver, isLeader]);

  const getDisplayStatus = useCallback((r) => {
    if (!r) return "";
    const rawStatus = r.status?.toLowerCase();
    if (rawStatus === 'invited') return 'invited';
    if (rawStatus === 'approved') return 'approved';

    // 🌟 กรณีเป็นสมาชิกที่ถูกเชิญ (ไม่ใช่หัวหน้ากลุ่ม และไม่ใช่อาจารย์ผู้รับคำขอ)
    if (isInvitedMember(r)) {
      // 1. ตรวจสอบสถานะจริงจากตาราง project_members ล่าสุดก่อน
      const pm = currentUserMemberships.find((m) => {
        const proj = m.projects;
        if (!proj) return false;
        if (r.is_co_advisor_request) return m.project_id === r.request_id;
        if (r.is_member_request) return m.project_id === r.request_id || m.id === r.pm_id;
        return (proj.project_id && proj.project_id === r.request_id) || (proj.leader_id === r.student_id && proj.advisor_id === r.advisor_id);
      });

      if (pm) {
        const pmStat = pm.status?.toLowerCase();
        // 🌟 ถ้าสถานะใน project_members เป็น pending แสดงว่ามีคำเชิญใหม่ส่งมาให้เข้ากลุ่ม
        if (pmStat === "pending") return "invited";
        if (pmStat === "approved") return "approved";
        if (pmStat === "left") return "left";
        if (pmStat === "kicked") return "kicked";
        if (pmStat === "rejected") return "rejected";
        return r.status;
      }

      // 2. ถ้าไม่มีใน project_members ตรวจสอบจากหมายเหตุประวัติในข้อความ
      const userEmail = user?.email?.toLowerCase();
      const msg = (r.message || "").toLowerCase();

      const hasLeftNote = userEmail && (
        msg.includes(`${userEmail}) ได้ออกจากโครงงานด้วยตนเอง`) ||
        msg.includes(`ได้ออกจากโครงงานด้วยตนเอง`) ||
        (user?.first_name && msg.includes(user.first_name.toLowerCase()) && msg.includes(`ได้ออกจากโครงงาน`))
      );
      const hasKickedNote = userEmail && (
        msg.includes(`นำนักศึกษา`) && msg.includes(userEmail)
      );

      if (hasLeftNote) return "left";
      if (hasKickedNote) return "kicked";

      // หากคำขออนุมัติแล้ว แต่ไม่มีชื่อผู้ใช้ใน project_members แสดงว่าออกจากกลุ่มแล้ว
      if (rawStatus === "accepted" || rawStatus === "co_advisor_accepted") {
        return "left";
      }
    }

    return r.status;
  }, [currentUserMemberships, isInvitedMember, user]);

  const getQuotaBadge = useCallback((request) => {
    if (!request) return null;
    const currentStatus = getDisplayStatus(request)?.toLowerCase();
    if (currentStatus !== 'accepted' && currentStatus !== 'co_advisor_accepted') return null;
    
    // ถ้าเป็นสมาชิกที่ถูกเชิญ ไม่แสดง badge นักศึกษาหลัก
    if (isInvitedMember(request)) return null;

    const isMain = mainProjectIds.includes(request.student_id);
    
    if (isMain) {
      return (
        <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md mt-1.5 w-fit flex items-center gap-1 shadow-sm">
          นักศึกษาหลัก 
        </div>
      );
    } else {
      return (
        <div className="text-[11px] font-bold text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md mt-1.5 w-fit flex items-center gap-1 shadow-sm">
          โควตาสำรอง 
        </div>
      );
    }
  }, [getDisplayStatus, isInvitedMember, mainProjectIds]);

  // ----------------------------------------------
  // 4. Logic: Filter & Pagination
  // ----------------------------------------------
  const filteredRequests = useMemo(() => {
    if (filterStatus === "all") return requests;
    if (filterStatus === "pending") return requests.filter(req => ['pending', 'co_advisor_pending', 'invited'].includes(getDisplayStatus(req)?.toLowerCase()));
    if (filterStatus === "accepted") return requests.filter(req => ['accepted', 'co_advisor_accepted', 'approved'].includes(getDisplayStatus(req)?.toLowerCase()));
    if (filterStatus === "cancelled") return requests.filter(req => ['cancelled', 'kicked', 'left'].includes(getDisplayStatus(req)?.toLowerCase()));
    return requests.filter((req) => getDisplayStatus(req)?.toLowerCase() === filterStatus);
  }, [requests, filterStatus, getDisplayStatus]);

  const { currentItems, totalPages } = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return { 
      currentItems: filteredRequests.slice(indexOfFirstItem, indexOfLastItem), 
      totalPages: Math.ceil(filteredRequests.length / itemsPerPage) 
    };
  }, [filteredRequests, currentPage, itemsPerPage]);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleFilterChange = (e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const handleSelectAll = (e) => {
    const allowedItems = currentItems.filter(r => !['pending', 'co_advisor_pending', 'accepted', 'co_advisor_accepted', 'invited', 'approved'].includes(getDisplayStatus(r)?.toLowerCase()) && !r.is_co_advisor_request);
    
    if (e.target.checked) {
      const idsToAdd = allowedItems.map(item => item.request_id);
      setSelectedIds(prev => [...new Set([...prev, ...idsToAdd])]);
    } else {
      const idsToRemove = allowedItems.map(item => item.request_id);
      setSelectedIds(prev => prev.filter(id => !idsToRemove.includes(id)));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    const selectedItems = currentItems.filter(r => selectedIds.includes(r.request_id));
    
    const protectedReqs = selectedItems.filter(r => 
      ['pending', 'co_advisor_pending', 'accepted', 'co_advisor_accepted', 'invited', 'approved'].includes(getDisplayStatus(r)?.toLowerCase())
    );

    if (protectedReqs.length > 0) {
      Swal.fire("ไม่สามารถลบได้", "สถานะ 'รอพิจารณา' และ 'อนุมัติแล้ว/ได้เข้ากลุ่มแล้ว' ไม่สามารถลบออกจากประวัติได้", "warning");
      return;
    }

    const selectedCoReqs = selectedItems.filter(r => r.is_co_advisor_request);
    if (selectedCoReqs.length > 0) {
      Swal.fire("ไม่สามารถลบได้", "รายการคำเชิญที่ปรึกษาร่วมไม่สามารถลบจากประวัติได้ กรุณายกเลิกสถานะแทน", "warning");
      return;
    }

    const result = await Swal.fire({
      title: `ลบ ${selectedIds.length} รายการ?`,
      text: "คุณต้องการลบรายการที่เลือกใช่หรือไม่ ข้อมูลจะหายไปอย่างถาวร",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "ยืนยันลบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) return;

    try {
      const hiddenKey = `hidden_requests_${user.auth_id}`;
      let currentHidden = [];
      try {
        currentHidden = JSON.parse(localStorage.getItem(hiddenKey) || "[]");
      } catch (e) {
        currentHidden = [];
      }
      const newHidden = [...currentHidden];

      for (const item of selectedItems) {
        // Record in hidden list
        newHidden.push(String(item.request_id));

        if (item.student_id === user.auth_id) {
          // If current user is leader / owner of the request
          await supabase.from("requests").delete().eq("request_id", item.request_id);
        } else if (isInvitedMember(item)) {
          // If current user is an invited member
          // 1. Delete matching row from project_members if exists
          try {
            const relatedPm = currentUserMemberships.find(m => {
              const proj = m.projects;
              if (!proj) return false;
              if (item.is_co_advisor_request) return m.project_id === item.request_id;
              return proj.project_id === item.request_id || (proj.leader_id === item.student_id && proj.advisor_id === item.advisor_id);
            });
            if (relatedPm?.id) {
              await supabase.from("project_members").delete().eq("id", relatedPm.id);
            } else if (user?.auth_id) {
              await supabase.from("project_members").delete().eq("student_id", user.auth_id);
            }
          } catch (e) {
            console.error("Error deleting from project_members:", e);
          }

          // 2. Attempt to clean message if permissions allow
          if (user.email && item.message) {
            try {
              const emailRegex = new RegExp(user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
              const cleanMessage = (item.message || "").replace(emailRegex, "[removed]");
              await supabase.from("requests").update({ message: cleanMessage }).eq("request_id", item.request_id);
            } catch (e) {
              console.error("Error updating requests message:", e);
            }
          }
        }
      }

      localStorage.setItem(hiddenKey, JSON.stringify([...new Set(newHidden)]));
      Swal.fire({ title: "สำเร็จ", text: "ลบข้อมูลเรียบร้อยแล้ว", icon: "success" });
      setSelectedIds([]);
      await loadRequests(user);
    } catch (error) {
      console.error(error);
      Swal.fire({ title: "เกิดข้อผิดพลาด", text: "ไม่สามารถลบข้อมูลได้", icon: "error" });
    }
  };

  // ----------------------------------------------
  // 5. Logic แยกข้อมูล & ดึงชื่อสมาชิก
  // ----------------------------------------------
  const { displayMessage, displayMembers, remark } = useMemo(() => {
    return selected ? prepareModalData(selected) : { displayMessage: "", displayMembers: [], remark: null };
  }, [selected]);

  useEffect(() => {
    const fetchMemberDetails = async () => {
      if (!selected || displayMembers.length === 0) {
        setMemberDetails([]);
        setIsFetchingMembers(false);
        return;
      }
      setIsFetchingMembers(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select(`
            auth_id,
            email, 
            first_name, 
            last_name, 
            profile_image, 
            advisor_type, 
            student_profiles!student_profiles_user_id_fkey (student_status, current_advisor_id)
          `)
          .in('email', displayMembers);
          
        if (error) throw error;
        
        const usersData = data || [];
        const authIds = usersData.map(u => u.auth_id);
        
        if (authIds.length > 0) {
          const { data: pmData, error: pmError } = await supabase
            .from('project_members')
            .select('id, student_id, project_id, status, projects(project_id, leader_id, advisor_id, status)')
            .in('student_id', authIds);
            
          if (!pmError && pmData) {
            usersData.forEach(u => {
              u.project_members = pmData.filter(pm => pm.student_id === u.auth_id);
            });
          }
        }

        setMemberDetails(usersData);
      } catch (err) {
        console.error("Error fetching member details:", err);
      } finally {
        setIsFetchingMembers(false);
      }
    };
    fetchMemberDetails();
  }, [selected, displayMembers]);

  // ----------------------------------------------
  // Helper functions
  // ----------------------------------------------
  useEffect(() => {
    if (selected) {
      const updated = requests.find(r => r.request_id === selected.request_id && r.is_co_advisor_request === selected.is_co_advisor_request);
      if (updated) {
        setSelected(updated);
      }
    }
  }, [requests]);

  const getPartnerInfo = useCallback((req) => {
    if (req.advisor_id === user?.auth_id) return req.student; 
    if (req.student_id === user?.auth_id) return req.advisor; 
    return req.advisor; 
  }, [user]);

  const formatRole = (roleText, advisorType) => {
    if (!roleText) return 'ไม่ระบุ';
    const r = roleText.toUpperCase();
    if (r === 'ADVISOR') return advisorType ? `อาจารย์ที่ปรึกษา (${advisorType})` : 'อาจารย์ที่ปรึกษา';
    if (r === 'STUDENT') return 'นักศึกษา';
    if (r === 'ADMIN') return 'ผู้ดูแลระบบ';
    return roleText;
  };

  // ----------------------------------------------
  // 6. Actions (Approve, Reject, Cancel, Revoke, Edit)
  // ----------------------------------------------

  const openEditModal = (request) => {
    setSelected(request);
    setIsEditModalOpen(true);
  };
  const handleEditChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditMemberChange = (index, value) => {
    const newMembers = [...editFormData.members];
    newMembers[index] = value;
    setEditFormData(prev => ({ ...prev, members: newMembers }));
  };

  const updateStatus = async (request, newStatus) => {
    const isApproving = newStatus === "ACCEPTED" || newStatus.toLowerCase() === 'co_advisor_accepted';
    const actionText = isApproving ? "อนุมัติ" : "ปฏิเสธ";
    const actionColor = isApproving ? "#2563eb" : "#dc2626";

    const confirmResult = await Swal.fire({
      title: `ยืนยันการ${actionText}?`,
      text: `คุณแน่ใจหรือไม่ที่จะ${actionText}คำร้องนี้`,
      icon: "question",
      showCancelButton: true, 
      reverseButtons: true,
      confirmButtonColor: actionColor,
      confirmButtonText: `ยืนยันการ${actionText}`,
      cancelButtonText: "ปิด",
    });

    if (!confirmResult.isConfirmed) return;

    Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
      let isQuotaExceeded = false;
      let finalMaxGroups = 0;
      let finalCurrentCount = 0;

      if (request.is_co_advisor_request) {
        const { error } = await supabase.from("projects").update({
          co_advisor_status: newStatus.toLowerCase() === 'co_advisor_accepted' ? 'accepted' : 'rejected'
        }).eq("project_id", request.request_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("requests").update({
          status: newStatus
        }).eq("request_id", request.request_id);
        if (error) throw error;

        if (newStatus === "ACCEPTED") {
          // Check if advisor has quota
          const { data: advProfile } = await supabase.from("advisor_profiles").select("max_groups").eq("user_id", request.advisor_id).single();
          const { count: currentActiveCount } = await supabase.from("projects").select("*", { count: 'exact', head: true }).eq("advisor_id", request.advisor_id).not("status", "in", '("cancelled","completed")');
          
          const maxGroups = advProfile?.max_groups || 0;
          finalMaxGroups = maxGroups;
          finalCurrentCount = currentActiveCount + 1;
          
          if (maxGroups > 0 && currentActiveCount >= maxGroups) {
             isQuotaExceeded = true;
          }

          // Create project
          const randomCode = `P-${Math.floor(100000 + Math.random() * 900000)}`;
          const { data: newProject, error: projError } = await supabase.from("projects").insert({
            title: request.project_title,
            description: request.message,
            scopes: request.project_scope,
            leader_id: request.student_id,
            advisor_id: request.advisor_id,
            status: "in_progress",
            project_code: randomCode
          }).select().single();
          
          if (projError) throw projError;

          // update request with project_id
          await supabase.from("requests").update({
            project_id: newProject.project_id
          }).eq("request_id", request.request_id);

          // add leader as project member
          await supabase.from("project_members").insert({
            project_id: newProject.project_id,
            student_id: request.student_id,
            role: 'leader',
            status: 'approved'
          });

          // add other members from message (auto-approved)
          const memberEmails = extractMemberEmailsFromMessage(request.message);
          if (memberEmails && memberEmails.length > 0) {
            const { data: usersData } = await supabase.from('users').select('auth_id, email').in('email', memberEmails);
            if (usersData && usersData.length > 0) {
              const membersToInsert = usersData.map(u => ({
                project_id: newProject.project_id,
                student_id: u.auth_id,
                role: 'member',
                status: 'approved'
              }));
              await supabase.from("project_members").insert(membersToInsert);

              const memberAuthIds = usersData.map(u => u.auth_id);
              await supabase.from("student_profiles").update({ 
                student_status: "MEMBER", 
                current_advisor_id: request.advisor_id 
              }).in("user_id", memberAuthIds);
            }
          }

          // update leader profile
          await supabase.from("student_profiles").update({ 
            student_status: "MEMBER", 
            current_advisor_id: request.advisor_id 
          }).eq("user_id", request.student_id);

          // update advisor's current_groups count
          const isAccepting = (currentActiveCount + 1) < maxGroups;
          await supabase.from("advisor_profiles").update({ 
            current_groups: currentActiveCount + 1, 
            is_accepting_students: maxGroups > 0 ? isAccepting : false 
          }).eq("user_id", request.advisor_id);
        }
      }

      await loadUser();
      setSelected(null);
      if (isQuotaExceeded) {
        await Swal.fire({
          title: "อนุมัติสำเร็จ (โควตาเต็มแล้ว)",
          text: `อัปเดตสถานะเรียบร้อย โครงงานถูกสร้างสำเร็จ\nแต่ปัจจุบันคุณรับกลุ่มเกินโควตาที่ตั้งไว้ (${finalCurrentCount}/${finalMaxGroups})`,
          icon: "warning",
          confirmButtonText: "ตกลง"
        });
      } else {
        await Swal.fire("สำเร็จ", "อัปเดตสถานะเรียบร้อยแล้ว", "success");
      }
      
      if (newStatus === "ACCEPTED" || newStatus.toLowerCase() === 'co_advisor_accepted') {
        navigate("/advisorsearch");
      }
    } catch (error) {
      console.error(error);
      Swal.fire("เกิดข้อผิดพลาด", error.message, "error");
    }
  };

  const cancelRequest = async (request) => {
    const result = await Swal.fire({
      title: "ยกเลิกคำร้อง?",
      text: "คุณต้องการยกเลิกคำร้องนี้ใช่หรือไม่",
      icon: "warning",
      showCancelButton: true, reverseButtons: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "ยืนยันยกเลิก",
      cancelButtonText: "ปิด"
    });
    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังยกเลิก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
      if (request.is_co_advisor_request) {
         await supabase.from("projects").update({ co_advisor_id: null, co_advisor_status: null }).eq("project_id", request.request_id);
      } else {
         await supabase.from("requests").update({ status: "CANCELLED" }).eq("request_id", request.request_id);
      }
      setSelected(null);
      await loadUser();
      Swal.fire("สำเร็จ", "ยกเลิกคำร้องเรียบร้อยแล้ว", "success");
    } catch (error) {
      Swal.fire("เกิดข้อผิดพลาด", error.message, "error");
    }
  };

  const revokeProject = async (request) => {
    const isByAdvisor = isReceiver(request);
    const actor = isByAdvisor ? "อาจารย์" : "นักศึกษา";

    if (request.is_co_advisor_request) {
      const result = await Swal.fire({
        title: "ยกเลิกที่ปรึกษาร่วม",
        text: "ยืนยันการยกเลิกสถานะที่ปรึกษาร่วมจากโครงงานนี้ใช่หรือไม่?",
        icon: "warning",
        showCancelButton: true, reverseButtons: true,
        confirmButtonColor: "#dc2626",
        confirmButtonText: "ยืนยันการยกเลิก",
        cancelButtonText: "ปิด"
      });
      if (!result.isConfirmed) return;
      
      Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
      try {
        const { error } = await supabase.from("projects").update({
          co_advisor_id: null,
          co_advisor_status: null
        }).eq("project_id", request.request_id);
        if (error) throw error;
        
        setSelected(null);
        await Swal.fire("เรียบร้อย", "ยกเลิกสถานะที่ปรึกษาร่วมเรียบร้อยแล้ว", "success");
        await loadUser();
      } catch (err) {
        Swal.fire("เกิดข้อผิดพลาด", err.message, "error");
      }
      return;
    }

    const result = await Swal.fire({
      title: isByAdvisor ? "ลบโครงงาน (เตะนักศึกษาออก)" : "ยกเลิก/ออกจากโครงงาน",
      text: "การดำเนินการนี้จะลบข้อมูลโครงงาน ห้องสนทนา และรายงานอย่างถาวร โปรดระบุเหตุผลเพื่อให้อีกฝ่ายรับทราบ",
      input: 'textarea',
      inputPlaceholder: 'ระบุเหตุผลการยกเลิกที่นี่...',
      icon: "warning",
      showCancelButton: true, reverseButtons: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "ยืนยันลบโครงงานถาวร",
      cancelButtonText: "ปิด",
      inputValidator: (value) => {
        if (!value || value.trim() === "") return 'กรุณาระบุหมายเหตุเพื่อให้อีกฝ่ายรับทราบ';
      }
    });
    if (!result.isConfirmed) return;
    const revokeReason = result.value.trim();

    Swal.fire({ title: 'กำลังลบข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      let finalMessage = request.message || "";
      if (revokeReason) finalMessage += `\n\n[หมายเหตุยกเลิกโครงงานจาก${actor}]: ${revokeReason}`;

      const newStatus = isByAdvisor ? "KICKED" : "LEFT";
      await supabase.from("requests").update({ status: newStatus, message: finalMessage }).eq("request_id", request.request_id);

      const { data: projectToCancel } = await supabase
        .from("projects")
        .select("project_id")
        .eq("advisor_id", request.advisor_id)
        .eq("leader_id", request.student_id)
        .eq("title", request.project_title)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let memberIdsToReset = [request.student_id];

      if (projectToCancel) {
        // 🧹 ลบไฟล์ทั้งหมดใน Google Drive (PDF รายงาน & ไฟล์ในแชท) ก่อนลบจากฐานข้อมูล
        try {
          const [{ data: rReports }, { data: rMessages }] = await Promise.all([
            supabase.from("project_reports").select("pdf_url, advisor_pdf_url").eq("project_id", projectToCancel.project_id),
            supabase.from("project_messages").select("file_url").eq("project_id", projectToCancel.project_id).not("file_url", "is", null)
          ]);
          const driveUrlsToDelete = [];
          rReports?.forEach(r => {
            if (r.pdf_url) {
              try {
                const parsed = JSON.parse(r.pdf_url);
                if (Array.isArray(parsed)) parsed.forEach(p => p.url && driveUrlsToDelete.push(p.url));
                else if (typeof parsed === 'string') driveUrlsToDelete.push(parsed);
              } catch (e) { driveUrlsToDelete.push(r.pdf_url); }
            }
            if (r.advisor_pdf_url) {
              try {
                const parsed = JSON.parse(r.advisor_pdf_url);
                if (Array.isArray(parsed)) parsed.forEach(p => p.url && driveUrlsToDelete.push(p.url));
                else if (typeof parsed === 'string') driveUrlsToDelete.push(parsed);
              } catch (e) { driveUrlsToDelete.push(r.advisor_pdf_url); }
            }
          });
          rMessages?.forEach(m => {
            if (m.file_url) driveUrlsToDelete.push(m.file_url);
          });
          if (driveUrlsToDelete.length > 0) {
            await deleteDriveFiles(driveUrlsToDelete);
          }

          // ลบโฟลเดอร์โครงงานและห้องแชทใน Google Drive
          const foldersToDelete = [
            `Project - ${projectToCancel.title || projectToCancel.project_id}`,
            `Chat - ${projectToCancel.title || projectToCancel.project_id}`,
            projectToCancel.project_code ? `Chat - ${projectToCancel.project_code}` : null,
            projectToCancel.project_code ? `Chat - Project 1 ${projectToCancel.project_code}` : null
          ].filter(Boolean);
          await deleteDriveFolders(foldersToDelete);
        } catch (err) {
          console.error("Error deleting Drive files/folders in revokeProject:", err);
        }

        await supabase.from("projects").update({ status: "cancelled" }).eq("project_id", projectToCancel.project_id);

        const { data: members } = await supabase.from("project_members").select("student_id").eq("project_id", projectToCancel.project_id);
        if (members) {
          members.forEach(m => {
            if (!memberIdsToReset.includes(m.student_id)) memberIdsToReset.push(m.student_id);
          });
        }

        await supabase.from("project_messages").delete().eq("project_id", projectToCancel.project_id);
        await supabase.from("project_reports").delete().eq("project_id", projectToCancel.project_id);
        await supabase.from("project_members").delete().eq("project_id", projectToCancel.project_id);
        await supabase.from("projects").delete().eq("project_id", projectToCancel.project_id);

        const { count: currentActiveCount } = await supabase.from("projects").select("*", { count: 'exact', head: true }).eq("advisor_id", request.advisor_id).not("status", "in", '("cancelled","completed")');
        const { data: advProfile } = await supabase.from("advisor_profiles").select("max_groups").eq("user_id", request.advisor_id).single();

        if (advProfile) {
          const isAccepting = currentActiveCount < advProfile.max_groups;
          await supabase.from("advisor_profiles").update({ 
            current_groups: currentActiveCount, 
            is_accepting_students: isAccepting 
          }).eq("user_id", request.advisor_id);
        }
      } else {
        const memberEmails = extractMemberEmailsFromMessage(request.message);
        if (memberEmails.length > 0) {
          const { data: foundUsers } = await supabase.from('users').select('auth_id').in('email', memberEmails);
          if (foundUsers) {
            foundUsers.forEach(u => {
              if (!memberIdsToReset.includes(u.auth_id)) memberIdsToReset.push(u.auth_id);
            });
          }
        }
      }

      await supabase.from("student_profiles").update({ student_status: "MEMBER", current_advisor_id: null }).in("user_id", memberIdsToReset);

      setSelected(null);
      await Swal.fire("เรียบร้อย", "ลบข้อมูลโครงงาน ห้องสนทนา และคืนโควตาเรียบร้อยแล้ว", "success");
      await loadUser();

    } catch (error) {
      Swal.fire("ข้อผิดพลาด", error.message, "error");
    }
  };

  const goToChat = useCallback((request) => {
    const partner = getPartnerInfo(request);
    navigate("/chat", { state: { chatPartnerId: partner?.auth_id, projectTitle: request.project_title } });
  }, [getPartnerInfo, navigate]);

  const handleAcceptMemberInvite = async (request) => {
    const result = await Swal.fire({
      title: "ตอบรับคำเชิญ?",
      text: `คุณต้องการตอบรับเข้าร่วมกลุ่มโครงงาน "${request.project_title}" ใช่หรือไม่?`,
      icon: "question",
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonColor: "#2563EB",
      confirmButtonText: "ยืนยันเข้าร่วม",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
      let pm = currentUserMemberships.find(m => {
        const proj = m.projects;
        if (!proj) return false;
        if (request.is_co_advisor_request) return m.project_id === request.request_id;
        return proj.leader_id === request.student_id && proj.advisor_id === request.advisor_id;
      });

      if (pm?.id) {
        const { error } = await supabase.from('project_members').update({ status: 'approved' }).eq('id', pm.id);
        if (error) throw error;
      } else {
        const { data: proj } = await supabase
          .from('projects')
          .select('project_id')
          .eq('leader_id', request.student_id)
          .eq('advisor_id', request.advisor_id)
          .neq('status', 'cancelled')
          .maybeSingle();

        if (proj?.project_id) {
          const { error } = await supabase.from('project_members').upsert({
            project_id: proj.project_id,
            student_id: user.auth_id,
            status: 'approved'
          });
          if (error) throw error;
        }
      }

      if (user?.auth_id) {
        await supabase.from('student_profiles').update({
          student_status: "MEMBER",
          current_advisor_id: request.advisor_id
        }).eq('user_id', user.auth_id);
      }

      setSelected(null);
      await Swal.fire("สำเร็จ", "คุณได้เข้าร่วมโครงงานเรียบร้อยแล้ว", "success");
      await loadUser();
    } catch (err) {
      Swal.fire("เกิดข้อผิดพลาด", err.message, "error");
    }
  };

  const handleDeclineMemberInvite = async (request) => {
    const result = await Swal.fire({
      title: "ปฏิเสธคำเชิญ?",
      text: `คุณต้องการปฏิเสธคำเชิญเข้าร่วมกลุ่มโครงงาน "${request.project_title}" ใช่หรือไม่?`,
      icon: "warning",
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonColor: "#EF4444",
      confirmButtonText: "ปฏิเสธคำเชิญ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
      let pm = currentUserMemberships.find(m => {
        const proj = m.projects;
        if (!proj) return false;
        if (request.is_co_advisor_request) return m.project_id === request.request_id;
        return proj.leader_id === request.student_id && proj.advisor_id === request.advisor_id;
      });

      if (pm?.id) {
        await supabase.from('project_members').delete().eq('id', pm.id);
      } else if (user?.auth_id) {
        await supabase.from('project_members').delete().eq('student_id', user.auth_id);
      }

      // Notify leader that member declined
      if (request.student_id) {
        const who = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'นักศึกษา';
        await supabase.from('notifications').insert({
          user_id: request.student_id,
          title: 'สมาชิกปฏิเสธคำเชิญ',
          message: `${who} ได้ปฏิเสธคำเชิญเข้าร่วมกลุ่มโครงงาน "${request.project_title || ''}"`,
          is_read: false,
          created_at: new Date().toISOString()
        });
      }

      if (request.request_id && user?.email) {
        const who = `${user.first_name || ''} ${user.last_name || ''} (${user.email}) ได้ปฏิเสธคำเชิญ`;
        const newMsg = `${request.message || ""}\n\n[หมายเหตุระบบ]: ${who} เมื่อ ${new Date().toLocaleDateString("th-TH")}`;
        try {
          await supabase.from("requests").update({ message: newMsg }).eq("request_id", request.request_id);
        } catch (e) {}
      }

      setSelected(null);
      await Swal.fire({ title: "ปฏิเสธคำเชิญแล้ว", icon: "success", timer: 1500, showConfirmButton: false, toast: true, position: 'bottom-end' });
      await loadUser();
    } catch (err) {
      Swal.fire("เกิดข้อผิดพลาด", err.message, "error");
    }
  };

  // ==============================================
  // UI HELPERS
  // ==============================================
  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || '';
    
    if (s === "pending") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>รอพิจารณา
      </span>
    );
    if (s === "co_advisor_pending") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>รอพิจารณาที่ปรึกษาร่วม
      </span>
    );
    if (s === "invited") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 border border-sky-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>คำเชิญเข้ากลุ่ม
      </span>
    );
    if (s === "approved") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>ได้เข้ากลุ่มแล้ว
      </span>
    );
    if (s === "accepted") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>อนุมัติแล้ว
      </span>
    );
    if (s === "co_advisor_accepted") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></span>ตอบรับที่ปรึกษาร่วม
      </span>
    );
    if (s === "rejected") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>ปฏิเสธ
      </span>
    );
    if (s === "cancelled") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>ยกเลิกคำขอ
      </span>
    );
    if (s === "kicked") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>ยกเลิกโดยอาจารย์
      </span>
    );
    if (s === "left") return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200/60 rounded-full text-xs font-semibold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>ออกจากกลุ่ม
      </span>
    );

    return <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold uppercase">{status || 'ไม่มีสถานะ'}</span>;
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col font-kanit relative">
      <Header user={user} fullName={fullName} profileImage={profileImage} role={role} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
                <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              รายการคำขอและสถานะ
            </h1>
            <p className="text-slate-500 mt-1.5 text-sm ml-[3.25rem]">จัดการและติดตามความคืบหน้าคำขอที่ปรึกษาโครงงานของคุณ</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {role?.toUpperCase() === 'ADVISOR' && (
              <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">โควตากลุ่มโครงงาน</div>
                  <div className="text-sm font-extrabold text-slate-800">
                    <span className="text-blue-600 text-lg">{advisorStats.current}</span> / {advisorStats.max > 0 && advisorStats.max < 999 ? advisorStats.max : '∞'} กลุ่ม
                  </div>
                </div>
              </div>
            )}
            <button 
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl shadow-sm text-sm font-bold transition-all h-fit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              กลับหน้าหลัก
            </button>
          </div>
        </div>

        {/* Toolbar Card */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>
            </div>
            <div className="flex-1">
              <select 
                value={filterStatus} 
                onChange={handleFilterChange}
                className="w-full sm:w-64 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 block px-4 py-2 transition-all outline-none appearance-none cursor-pointer font-bold"
                style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg className="shrink-0" xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748B'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/></svg>")`, backgroundPosition: 'right 12px center', backgroundSize: '16px', backgroundRepeat: 'no-repeat' }}
              >
                <option value="all">สถานะทั้งหมด (All)</option>
                <option value="pending">รอพิจารณา (Pending)</option>
                <option value="accepted">อนุมัติแล้ว (Accepted)</option>
                <option value="rejected">ปฏิเสธ (Rejected)</option>
                <option value="cancelled">ยกเลิก (Cancelled)</option>
              </select>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-5 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-sm font-bold hover:bg-rose-600 hover:text-white transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              ลบที่เลือก ({selectedIds.length})
            </button>
          )}
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 text-sm font-medium tracking-wide">กำลังโหลดข้อมูลระบบ...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll} 
                        checked={(() => {
                          const selectableItems = currentItems.filter(r => !['pending', 'co_advisor_pending', 'accepted', 'co_advisor_accepted', 'invited'].includes(getDisplayStatus(r)?.toLowerCase()) && !r.is_co_advisor_request);
                          return selectableItems.length > 0 && selectableItems.every(item => selectedIds.includes(item.request_id));
                        })()}
                        className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50" 
                        disabled={currentItems.filter(r => !['pending', 'co_advisor_pending', 'accepted', 'co_advisor_accepted', 'invited'].includes(getDisplayStatus(r)?.toLowerCase()) && !r.is_co_advisor_request).length === 0} 
                      />
                    </th>
                    <th className="px-4 py-3">หัวข้อโครงงาน</th>
                    <th className="px-4 py-3">ผู้เกี่ยวข้อง</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">วันที่ทำรายการ</th>
                    <th className="px-4 py-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {currentItems.map((r, i) => {
                    const partner = getPartnerInfo(r);
                    const isChecked = selectedIds.includes(r.request_id);
                    const isInvited = isInvitedMember(r);
                    const displayStatus = getDisplayStatus(r);
                    
                    const isProtected = ['pending', 'co_advisor_pending', 'accepted', 'co_advisor_accepted', 'invited', 'approved'].includes(displayStatus?.toLowerCase()) || r.is_co_advisor_request;

                    return (
                      <tr key={r.request_id} className={`hover:bg-slate-50/80 transition-colors ${isChecked ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="checkbox" 
                            disabled={isProtected}
                            checked={isChecked} 
                            onChange={() => handleSelectOne(r.request_id)} 
                            onClick={(e) => e.stopPropagation()} 
                            className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" 
                            title={isProtected ? "สถานะนี้ไม่สามารถลบได้" : "เลือกเพื่อลบ"}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 text-[14px] max-w-sm truncate" title={r.project_title}>{r.project_title}</div>
                          {isInvited && <div className="text-[10px] font-bold text-sky-600 mt-1 flex items-center gap-1 bg-sky-50 w-fit px-2 py-0.5 rounded border border-sky-100">ถูกเชิญเป็นสมาชิก</div>}
                          {getQuotaBadge(r)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {partner?.profile_image ? (
                              <img src={partner.profile_image} className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" alt="" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200 shadow-sm">
                                {partner ? partner.first_name?.charAt(0) : "?"}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-800 text-[13px]">{partner ? `${partner.first_name} ${partner.last_name}` : "ไม่ระบุข้อมูล"}</div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {isInvited 
                                  ? (partner?.advisor_type ? `อาจารย์ที่ปรึกษา (${partner.advisor_type})` : 'อาจารย์ที่ปรึกษา') 
                                  : formatRole(partner?.role, partner?.advisor_type)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(getDisplayStatus(r))}</td>
                        <td className="px-4 py-3 text-[12px] text-slate-500 font-medium">{new Date(r.created_at).toLocaleDateString("th-TH")}</td>
                        
                        <td className="px-4 py-3">
                          <div className="flex justify-center items-center">
                            <button onClick={() => setSelected(r)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              ดูรายละเอียด
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {currentItems.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-16 bg-slate-50/50">
                        <div className="flex justify-center mb-3 opacity-30 shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                          </svg>
                        </div>
                        <p className="text-slate-500 font-bold text-sm">ไม่พบข้อมูลในหมวดหมู่นี้</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-6 px-4 py-4 border-t border-slate-200 bg-white">
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${currentPage === 1 ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                  กลับหน้าหลัก
                </button>
                <span className="text-xs font-medium text-slate-500">
                  หน้า <span className="text-slate-900 font-bold">{currentPage}</span> จาก {totalPages}
                </span>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${currentPage === totalPages ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                  หน้าถัดไป
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal ดูรายละเอียด */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200 relative" onClick={(e) => e.stopPropagation()}>
            {/* Absolute Close Button */}
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-full transition-colors border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            {/* Modal Header */}
            <div className="bg-white px-5 py-4 pr-14 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-fit uppercase tracking-wide">หัวข้อโครงงาน</div>
                  {getQuotaBadge(selected)}
                </div>
                <h3 className="text-xl font-bold text-slate-900 leading-tight break-words whitespace-normal">{selected.project_title}</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 shrink-0 mt-2 sm:mt-0">
                {(selected.status?.toLowerCase() === 'pending' || selected.status?.toLowerCase() === 'co_advisor_pending' || selected.status?.toLowerCase() === 'accepted' || selected.status?.toLowerCase() === 'co_advisor_accepted') && !isInvitedMember(selected) && !selected.is_co_advisor_request && (
                  <button onClick={() => goToChat(selected)} className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    สนทนา
                  </button>
                )}
                
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
                        const p = getPartnerInfo(selected);
                        return p?.profile_image ? <img src={p.profile_image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-lg">{p?.first_name?.charAt(0) || "U"}</div>;
                      })()}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 mb-0.5 uppercase tracking-wider">คู่สนทนา / ผู้เกี่ยวข้อง</p>
                      <p className="text-sm font-bold text-slate-800">
                        {(() => {
                          const p = getPartnerInfo(selected);
                          return p ? `${p.first_name} ${p.last_name}` : "-";
                        })()}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                          {(() => {
                            const p = getPartnerInfo(selected);
                            return isInvitedMember(selected) 
                              ? (p?.advisor_type ? `อาจารย์ที่ปรึกษา (${p.advisor_type})` : 'อาจารย์ที่ปรึกษา') 
                              : formatRole(p?.role, p?.advisor_type);
                          })()}
                        </span>

                        {(() => {
                          const p = getPartnerInfo(selected);
                          const expertise = p?.expertise;
                          const major = p?.major;
                          const advisorType = p?.advisor_type;

                          if (expertise) {
                            return (
                              <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                ความถนัด: {expertise}
                              </span>
                            );
                          }
                          if (major) {
                            return (
                              <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                สาขา: {major}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-4">
                    <p className="text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">สถานะคำขอ</p>
                    {getStatusBadge(getDisplayStatus(selected))}
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
                    <div className="text-[13px] text-slate-700 font-medium whitespace-pre-wrap break-words">
                      {selected.project_scope || <span className="text-slate-400 italic">ไม่ได้ระบุขอบเขต</span>}
                    </div>
                  </div>

                  {/* ภาษา / เครื่องมือ */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                      <div className="p-1 bg-sky-50 text-sky-600 rounded-md shrink-0">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      </div>
                      ภาษา / เครื่องมือที่ใช้
                    </div>
                    <div className="text-[13px] font-bold text-slate-800 break-words leading-relaxed">
                      {selected.language_used || <span className="text-slate-400 italic font-medium">ไม่ได้ระบุ</span>}
                    </div>
                  </div>

                  {/* ลิงก์แนบ / เอกสาร */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                      <div className="p-1 bg-emerald-50 text-emerald-600 rounded-md shrink-0">
                         <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                         </svg>
                      </div>
                      เอกสารอ้างอิง / ลิงก์แนบ
                    </div>
                    <div className="text-[13px] font-bold break-all">
                      {selected.diagram_url ? (
                        <a href={selected.diagram_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-start gap-1.5 bg-blue-50/50 p-2 rounded-lg border border-blue-100 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                          <span>คลิกเปิดลิงก์</span>
                        </a>
                      ) : <span className="text-slate-400 font-medium italic">- ไม่มีเอกสารแนบ -</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* ขวา: ทีมและคำอธิบายเพิ่มเติม */}
              <div className="flex-[2] flex flex-col gap-4">
                
                {/* หมายเหตุการยกเลิกหรือปฏิเสธ */}
                {remark && (
                  <div className="bg-rose-50 p-4 rounded-2xl border-2 border-rose-200 shadow-sm flex flex-col animate-in fade-in zoom-in duration-300">
                    <div className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 shrink-0">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {remark.title}
                    </div>
                    <div className="text-[13px] text-rose-800 font-medium whitespace-pre-wrap break-words leading-relaxed p-2.5 bg-white/60 rounded-lg border border-rose-100">
                      {remark.content}
                    </div>
                  </div>
                )}

                {/* คำอธิบาย / รายละเอียดเพิ่มเติม */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[80px]">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 shrink-0">
                     <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                     </svg>
                     รายละเอียดเพิ่มเติม
                  </div>
                  <div className={`text-[13px] text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 flex-1 overflow-y-auto custom-scrollbar ${!displayMessage ? 'flex items-center justify-center text-center' : 'whitespace-pre-wrap break-words leading-relaxed'}`}>
                    {displayMessage ? (
                      <span dangerouslySetInnerHTML={{ __html: displayMessage }} />
                    ) : (
                      <span className="text-slate-400 italic font-medium">ไม่มีรายละเอียดเพิ่มเติม</span>
                    )}
                  </div>
                </div>

                {/* สมาชิกในกลุ่ม */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                    <div className="p-1 bg-violet-50 text-violet-600 rounded-md shrink-0">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    สมาชิกในทีม
                  </div>
                  
                  {/* หัวหน้าทีม */}
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
                    <div className="flex items-center gap-2.5">
                      {selected.student?.profile_image ? (
                        <img src={selected.student.profile_image} alt="" className="w-9 h-9 rounded-full border-2 border-amber-400 object-cover shadow-sm shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">{selected.student?.first_name} {selected.student?.last_name}</div>
                        <div className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded inline-block mt-0.5">หัวหน้าทีม</div>
                      </div>
                    </div>
                  </div>

                  {/* ลูกทีม */}
                  <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {isFetchingMembers ? (
                      <div className="flex justify-center items-center py-4">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
                        <span className="ml-2 text-xs font-medium text-slate-500">กำลังตรวจสอบข้อมูลสมาชิก...</span>
                      </div>
                    ) : (
                      displayMembers.length > 0 ? displayMembers.map((email, index) => {
                        const memberInfo = memberDetails.find(u => u.email === email);
                        let badgeText = "รอผลอนุมัติ";
                        let badgeBg = "bg-amber-50 text-amber-700 border-amber-200";

                        if (!memberInfo) {
                            badgeText = "รอสมัคร";
                            badgeBg = "bg-rose-50 text-rose-600 border-rose-200";
                        } else {
                            const rawStatus = selected.status?.toLowerCase();
                            
                            let isStillInProject = false;
                            let pmStatus = null;
                            if (memberInfo.project_members && memberInfo.project_members.length > 0) {
                                const foundPm = memberInfo.project_members.find(pm => {
                                    const proj = Array.isArray(pm.projects) ? pm.projects[0] : pm.projects;
                                    if (!proj) return false;
                                    if (selected.is_co_advisor_request) return proj.status !== 'cancelled' && pm.project_id === selected.request_id;
                                    if (selected.is_member_request) return proj.status !== 'cancelled' && (pm.project_id === selected.request_id || (proj.leader_id === selected.student_id && proj.advisor_id === selected.advisor_id));
                                    return proj.status !== 'cancelled' && (proj.project_id === selected.request_id || (proj.leader_id === selected.student_id && proj.advisor_id === selected.advisor_id));
                                });
                                if (foundPm) {
                                    isStillInProject = true;
                                    pmStatus = foundPm.status?.toLowerCase();
                                }
                            }

                            if (rawStatus === 'accepted' || rawStatus === 'co_advisor_accepted' || rawStatus === 'invited' || rawStatus === 'approved') {
                                if (!isStillInProject || pmStatus === 'left' || pmStatus === 'kicked' || pmStatus === 'rejected') {
                                    return null;
                                } else if (pmStatus === 'pending') {
                                    badgeText = "รอตอบรับ";
                                    badgeBg = "bg-amber-50 text-amber-600 border-amber-200";
                                } else {
                                    badgeText = "เข้าร่วมแล้ว";
                                    badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                }
                            } else if (rawStatus === 'kicked') {
                                badgeText = "โดนเตะออก";
                                badgeBg = "bg-rose-50 text-rose-700 border-rose-200";
                            } else if (rawStatus === 'left') {
                                badgeText = "ออกจากกลุ่ม";
                                badgeBg = "bg-orange-50 text-orange-700 border-orange-200";
                            } else if (rawStatus === 'rejected' || rawStatus === 'cancelled') {
                                badgeText = "ยกเลิกคำขอ";
                                badgeBg = "bg-slate-100 text-slate-500 border-slate-200";
                            } else {
                                badgeText = "รออนุมัติ";
                                badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
                            }
                        }

                        return (
                          <div key={index} className="flex justify-between items-center bg-slate-50/80 p-2 rounded-lg border border-slate-100 hover:border-blue-100 transition-colors">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {memberInfo ? (
                                <>
                                  {memberInfo.profile_image ? (
                                    <img src={memberInfo.profile_image} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 border border-slate-300">
                                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="truncate">
                                    <div className="text-xs font-bold text-slate-700 truncate">
                                      {memberInfo.first_name} {memberInfo.last_name}
                                      {memberInfo.advisor_type && <span className="ml-1 text-[9px] text-purple-500">({memberInfo.advisor_type})</span>}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-medium truncate" title={email}>{email}</div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-400 shrink-0 border border-rose-100">
                                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <div className="truncate">
                                    <div className="text-xs font-bold text-slate-700 truncate">{email}</div>
                                    <div className="text-[9px] text-rose-500 font-medium">ยังไม่สมัครใช้งานระบบ</div>
                                  </div>
                                </>
                              )}
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap border ${badgeBg} ml-2 shrink-0`}>{badgeText}</span>
                          </div>
                        );
                      }) : (
                        <div className="text-center py-4 text-slate-400 text-xs font-medium italic border-2 border-dashed border-slate-200 rounded-lg">
                          ไม่มีสมาชิกทีมเพิ่มเติม
                        </div>
                      )
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row gap-3 justify-end items-center shrink-0">
              
              {/* ปุ่มแก้ไข (โผล่เมื่อเป็นหัวหน้า และสถานะ Pending และไม่ใช่คำเชิญ Co-Advisor) */}
              {(selected.status?.toLowerCase() === "pending" || selected.status?.toLowerCase() === "co_advisor_pending") && isLeader(selected) && !selected.is_co_advisor_request && (
                <button onClick={() => openEditModal(selected)} className="px-5 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[13px] font-bold transition-all border border-blue-200 shadow-sm mr-auto flex items-center gap-1.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  แก้ไขคำขอ
                </button>
              )}

              {(selected.status?.toLowerCase() === "pending" || selected.status?.toLowerCase() === "co_advisor_pending") && (
                <>
                  {isReceiver(selected) ? (
                    <div className="flex w-full sm:w-auto gap-2">
                      <button onClick={() => updateStatus(selected, "REJECTED")} className="flex-1 sm:flex-none px-5 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ปฏิเสธ
                      </button>
                      <button onClick={() => updateStatus(selected, selected.status?.toLowerCase() === "co_advisor_pending" ? "CO_ADVISOR_ACCEPTED" : "ACCEPTED")} className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[13px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {selected.status?.toLowerCase() === "co_advisor_pending" ? "ตอบรับที่ปรึกษาร่วม" : "อนุมัติโครงงาน"}
                      </button>
                    </div>
                  ) : isLeader(selected) ? (
                    <button onClick={() => cancelRequest(selected)} className="w-full sm:w-auto px-5 py-2 bg-white text-rose-600 hover:bg-rose-50 rounded-lg text-[13px] font-bold transition-all border border-rose-200 shadow-sm flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      ยกเลิกคำร้อง
                    </button>
                  ) : (
                    <div className="w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold text-center">
                      กรุณารออาจารย์พิจารณา
                    </div>
                  )}
                </>
              )}

              {/* ให้ทั้งที่ปรึกษา และ นักศึกษา สามารถยกเลิกโครงงาน/ที่ปรึกษาร่วมที่อนุมัติแล้วได้ */}
              {(selected.status?.toLowerCase() === "accepted" || selected.status?.toLowerCase() === "co_advisor_accepted") && (isReceiver(selected) || isLeader(selected)) && (
                <button onClick={() => revokeProject(selected)} className="w-full sm:w-auto px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[13px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  ยกเลิกสถานะ (ลบถาวร)
                </button>
              )}

              {/* ปุ่มรับ/ปฏิเสธ สำหรับลูกทีมที่ถูกเชิญ */}
              {getDisplayStatus(selected) === 'invited' && (
                <div className="flex w-full sm:w-auto gap-2">
                  <button 
                    onClick={() => handleDeclineMemberInvite(selected)} 
                    className="flex-1 sm:flex-none px-5 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    ปฏิเสธคำเชิญ
                  </button>
                  <button 
                    onClick={() => handleAcceptMemberInvite(selected)} 
                    className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[13px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ตอบรับและเข้าร่วมโครงงาน
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL แก้ไขคำขอ (สำหรับนักศึกษา) ================= */}
      <EditProjectRequestModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        projectData={null}
        originalRequest={selected}
        projectId={null}
        onSuccess={loadUser}
        showMembers={true}
        user={user}
      />
    </div>
  );
}