// =============================================
// src/pages/AdvisorSearch.jsx
// =============================================
import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Header from "../components/Header";

// --- Helpers ---
const extractDriveFileId = (url = "") => {
  try {
    if (url.includes("/file/d/")) return url.split("/file/d/")[1].split("/")[0];
    if (url.includes("open?id=")) return url.split("open?id=")[1].split("&")[0];
  } catch {}
  return null;
};

// 🌟 ตัวเลือกความเชี่ยวชาญสำหรับการค้นหา
const expertiseOptionsList = [
  "ฮาร์ดแวร์ (Hardware)",
  "ซอฟต์แวร์ (Software)",
  "ถนัดทั้ง 2 อย่าง (Hardware & Software)",
  "ปัญญาประดิษฐ์และข้อมูล (AI & Data)",
  "เครือข่ายและความปลอดภัย (Network & Security)",
  "อื่นๆ (โปรดระบุใน Bio)"
];

export default function AdvisorSearch() {
  const navigate = useNavigate();
  
  // ================= STATE =================
  const [currentUser, setCurrentUser] = useState(null); 
  const [advisors, setAdvisors] = useState([]);
  const [filteredAdvisors, setFilteredAdvisors] = useState([]);
  
  // State สำหรับค้นหาและกรองความถนัด
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState([]); 
  const [isExpertiseDropdownOpen, setIsExpertiseDropdownOpen] = useState(false); 
  const expertiseDropdownRef = useRef(null); 

  const [loading, setLoading] = useState(true);

  // State สำหรับ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; 

  // State สำหรับ Modal Profile & Request
  const [selectedAdvisor, setSelectedAdvisor] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State สำหรับฟอร์มส่งคำขอ
  const [formData, setFormData] = useState({
    project_title: "",
    project_scope: "",
    diagram_url: "",
    language_used: "",
    description: "",
    members: [""], 
  });

  // State สำหรับ Autocomplete
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(null);

  // State สำหรับแผงจัดการอาจารย์ (Advisor Panel)
  const [tempMaxGroups, setTempMaxGroups] = useState("");
  const [isQuotaSidebarOpen, setIsQuotaSidebarOpen] = useState(true);

  const [isRejectedAlertDismissed, setIsRejectedAlertDismissed] = useState(false);

  // ================= FETCH DATA & REALTIME =================
  useEffect(() => {
    let isMounted = true;
    let userChannel = null;
    let advisorProfileChannel = null;
    let projectsChannel = null; 
    let requestsChannel = null;
    let projectMembersChannel = null;

    const fetchData = async () => {
      try {
        setLoading(true);
        
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
          navigate("/");
          return;
        }

        // ดึงข้อมูล Current User
        const { data: userProfile, error: userError } = await supabase
          .from("users")
          .select(`
            *,
            student_profiles!student_profiles_user_id_fkey (student_status, current_advisor_id),
            advisor_profiles!advisor_profiles_user_id_fkey (is_accepting_students, max_groups),
            projects!projects_advisor_id_fkey (project_id, status) 
          `)
          .eq("auth_id", authData.user.id)
          .maybeSingle();

        if (userError) throw userError;
        
        let flatUser = null;

        if (isMounted && userProfile) {
          let advProfile = Array.isArray(userProfile.advisor_profiles) ? userProfile.advisor_profiles[0] : userProfile.advisor_profiles;
          const stuProfile = Array.isArray(userProfile.student_profiles) ? userProfile.student_profiles[0] : userProfile.student_profiles;
          
          // ถ้าเป็นอาจารย์แต่ยังไม่มีเรคคอร์ดใน advisor_profiles ให้สร้างเริ่มต้นโควตา 5 กลุ่ม
          if (userProfile.role?.toUpperCase() === "ADVISOR" && !advProfile) {
            const { data: newAdvProfile } = await supabase
              .from("advisor_profiles")
              .insert([{ user_id: userProfile.auth_id, max_groups: 5, is_accepting_students: true }])
              .select()
              .maybeSingle();
            if (newAdvProfile) advProfile = newAdvProfile;
          }

          const activeProjects = userProfile.projects ? userProfile.projects.filter(p => p.status !== 'cancelled' && p.status !== 'completed') : [];

          flatUser = {
            ...userProfile,
            student_status: stuProfile?.student_status,
            current_advisor_id: stuProfile?.current_advisor_id,
            is_accepting_students: advProfile?.is_accepting_students ?? true,
            max_groups: advProfile?.max_groups ?? 5,
            current_groups: activeProjects.length 
          };

          // 🌟 1. ดักทุกสถานะสำหรับ Current User (ดูจากข้อมูลจริง ไม่ใช่แค่ State)
          if (flatUser.role?.toUpperCase() === "STUDENT") {
            const { data: myProjects } = await supabase
              .from("project_members")
              .select("project_id, projects!inner(status)")
              .eq("student_id", flatUser.auth_id)
              .eq("status", "approved")
              .not("projects.status", "in", '("cancelled")'); 
            
            const completedCount = myProjects ? myProjects.filter(p => p.projects?.status === "completed").length : 0;
            const activeProjects = myProjects ? myProjects.filter(p => p.projects?.status !== "completed") : [];
            const hasActive = activeProjects.length > 0;
            
            flatUser.completed_projects_count = completedCount;

            // Check for pending invites
            const { data: pendingInvites } = await supabase
              .from("project_members")
              .select("project_id")
              .eq("student_id", flatUser.auth_id)
              .eq("status", "pending");

            // 1. ตรวจสอบว่าตัวเองเป็นหัวหน้ากลุ่มที่ส่งคำขอค้างไว้หรือไม่
            const { data: pendingRequests } = await supabase
              .from("requests")
              .select(`
                request_id,
                project_title,
                status,
                created_at,
                advisor:users!requests_advisor_id_fkey (first_name, last_name, prefix)
              `)
              .eq("student_id", flatUser.auth_id)
              .ilike("status", "pending")
              .order("request_id", { ascending: false })
              .limit(1);

            // 2. ตรวจสอบว่าตัวเองถูกเพื่อนระบุเป็นสมาชิกในกลุ่มที่ส่งคำขอค้างไว้หรือไม่
            const { data: memberPendingRequests } = await supabase
              .from("requests")
              .select(`
                request_id,
                project_title,
                status,
                created_at,
                student:users!requests_student_id_fkey (first_name, last_name, prefix),
                advisor:users!requests_advisor_id_fkey (first_name, last_name, prefix)
              `)
              .neq("student_id", flatUser.auth_id)
              .ilike("message", `%${flatUser.email}%`)
              .ilike("status", "pending")
              .order("request_id", { ascending: false })
              .limit(1);

            if (hasActive) {
              flatUser.student_status = "MATCHED";
            } else if (pendingInvites && pendingInvites.length > 0) {
              flatUser.student_status = "INVITED";
            } else if (pendingRequests && pendingRequests.length > 0) {
              flatUser.student_status = "REQUESTING";
              flatUser.pending_request = pendingRequests[0];
            } else if (memberPendingRequests && memberPendingRequests.length > 0) {
              flatUser.student_status = "MEMBER_PENDING";
              flatUser.member_pending_request = memberPendingRequests[0];
            } else if (completedCount > 0) {
              flatUser.student_status = "COMPLETED";
            } else {
              const { data: rejectedRequests } = await supabase
                .from("requests")
                .select("advisor_id, message")
                .eq("student_id", flatUser.auth_id)
                .ilike("status", "rejected")
                .order("request_id", { ascending: false })
                .limit(1);

              if (rejectedRequests && rejectedRequests.length > 0) {
                flatUser.student_status = "REJECTED";
                flatUser.rejected_advisor_id = rejectedRequests[0].advisor_id;
                
                // Extract the rejection remark from the message column
                const rawMsg = rejectedRequests[0].message || "";
                const remarkParts = rawMsg.split("[หมายเหตุการปฏิเสธจากอาจารย์]:");
                flatUser.rejected_remark = remarkParts.length > 1 ? remarkParts[1].trim() : "";
              } else {
                flatUser.student_status = "MEMBER"; // รีเซ็ตให้กลับมาขอใหม่ได้ถ้าไม่ติดอะไรเลย
              }
            }
          }

          setCurrentUser(flatUser);
          if (flatUser.role?.toUpperCase() === "ADVISOR") {
            setTempMaxGroups(flatUser.max_groups?.toString() || "0");
          }
        }

        // 🌟 ดึงข้อมูลอาจารย์ทั้งหมด
        let advisorQuery = supabase
          .from("users")
          .select(`
            *,
            advisor_profiles!advisor_profiles_user_id_fkey (is_accepting_students, max_groups),
            projects!projects_advisor_id_fkey (project_id, status)
          `)
          .ilike("role", "advisor");

        const { data: advisorsData, error: advisorsError } = await advisorQuery;

        if (advisorsError) throw advisorsError;

        if (isMounted && advisorsData) {
          const filteredOutExternals = advisorsData.filter(adv => {
            const advType = (adv.advisor_type || "").trim();
            return advType === "อาจารย์ในสาขา" || advType === "";
          });

          const flatAdvisors = filteredOutExternals.map(adv => {
            const advProfile = Array.isArray(adv.advisor_profiles) ? adv.advisor_profiles[0] : adv.advisor_profiles;
            const activeProjectsCount = adv.projects ? adv.projects.filter(p => p.status !== 'cancelled' && p.status !== 'completed').length : 0;

            return {
              ...adv,
              is_accepting_students: advProfile?.is_accepting_students ?? true,
              max_groups: advProfile?.max_groups ?? 5,
              current_groups: activeProjectsCount 
            }
          });
          setAdvisors(flatAdvisors);
          setFilteredAdvisors(flatAdvisors);
        }

        // ============ REALTIME LISTENERS ============
        userChannel = supabase.channel(`public-users-updates-${Date.now()}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
            if (isMounted) {
              if (payload.new.auth_id === authData.user.id) setCurrentUser(prev => ({ ...prev, ...payload.new }));
              setAdvisors(prev => prev.map(adv => adv.auth_id === payload.new.auth_id ? { ...adv, ...payload.new } : adv));
            }
          }).subscribe();

        advisorProfileChannel = supabase.channel(`public-advisor-profiles-updates-${Date.now()}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'advisor_profiles' }, (payload) => {
            if (isMounted) {
              if (authData.user.id === payload.new.user_id) {
                setCurrentUser(prev => ({ 
                  ...prev, 
                  is_accepting_students: payload.new.is_accepting_students, 
                  max_groups: payload.new.max_groups
                }));
              }
              setAdvisors(prev => prev.map(adv => adv.auth_id === payload.new.user_id ? { 
                ...adv, 
                is_accepting_students: payload.new.is_accepting_students, 
                max_groups: payload.new.max_groups
              } : adv));
            }
          }).subscribe();

        projectsChannel = supabase.channel(`public-projects-updates-${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
            if (isMounted) {
              const handleGroupCount = (adv, evtType, pNew, pOld) => {
                let count = adv.current_groups || 0;
                const isStatusActive = (status) => status !== 'cancelled' && status !== 'completed';
                
                if (evtType === 'INSERT' && adv.auth_id === pNew.advisor_id) {
                  if (isStatusActive(pNew.status)) count++;
                }
                else if (evtType === 'DELETE' && adv.auth_id === pOld.advisor_id) {
                  if (isStatusActive(pOld.status)) count = Math.max(0, count - 1);
                }
                else if (evtType === 'UPDATE') {
                  const wasActive = isStatusActive(pOld.status);
                  const isActive = isStatusActive(pNew.status);
                  
                  if (adv.auth_id === pNew.advisor_id && wasActive && !isActive) {
                    count = Math.max(0, count - 1);
                  }
                  else if (adv.auth_id === pNew.advisor_id && !wasActive && isActive) {
                    count++;
                  }
                }
                return count;
              };

              setAdvisors(prev => prev.map(adv => {
                const isRelated = adv.auth_id === payload.new?.advisor_id || adv.auth_id === payload.old?.advisor_id;
                if (!isRelated) return adv;
                const newCount = handleGroupCount(adv, payload.eventType, payload.new, payload.old);
                const isAccepting = newCount < (adv.max_groups || 999);
                return { ...adv, current_groups: newCount, is_accepting_students: isAccepting };
              }));

              setCurrentUser(prev => {
                if (prev.auth_id === payload.new?.advisor_id || prev.auth_id === payload.old?.advisor_id) {
                  const newCount = handleGroupCount(prev, payload.eventType, payload.new, payload.old);
                  return { ...prev, current_groups: newCount };
                }
                return prev;
              });

              // If project status changes (e.g. completed/cancelled), refresh student status
              if (payload.eventType === 'UPDATE' && payload.new?.status !== payload.old?.status) {
                fetchData();
              }
            }
          }).subscribe();

        projectMembersChannel = supabase.channel(`public-pm-updates-${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, (payload) => {
            const isMe = (payload.new && payload.new.student_id === authData.user.id) || (payload.old && payload.old.student_id === authData.user.id);
            if (isMounted && isMe) {
              fetchData();
            }
          }).subscribe();

        requestsChannel = supabase.channel(`public-requests-updates-${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
            if (isMounted) fetchData();
          }).subscribe();

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => { 
      isMounted = false; 
      if (userChannel) supabase.removeChannel(userChannel);
      if (advisorProfileChannel) supabase.removeChannel(advisorProfileChannel);
      if (projectsChannel) supabase.removeChannel(projectsChannel);
      if (projectMembersChannel) supabase.removeChannel(projectMembersChannel);
      if (requestsChannel) supabase.removeChannel(requestsChannel);
    };
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (expertiseDropdownRef.current && !expertiseDropdownRef.current.contains(event.target)) {
        setIsExpertiseDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ================= SEARCH & FILTER LOGIC =================
  useEffect(() => {
    let result = advisors;

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((advisor) => {
        const fullName = `${advisor.first_name} ${advisor.last_name}`.toLowerCase();
        return fullName.includes(term);
      });
    }

    if (selectedExpertise.length > 0) {
      result = result.filter((advisor) => {
        const advExp = advisor.expertise ? advisor.expertise.toLowerCase() : "";
        const advHasHardware = advExp.includes("ฮาร์ดแวร์") || advExp.includes("hardware");
        const advHasSoftware = advExp.includes("ซอฟต์แวร์") || advExp.includes("software");
        
        const advHasBoth = advExp.includes("ถนัดทั้ง 2 อย่าง") || advExp.includes("both") || (advHasHardware && advHasSoftware);

        return selectedExpertise.some(selected => {
          const sel = selected.toLowerCase();
          
          if (sel.includes("ถนัดทั้ง 2 อย่าง") || sel.includes("both")) return advHasBoth;
          if (sel.includes("ฮาร์ดแวร์") || sel.includes("hardware")) return advHasHardware || advHasBoth; 
          if (sel.includes("ซอฟต์แวร์") || sel.includes("software")) return advHasSoftware || advHasBoth; 
          
          return advExp.includes(sel);
        });
      });
    }

    setFilteredAdvisors(result);
    setCurrentPage(1);
  }, [searchTerm, selectedExpertise, advisors]);

  const handleExpertiseCheckboxChange = (option) => {
    if (selectedExpertise.includes(option)) {
      setSelectedExpertise(selectedExpertise.filter(item => item !== option));
    } else {
      setSelectedExpertise([...selectedExpertise, option]);
    }
  };

  // ================= PAGINATION =================
  const indexOfLastAdvisor = currentPage * itemsPerPage;
  const indexOfFirstAdvisor = indexOfLastAdvisor - itemsPerPage;
  const currentAdvisors = filteredAdvisors.slice(indexOfFirstAdvisor, indexOfLastAdvisor);
  const totalPages = Math.ceil(filteredAdvisors.length / itemsPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // ================= ADVISOR CONFIG LOGIC =================
  const handleToggleAccepting = async (checked) => {
    setCurrentUser((prev) => ({ ...prev, is_accepting_students: checked }));
    try {
      const { error } = await supabase.from('advisor_profiles').update({ is_accepting_students: checked }).eq('user_id', currentUser.auth_id);
      if (error) throw error;
      Swal.mixin({ toast: true, position: "bottom-end", showConfirmButton: false, timer: 1500 }).fire({ icon: 'success', title: checked ? '🟢 เปิดรับนักศึกษาแล้ว' : '🔴 ปิดรับนักศึกษาชั่วคราว' });
    } catch (err) {
      setCurrentUser((prev) => ({ ...prev, is_accepting_students: !checked }));
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถอัปเดตสถานะได้', 'error');
    }
  };

  const saveMaxGroups = async () => {
    const val = parseInt(tempMaxGroups, 10);
    if (isNaN(val) || val < 0) return Swal.fire("แจ้งเตือน", "กรุณาระบุจำนวนกลุ่มให้ถูกต้อง", "warning");

    try {
      const { error } = await supabase.from('advisor_profiles').update({ max_groups: val }).eq('user_id', currentUser.auth_id);
      if (error) throw error;
      Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: 'อัปเดตโควตาสำเร็จ', showConfirmButton: false, timer: 1500 });
      setCurrentUser(prev => ({ ...prev, max_groups: val }));
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกจำนวนได้', 'error');
    }
  };

  // ================= HANDLERS =================
  const handleOpenProfile = (advisor) => { setSelectedAdvisor(advisor); setIsProfileModalOpen(true); };
  const handleCloseProfile = () => { setIsProfileModalOpen(false); if (!isRequestModalOpen) setSelectedAdvisor(null); };

  const handleOpenRequest = (advisor) => {
    setSelectedAdvisor(advisor);
    setIsProfileModalOpen(false);
    setFormData({ project_title: "", project_scope: "", diagram_url: "", language_used: "", description: "", members: [{ email: "", name: "" }] });
    setIsRequestModalOpen(true);
  };
  const handleCloseRequest = () => { setIsRequestModalOpen(false); setSelectedAdvisor(null); };

  const fetchEmailSuggestions = async (index, value) => {
    const newMembers = [...formData.members];
    let extractedEmail = value;
    const match = value.match(/\(([^)]+@[^)]+)\)/);
    if (match) {
      extractedEmail = match[1].trim();
    }
    newMembers[index] = { email: extractedEmail, name: value };
    setFormData({ ...formData, members: newMembers });

    const cleanQuery = value.replace(/\([^)]*\)/g, '').trim();

    if (!cleanQuery || cleanQuery.length < 2) {
      setEmailSuggestions([]);
      setActiveSuggestionIndex(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("email, prefix, first_name, last_name, profile_image")
        .eq("role", "STUDENT")
        .neq("email", currentUser?.email)
        .or(`email.ilike.%${cleanQuery}%,first_name.ilike.%${cleanQuery}%,last_name.ilike.%${cleanQuery}%`)
        .limit(5);

      if (!error && data) {
        setEmailSuggestions(data);
        setActiveSuggestionIndex(index);
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    }
  };

  const handleSelectSuggestion = (index, sug) => {
    const newMembers = [...formData.members];
    const prefix = sug.prefix ? `${sug.prefix}` : "";
    const fullName = `${prefix}${sug.first_name || ''} ${sug.last_name || ''}`.trim();
    const displayName = `${fullName} (${sug.email})`;
    newMembers[index] = { email: sug.email, name: displayName };
    setFormData({ ...formData, members: newMembers });
    setEmailSuggestions([]);
    setActiveSuggestionIndex(null);
  };

  const addMemberField = () => setFormData({ ...formData, members: [...formData.members, { email: "", name: "" }] });
  const removeMemberField = (index) => setFormData({ ...formData, members: formData.members.filter((_, i) => i !== index) });

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!currentUser || !selectedAdvisor) return;
    if (!formData.project_title.trim()) return Swal.fire("แจ้งเตือน", "กรุณาระบุชื่อโปรเจกต์", "warning");

    const currentStatus = currentUser?.student_status?.toUpperCase();
    if (currentStatus === "REQUESTING") return Swal.fire("แจ้งเตือน", "คุณมีคำขอที่กำลังรออนุมัติอยู่แล้ว", "warning");
    if (currentStatus === "MEMBER_PENDING") return Swal.fire("แจ้งเตือน", "คุณถูกระบุเป็นสมาชิกในกลุ่มโครงงานอื่นที่กำลังรอผลการอนุมัติอยู่แล้ว", "warning");
    if (currentStatus === "MATCHED") return Swal.fire("แจ้งเตือน", "คุณมีกลุ่มและอาจารย์ที่ปรึกษาโครงงานอยู่แล้ว", "warning");

    setIsSubmitting(true);

    try {
      const friendEmails = formData.members
        .map(m => {
          let emailStr = m.email || m.name || "";
          const match = emailStr.match(/\(([^)]+@[^)]+)\)/);
          if (match) emailStr = match[1];
          return emailStr.trim().toLowerCase();
        })
        .filter(m => m !== "" && m.includes("@") && m !== currentUser.email?.toLowerCase());

      let validFriends = [];
      if (friendEmails.length > 0) {
        const { data: friendsData, error: friendsError } = await supabase
          .from("users")
          .select(`auth_id, email, student_profiles!student_profiles_user_id_fkey (student_status)`)
          .in("email", friendEmails);

        if (!friendsError && friendsData) {
          validFriends = friendsData;
          for (const friend of friendsData) {
            // 🌟 2. ดักเช็คเพื่อนว่ามีโปรเจกต์อยู่จริงไหม (ไม่นับ cancelled)
            const { data: friendProject } = await supabase
              .from("project_members")
              .select("project_id, projects!inner(status)")
              .eq("student_id", friend.auth_id)
              .eq("status", "approved")
              .not("projects.status", "in", '("cancelled","completed")')
              .limit(1);

            if (friendProject && friendProject.length > 0) {
              setIsSubmitting(false);
              return Swal.fire("ไม่สามารถส่งคำขอได้", `สมาชิกในกลุ่ม (${friend.email}) มีกลุ่มหรืออาจารย์ที่ปรึกษาอยู่แล้ว`, "error");
            }

            // 🌟 3. ดักเช็คเพื่อนว่ามีคำขอค้างอยู่ไหม (สถานะ pending)
            const { data: friendPendingRequest } = await supabase
              .from("requests")
              .select("request_id")
              .eq("student_id", friend.auth_id)
              .ilike("status", "pending")
              .limit(1);

            if (friendPendingRequest && friendPendingRequest.length > 0) {
              setIsSubmitting(false);
              return Swal.fire("ไม่สามารถส่งคำขอได้", `สมาชิกในกลุ่ม (${friend.email}) มีโครงงานหรือกำลังรอผลอนุมัติอยู่แล้ว`, "error");
            }
          }
        }
      }

      let finalMessage = formData.description.trim();
      if (friendEmails.length > 0) {
        finalMessage += `\n\n[สมาชิกในกลุ่ม]: ${friendEmails.join(", ")}`;
      }

      const { data: requestData, error: insertError } = await supabase.from("requests").insert({
        student_id: currentUser.auth_id,
        advisor_id: selectedAdvisor.auth_id,
        project_title: formData.project_title.trim(),
        project_scope: formData.project_scope.trim(),
        diagram_url: formData.diagram_url.trim(),
        language_used: formData.language_used.trim(),
        message: finalMessage, 
        status: "pending"
      }).select().single();

      if (insertError) throw insertError;

      // แจ้งเตือนไปยังเพื่อนร่วมกลุ่ม (ถ้ามี)
      if (validFriends && validFriends.length > 0) {
        const notiInserts = validFriends.map(f => ({
          user_id: f.auth_id,
          message: `${currentUser.prefix || ''}${currentUser.first_name} ${currentUser.last_name} ได้ระบุชื่อคุณเป็นสมาชิกในคำขอโครงงาน "${formData.project_title.trim()}" เพื่อส่งให้อาจารย์ที่ปรึกษาพิจารณา`
        }));
        await supabase.from("notifications").insert(notiInserts);
      }

      // แจ้งเตือนไปยังอาจารย์ที่ปรึกษา
      await supabase.from("notifications").insert({
        user_id: selectedAdvisor.auth_id,
        message: `${currentUser.prefix || ''}${currentUser.first_name} ${currentUser.last_name} ได้ส่งคำขอที่ปรึกษาโครงงาน "${formData.project_title.trim()}"`
      });

      // เราอัปเดต status เผื่อเอาไว้ใน Profile ด้วยเป็นทางเลือก
      await supabase.from("student_profiles").update({ student_status: "REQUESTING" }).eq("user_id", currentUser.auth_id);
      setCurrentUser((prev) => ({ ...prev, student_status: "REQUESTING" }));

      setIsRequestModalOpen(false);
      Swal.fire("สำเร็จ", "ส่งคำขอเรียบร้อยแล้ว", "success");

    } catch (error) {
      Swal.fire("เกิดข้อผิดพลาดในการส่งคำขอ", error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDisplayRole = (roleStr) => {
    if (!roleStr) return "";
    if (roleStr.toUpperCase() === "ADVISOR") return "อาจารย์";
    if (roleStr.toUpperCase() === "ADMIN") return "ผู้ดูแลระบบ";
    return roleStr;
  };

  const isStudent = currentUser?.role?.toUpperCase() === "STUDENT";
  const currentStatus = currentUser?.student_status?.toUpperCase() || "MEMBER";
  
  const getRequestStatus = (advisor) => {
    if (!isStudent) return { disabled: true, text: "สงวนสิทธิ์เฉพาะนักศึกษา", isWaitlist: false };
    if (currentStatus === "INVITED") return { disabled: true, text: "มีคำเชิญคงค้าง", isWaitlist: false };
    if (currentStatus === "REQUESTING") return { disabled: true, text: "กำลังรอผลการอนุมัติ", isWaitlist: false };
    if (currentStatus === "MEMBER_PENDING") return { disabled: true, text: "อยู่ในกลุ่มอื่น (รอผลอนุมัติ)", isWaitlist: false };
    if (currentStatus === "MATCHED") return { disabled: true, text: "คุณมีกลุ่ม/ที่ปรึกษาแล้ว", isWaitlist: false };
    if (advisor?.is_accepting_students === false) return { disabled: true, text: "ปิดรับนักศึกษา", isWaitlist: false };
    
    const advCurrent = advisor?.current_groups || 0;
    const advMax = advisor?.max_groups || 999;
    
    if (advMax > 0 && advCurrent >= advMax) {
      return { disabled: false, text: "ส่งคำขอสำรอง (เต็มโควตา)", isWaitlist: true };
    }

    return { disabled: false, text: "ส่งคำขอเป็นที่ปรึกษา", isWaitlist: false };
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col relative" style={{ fontFamily: "'Kanit', sans-serif" }}>
      <Header user={currentUser} fullName={currentUser ? `${currentUser.prefix || ''}${currentUser.first_name} ${currentUser.last_name}` : ""} profileImage={currentUser?.profile_image || ""} role={currentUser?.role || ""} />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6 relative z-10 items-start">
        
        {/* ================= HEADER TITLE ================= */}
        <div className="w-full flex flex-col sm:flex-row sm:items-end justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ค้นหาอาจารย์ที่ปรึกษา</h1>
            <p className="text-slate-500 text-sm mt-1">ค้นหารายชื่ออาจารย์ สายความเชี่ยวชาญ และยื่นข้อเสนอโครงงาน</p>
          </div>
          <button onClick={() => navigate("/dashboard")} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[13px] font-medium hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm shrink-0 w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg> กลับหน้าหลัก
          </button>
        </div>

        <div className="w-full flex flex-col lg:flex-row gap-6 items-start">
          
        {/* ================= ฝั่งซ้าย: ADVISOR CONTROL PANEL ================= */}
        {currentUser?.role?.toUpperCase() === 'ADVISOR' && (!currentUser?.advisor_type || currentUser.advisor_type.trim() === 'อาจารย์ในสาขา') && (
          <>
            {isQuotaSidebarOpen ? (
              <aside className="shrink-0 w-full lg:w-[300px] bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col transition-all duration-300">
                <div className="mb-4 pb-4 border-b border-slate-100 flex justify-between items-center w-full">
                  <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <span className="text-lg">⚙️</span> จัดการโควตาโครงงาน
                  </h2>
                  <button onClick={() => setIsQuotaSidebarOpen(false)} title="พับเก็บ" className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                  </button>
                </div>

                <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100 mb-6 text-center">
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-1">กลุ่มที่ดูแลอยู่ปัจจุบัน</span>
                  <div className="flex items-baseline justify-center gap-1.5 my-3">
                    <span className="text-5xl font-extrabold text-blue-700 leading-none">
                      {currentUser.current_groups || 0}<span className="text-2xl text-blue-400">/{currentUser.max_groups > 0 && currentUser.max_groups < 999 ? currentUser.max_groups : '∞'}</span>
                    </span>
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-blue-100/50">
                    <label className="block text-[12px] font-semibold text-slate-600 mb-2">จำกัดจำนวนกลุ่มสูงสุด:</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" min="0" value={tempMaxGroups} onChange={(e) => setTempMaxGroups(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-center text-[14px] font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                      />
                      <button onClick={saveMaxGroups} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded-xl transition-all shadow-sm shrink-0">บันทึก</button>
                    </div>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div className="mt-auto pt-4 border-t border-slate-100">
                  <label className="flex items-center justify-between cursor-pointer group bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-700">สถานะการรับคำขอ</span>
                      <span className={`text-[11px] font-semibold mt-0.5 ${currentUser.is_accepting_students !== false ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {currentUser.is_accepting_students !== false ? 'เปิดรับ (Online)' : 'ปิดรับ (Offline)'}
                      </span>
                    </div>
                    <div className="relative">
                      <input type="checkbox" className="sr-only peer" checked={currentUser.is_accepting_students !== false} onChange={(e) => handleToggleAccepting(e.target.checked)}/>
                      <div className="w-11 h-6 bg-rose-400 rounded-full peer-checked:bg-emerald-500 transition-colors shadow-inner"></div>
                      <div className="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full border border-gray-200 transition-transform peer-checked:translate-x-full shadow-sm"></div>
                    </div>
                  </label>
                </div>
              </aside>
            ) : (
              <div className="shrink-0 w-full lg:w-auto flex items-start">
                <button 
                  onClick={() => setIsQuotaSidebarOpen(true)}
                  className="bg-white border border-slate-100 shadow-sm rounded-3xl px-5 py-3.5 flex items-center justify-center gap-3 hover:bg-slate-50 hover:shadow transition-all group w-full lg:w-auto"
                  title="เปิดจัดการโควตาโครงงาน"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">⚙️</span>
                  <span className="text-[14px] font-bold text-slate-700 tracking-wide whitespace-nowrap">จัดการโควตาโครงงาน</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ================= ฝั่งขวา: MAIN CONTENT ================= */}
        <div className="flex-1 w-full min-w-0 flex flex-col">
          {/* STATUS BANNER */}
          {isStudent && currentStatus === "INVITED" && (
            <div className="bg-sky-50 border border-sky-200 text-sky-800 p-4 rounded-2xl mb-5 flex items-start gap-3 shadow-sm">
              <span className="text-xl">📫</span>
              <div>
                <strong className="block font-bold">คุณมีคำเชิญเข้ากลุ่มโครงงาน</strong>
                <p className="text-[13px] text-sky-700 mt-0.5">เพื่อนได้ส่งคำเชิญให้คุณเข้าร่วมกลุ่มโครงงาน กรุณาไปที่ <button onClick={() => navigate("/advisor/requests")} className="font-bold underline hover:text-sky-900">หน้ารายการคำขอและสถานะ</button> หรือกดที่การแจ้งเตือนเพื่อตอบรับ/ปฏิเสธคำเชิญก่อนดำเนินการต่อ</p>
              </div>
            </div>
          )}

          {/* 🌟 BANNER: สำหรับหัวหน้ากลุ่ม (ผู้ยื่นคำขอ) */}
          {isStudent && currentStatus === "REQUESTING" && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 sm:p-5 rounded-2xl mb-5 flex items-start gap-3.5 shadow-sm">
              <span className="text-2xl mt-0.5">⏳</span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <strong className="text-base font-bold text-amber-900">
                    คุณอยู่ระหว่างรอผลการอนุมัติ จาก {currentUser?.pending_request?.advisor ? `${currentUser.pending_request.advisor.prefix || 'อาจารย์'}${currentUser.pending_request.advisor.first_name} ${currentUser.pending_request.advisor.last_name}` : 'อาจารย์ที่ปรึกษา'}
                  </strong>
                  <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 text-[11px] font-bold rounded-md">หัวหน้ากลุ่ม</span>
                </div>
                <p className="text-[13px] text-amber-800 leading-relaxed">
                  คุณได้ส่งคำขอโครงงาน <span className="font-bold text-amber-950">"{currentUser?.pending_request?.project_title || 'โครงงาน'}"</span> ไปยัง{" "}
                  <span className="font-bold text-amber-950">
                    {currentUser?.pending_request?.advisor ? `${currentUser.pending_request.advisor.prefix || 'อาจารย์'}${currentUser.pending_request.advisor.first_name} ${currentUser.pending_request.advisor.last_name}` : 'อาจารย์ที่ปรึกษา'}
                  </span>{" "}
                  แล้ว ระบบไม่อนุญาตให้ส่งคำขอซ้ำจนกว่าอาจารย์จะตอบรับหรือคุณยกเลิกคำขอเดิมก่อน
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => navigate("/advisor/requests")} className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5">
                    ดูสถานะคำขอ / จัดการคำขอ
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 🌟 BANNER: สำหรับสมาชิกในกลุ่ม (ผู้ถูกเพื่อนชวน) */}
          {isStudent && currentStatus === "MEMBER_PENDING" && (
            <div className="bg-sky-50 border border-sky-200 text-sky-950 p-4 sm:p-5 rounded-2xl mb-5 flex items-start gap-3.5 shadow-sm">
              <span className="text-2xl mt-0.5">📫</span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <strong className="text-base font-bold text-sky-900">
                    คุณมีคำเชิญเข้าร่วมกลุ่มโครงงาน (รอผลการอนุมัติ)
                  </strong>
                  <span className="px-2 py-0.5 bg-sky-200/80 text-sky-900 text-[11px] font-bold rounded-md">สมาชิกในกลุ่ม</span>
                </div>
                <p className="text-[13px] text-sky-800 leading-relaxed">
                  <span className="font-bold text-sky-950">
                    {currentUser?.member_pending_request?.student ? `${currentUser.member_pending_request.student.prefix || ''}${currentUser.member_pending_request.student.first_name} ${currentUser.member_pending_request.student.last_name}` : 'หัวหน้ากลุ่ม'}
                  </span>{" "}
                  ได้ระบุชื่อคุณเป็นสมาชิกในกลุ่มโครงงาน <span className="font-bold text-sky-950">"{currentUser?.member_pending_request?.project_title || 'โครงงาน'}"</span> และได้ยื่นขอเป็นที่ปรึกษากับ{" "}
                  <span className="font-bold text-sky-950">
                    {currentUser?.member_pending_request?.advisor ? `${currentUser.member_pending_request.advisor.prefix || 'อาจารย์'}${currentUser.member_pending_request.advisor.first_name} ${currentUser.member_pending_request.advisor.last_name}` : 'อาจารย์ที่ปรึกษา'}
                  </span>{" "}
                  (ขณะนี้อยู่ระหว่างรอผลการอนุมัติจากอาจารย์ที่ปรึกษา)
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => navigate("/advisor/requests")} className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5">
                    ดูรายละเอียดคำขอ
                  </button>
                </div>
              </div>
            </div>
          )}

          {isStudent && currentStatus === "REJECTED" && !isRejectedAlertDismissed && (
            <div className="relative bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl mb-5 flex items-start gap-3 shadow-sm pr-10">
              <button 
                onClick={() => setIsRejectedAlertDismissed(true)} 
                className="absolute top-3 right-3 text-rose-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-rose-100"
                title="ปิดการแจ้งเตือน"
              >
                <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <span className="text-xl">❌</span>
              <div className="flex-1">
                <strong className="block font-bold">คำเสนอโครงงานของคุณถูกปฏิเสธ</strong>
                <p className="text-[13px] text-rose-700 mt-0.5 mb-2">
                  คำขอที่คุณส่งไปยังอาจารย์ถูกปฏิเสธ โปรดลองแก้ไข/ปรับปรุงข้อมูลโครงงานแล้วส่งใหม่ หรือพิจารณาค้นหาอาจารย์ที่ปรึกษาท่านอื่น
                </p>
                {currentUser?.rejected_remark && (
                  <div className="bg-white/60 p-3 rounded-xl border border-rose-100">
                    <strong className="block text-[11px] font-bold text-rose-800 uppercase tracking-wide mb-1">หมายเหตุจากอาจารย์:</strong>
                    <p className="text-[13px] text-rose-900 leading-relaxed">{currentUser.rejected_remark}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {isStudent && currentStatus === "MATCHED" && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl mb-5 flex items-start gap-3 shadow-sm">
              <span className="text-xl">✅</span>
              <div>
                <strong className="block font-bold">คุณมีกลุ่มและอาจารย์ที่ปรึกษาโครงงานอยู่แล้ว</strong>
                <p className="text-[13px] text-emerald-700 mt-0.5">คุณได้รับการอนุมัติกลุ่มและอาจารย์ที่ปรึกษาเรียบร้อยแล้ว หากต้องการเปลี่ยนที่ปรึกษาโปรดติดต่อผู้ดูแลระบบหรือยกเลิกโปรเจกต์เดิม</p>
              </div>
            </div>
          )}

          {isStudent && currentStatus === "COMPLETED" && (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 p-4 sm:p-5 rounded-2xl mb-5 flex items-start gap-3.5 shadow-sm">
              <span className="text-2xl mt-0.5">🎓</span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <strong className="text-base font-bold text-indigo-900">
                    โครงงานของคุณเสร็จสิ้นสมบูรณ์แล้ว
                  </strong>
                  <span className="px-2.5 py-0.5 bg-indigo-200/80 text-indigo-900 text-[11px] font-extrabold rounded-md shadow-xs">
                    เสร็จสิ้นไปแล้ว {currentUser?.completed_projects_count || 1} โครงงาน
                  </span>
                </div>
                <p className="text-[13px] text-indigo-800 leading-relaxed">
                  ยินดีด้วยที่ดำเนินโครงงานสำเร็จ! คุณสามารถค้นหาอาจารย์ที่ปรึกษาและส่งคำขอเพื่อเริ่มโครงงานใหม่ หรือตอบรับคำเชิญเข้าร่วมกลุ่มโครงงานใหม่ได้ทันที
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => navigate("/project")} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                    ดูประวัติโครงงานที่ผ่านมา ({currentUser?.completed_projects_count || 1})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SEARCH & FILTER */}
          <section className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mb-6 flex flex-col lg:flex-row gap-4 items-start lg:items-end">
            <div className="flex-1 w-full">
              <label className="block text-[13px] font-bold text-slate-700 mb-1.5">ค้นหาชื่ออาจารย์</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                </span>
                <input type="text" placeholder="พิมพ์ชื่อ หรือนามสกุล..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-[14px] transition-all placeholder:text-slate-400" />
              </div>
            </div>

            {/* Dropdown Checkbox สำหรับสายที่ถนัด */}
            <div className="sm:w-80 w-full shrink-0 relative" ref={expertiseDropdownRef}>
              <label className="block text-[13px] font-bold text-slate-700 mb-1.5">สายที่ถนัด (Expertise)</label>
              
              <div 
                className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 flex justify-between items-center cursor-pointer text-[14px] transition-all relative ${isExpertiseDropdownOpen ? 'ring-2 ring-blue-500/20 border-blue-500 bg-white' : ''}`}
                onClick={() => setIsExpertiseDropdownOpen(!isExpertiseDropdownOpen)}
              >
                <span className="truncate pr-4">
                  {selectedExpertise.length > 0 
                    ? selectedExpertise.join(", ") 
                    : <span className="text-slate-400">-- เลือกทั้งหมด --</span>}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isExpertiseDropdownOpen ? "rotate-180" : ""}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {isExpertiseDropdownOpen && (
                <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[260px] overflow-y-auto py-1.5">
                  {expertiseOptionsList.map((option) => {
                    const isChecked = selectedExpertise.includes(option);
                    return (
                      <label key={option} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors group">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleExpertiseCheckboxChange(option)}
                            className="peer w-[18px] h-[18px] text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer appearance-none checked:bg-blue-600 checked:border-blue-600 transition-all shadow-sm"
                          />
                          <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className={`text-[13.5px] select-none leading-snug ${isChecked ? 'text-blue-700 font-bold' : 'text-slate-700 group-hover:text-slate-900 font-medium'}`}>
                          {option}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ADVISOR GRID */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-3"></div>
              <p className="text-slate-400 text-sm font-medium">กำลังโหลดรายชื่ออาจารย์...</p>
            </div>
          ) : filteredAdvisors.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-16 text-center">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🔍</div>
              <h3 className="text-slate-700 font-bold mb-1">ไม่พบข้อมูลอาจารย์ที่ค้นหา</h3>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {currentAdvisors.map((advisor) => {
                  const fullAdvisorName = `${advisor.prefix || "อาจารย์"}${advisor.first_name} ${advisor.last_name}`;
                  const requestStatusInfo = getRequestStatus(advisor);
                  const { disabled: isBtnDisabled, text: btnText, isWaitlist } = requestStatusInfo;
                  
                  const maxG = advisor.max_groups || 999;
                  const curG = advisor.current_groups || 0;

                  return (
                    <div key={advisor.auth_id} className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col h-full overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-indigo-500/20 hover:-translate-y-1 transition-all duration-300 group">
                      <div className="p-5 sm:p-6 flex flex-col items-center text-center border-b border-slate-50/50 flex-1 relative">
                        <div className="w-[90px] h-[90px] rounded-full overflow-hidden mb-4 bg-slate-50 ring-4 ring-slate-50/50 shadow-md group-hover:scale-[1.03] transition-transform duration-300 shrink-0">
                          {advisor.profile_image ? <img src={advisor.profile_image} alt={fullAdvisorName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-600 font-bold text-3xl">{advisor.first_name?.charAt(0)}</div>}
                        </div>
                        
                        <h3 className="text-[17px] font-extrabold text-slate-900 mb-2 truncate w-full px-2 group-hover:text-indigo-700 transition-colors">{fullAdvisorName}</h3>
                        
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-5">
                          {advisor.role && <span className="text-[11px] px-2.5 py-0.5 bg-slate-100/80 text-slate-600 rounded-full font-semibold border border-slate-200/50">{getDisplayRole(advisor.role)}</span>}
                          
                          {advisor.is_accepting_students === false ? (
                            <span className="text-[11px] px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full font-bold">ปิดรับชั่วคราว</span>
                          ) : (
                            <>
                              <span className="text-[11px] px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200/60 rounded-full font-bold">เปิดรับ นศ.</span>
                              {maxG > 0 && maxG < 999 && (
                                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${curG >= maxG ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                                  ดูแลแล้ว {curG}/{maxG} กลุ่ม
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        <div className="mt-auto w-full pt-1">
                          <div className="flex items-start gap-2.5 bg-slate-50/60 p-3.5 rounded-2xl border border-slate-100/50 group-hover:bg-indigo-50/30 group-hover:border-indigo-100/50 transition-colors text-left">
                            <div className="w-6 h-6 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0 mt-0.5 group-hover:border-indigo-200">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600 transition-colors shrink-0"><path fillRule="evenodd" d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z" clipRule="evenodd" /></svg>
                            </div>
                            <div className="min-w-0">
                              <strong className="block text-slate-800 text-[11px] font-bold mb-0.5 group-hover:text-indigo-900 transition-colors">ความเชี่ยวชาญ</strong> 
                              <p className="text-[12px] text-slate-600 truncate">{advisor.expertise || "ไม่ระบุข้อมูล"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-white border-t border-slate-100 flex gap-2.5">
                        <button onClick={() => handleOpenProfile(advisor)} className="w-auto px-4 py-2.5 rounded-xl text-[12.5px] font-bold bg-slate-50 border border-slate-200/80 text-slate-500 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-800 transition-all shrink-0" title="ดูโปรไฟล์">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" /></svg>
                        </button>
                        
                        <button 
                          onClick={() => handleOpenRequest(advisor)} 
                          disabled={isBtnDisabled} 
                          className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
                            isBtnDisabled 
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                              : isWaitlist
                              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                              : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                          }`}
                        >
                          {btnText}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex justify-center items-center gap-4">
                  <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">← ก่อนหน้า</button>
                  <span className="text-sm font-semibold text-slate-600 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">หน้า {currentPage} จาก {totalPages}</span>
                  <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">ถัดไป →</button>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </main>

      {/* ================= MODAL PROFILE ================= */}
      {isProfileModalOpen && selectedAdvisor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
              <h2 className="text-[16px] font-bold text-slate-800">ข้อมูลอาจารย์ที่ปรึกษา</h2>
              <button onClick={handleCloseProfile} className="text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 hover:bg-rose-50 rounded-full p-1.5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-start mb-8">
                <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[2rem] overflow-hidden bg-slate-100 border-[4px] border-white shadow-xl shrink-0">
                  {selectedAdvisor.profile_image ? <img src={selectedAdvisor.profile_image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600 font-bold text-5xl">{selectedAdvisor.first_name?.charAt(0)}</div>}
                </div>
                <div className="text-center sm:text-left w-full mt-2">
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">{selectedAdvisor.prefix || "อาจารย์"}{selectedAdvisor.first_name} {selectedAdvisor.last_name}</h3>
                  
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-5">
                    <span className="text-[12px] px-3 py-1 bg-slate-100 text-slate-600 rounded-full font-bold">{getDisplayRole(selectedAdvisor.role)}</span>
                    {selectedAdvisor.is_accepting_students === false ? (
                      <span className="text-[12px] px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-full font-bold">ปิดรับชั่วคราว</span>
                    ) : (
                      <>
                        <span className="text-[12px] px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full font-bold">เปิดรับนักศึกษา</span>
                        {selectedAdvisor.max_groups > 0 && selectedAdvisor.max_groups < 999 && (
                          <span className={`text-[12px] px-3 py-1 rounded-full font-bold border ${selectedAdvisor.current_groups >= selectedAdvisor.max_groups ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                            ดูแลแล้ว {selectedAdvisor.current_groups || 0}/{selectedAdvisor.max_groups} กลุ่ม
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2 text-left">
                    <p className="text-[14px] text-slate-600 flex items-start gap-2"><strong className="font-bold text-slate-800 w-12 shrink-0">คณะ:</strong> <span className="leading-snug">{selectedAdvisor.faculty || "-"}</span></p>
                    <p className="text-[14px] text-slate-600 flex items-start gap-2"><strong className="font-bold text-slate-800 w-12 shrink-0">สาขา:</strong> <span className="leading-snug">{selectedAdvisor.major || "-"}</span></p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-50">
                  <h4 className="text-[14px] font-bold text-blue-900 mb-2">ความเชี่ยวชาญ (Expertise)</h4>
                  <p className="text-[14px] text-slate-700 font-light leading-relaxed">{selectedAdvisor.expertise || "ไม่มีข้อมูลระบุ"}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                  <h4 className="text-[14px] font-bold text-slate-800 mb-2">ประวัติ / ข้อมูลเพิ่มเติม (Bio)</h4>
                  <p className="text-[14px] text-slate-600 font-light leading-relaxed whitespace-pre-line">{selectedAdvisor.bio || "ไม่มีข้อมูลประวัติ"}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 border-t border-slate-100 p-4 sm:px-6 flex gap-3 justify-end shrink-0">
              <button onClick={handleCloseProfile} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-[13px] shadow-sm">ปิดหน้าต่าง</button>
              
              {(() => {
                const requestStatusInfo = getRequestStatus(selectedAdvisor);
                return (
                  <button 
                    onClick={() => handleOpenRequest(selectedAdvisor)} 
                    disabled={requestStatusInfo.disabled} 
                    className={`px-6 py-2.5 rounded-xl font-bold text-white flex items-center gap-2 text-[13px] transition-all shadow-sm ${
                      requestStatusInfo.disabled 
                        ? "bg-slate-300 cursor-not-allowed" 
                        : requestStatusInfo.isWaitlist
                        ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 hover:shadow-md"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 hover:shadow-md"
                    }`}
                  >
                    {requestStatusInfo.text}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL ส่งคำขอ ================= */}
      {isRequestModalOpen && selectedAdvisor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
            <div className={`px-6 py-4 flex items-center justify-between shrink-0 ${getRequestStatus(selectedAdvisor).isWaitlist ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-blue-600 to-sky-500'}`}>
              <h2 className="text-[16px] font-bold text-white flex items-center gap-2">
                {getRequestStatus(selectedAdvisor).isWaitlist ? "⚠️ เสนอโครงงาน (ตัวสำรอง/Waitlist)" : "เสนอโครงงานถึงที่ปรึกษา"}
              </h2>
              <button onClick={handleCloseRequest} className="text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center font-bold text-blue-600 shadow-sm border border-blue-100 shrink-0 overflow-hidden">
                    {selectedAdvisor.profile_image ? <img src={selectedAdvisor.profile_image} alt="" className="w-full h-full object-cover" /> : <span className="text-xl">{selectedAdvisor.first_name?.charAt(0)}</span>}
                 </div>
                 <div>
                   <p className="text-[12px] font-bold text-blue-500 uppercase tracking-wide mb-0.5">ผู้รับคำขอ {selectedAdvisor.role ? `(${getDisplayRole(selectedAdvisor.role)})` : ""}</p>
                   <p className="font-bold text-slate-800 text-[15px]">{selectedAdvisor.prefix || "อาจารย์"}{selectedAdvisor.first_name} {selectedAdvisor.last_name}</p>
                 </div>
              </div>

              <form id="requestForm" onSubmit={handleSubmitRequest} className="space-y-5">
                {/* 1. ชื่อโปรเจกต์ (เต็มบรรทัด) */}
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">ชื่อโปรเจกต์ <span className="text-rose-500">*</span></label>
                  <input type="text" required value={formData.project_title} onChange={(e) => setFormData({...formData, project_title: e.target.value})} placeholder="ระบุชื่อหรือหัวข้อโปรเจกต์ของคุณ" className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-[14px] transition-all placeholder:font-light" />
                </div>

                {/* 2. ภาษาที่ใช้พัฒนา & ลิงก์ Drive (แบ่ง 2 คอลัมน์) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-bold text-slate-700 mb-1.5">ภาษา / เครื่องมือที่ใช้พัฒนา</label>
                    <input type="text" value={formData.language_used} onChange={(e) => setFormData({...formData, language_used: e.target.value})} placeholder="เช่น React, Python, Flutter" className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-[13.5px] transition-all placeholder:font-light" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-slate-700 mb-1.5">ลิงก์ Google Drive / Diagram</label>
                    <input type="url" value={formData.diagram_url} onChange={(e) => setFormData({...formData, diagram_url: e.target.value})} placeholder="วางลิงก์เอกสารอ้างอิง (ถ้ามี)" className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-[13.5px] transition-all placeholder:font-light" />
                    {extractDriveFileId(formData.diagram_url) && <p className="text-[11px] text-emerald-600 mt-1.5 ml-1 font-bold flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg> ลิงก์ Drive ถูกต้อง</p>}
                  </div>
                </div>

                {/* 3. ขอบเขตของงาน (เปลี่ยนเป็น Textarea เต็มบรรทัด) */}
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">ขอบเขตของงาน (Project Scope)</label>
                  <textarea 
                    value={formData.project_scope} 
                    onChange={(e) => setFormData({...formData, project_scope: e.target.value})} 
                    placeholder="อธิบายขอบเขต ฟีเจอร์หลัก หรือสิ่งที่จะพัฒนาในโครงงานนี้..." 
                    rows="3" 
                    className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-[13.5px] resize-none transition-all placeholder:font-light"
                  ></textarea>
                </div>

                {/* 4. สมาชิกในกลุ่ม (เพิ่ม Autocomplete) */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-[13px] font-bold text-slate-700">สมาชิกในกลุ่ม (ค้นหาจากชื่อ หรืออีเมล)</label>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wide">ตัวเลือกเสริม</span>
                  </div>
                  <div className="space-y-2.5">
                    {formData.members.map((member, index) => (
                      <div key={index} className="flex flex-col relative w-full">
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={member.name} 
                            onChange={e => fetchEmailSuggestions(index, e.target.value)} 
                            onFocus={e => fetchEmailSuggestions(index, e.target.value)}
                            onBlur={() => setTimeout(() => setActiveSuggestionIndex(null), 200)}
                            placeholder={`พิมพ์ชื่อ หรืออีเมลเพื่อนคนที่ ${index + 1} (ถ้ามี)`} 
                            autoComplete="off"
                            className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-[13.5px] transition-all placeholder:font-light" 
                          />
                          {formData.members.length > 1 && (
                            <button type="button" onClick={() => removeMemberField(index)} className="w-9 h-9 text-rose-500 bg-white hover:bg-rose-50 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                            </button>
                          )}
                        </div>

                        {/* 🌟 Autocomplete Dropdown 🌟 */}
                        {activeSuggestionIndex === index && emailSuggestions.length > 0 && (
                          <ul className="absolute top-[100%] left-0 w-[calc(100%-44px)] mt-1.5 bg-white border border-slate-200 shadow-xl rounded-xl z-[100] overflow-hidden divide-y divide-slate-50">
                            {emailSuggestions.map((sug, i) => (
                              <li 
                                key={i} 
                                onClick={() => handleSelectSuggestion(index, sug)} 
                                className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors"
                              >
                                {sug.profile_image ? (
                                  <img src={sug.profile_image} className="w-8 h-8 rounded-full object-cover border border-slate-100 shrink-0" alt="" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[12px] border border-slate-200">👤</div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[13px] font-bold text-slate-700 truncate">{sug.first_name} {sug.last_name}</span>
                                  <span className="text-[11px] text-slate-500 truncate">{sug.email}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addMemberField} className="mt-3 text-[12px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors px-2 py-1 hover:bg-blue-50 rounded-lg w-fit">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> เพิ่มช่องกรอกสมาชิก
                  </button>
                </div>

                {/* 5. คำอธิบายเพิ่มเติม */}
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">คำอธิบายเพิ่มเติม / ข้อความถึงอาจารย์</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="ข้อความฝากถึงอาจารย์ หรือสิ่งที่คาดหวังจากโปรเจกต์นี้..." rows="3" className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-[13.5px] resize-none transition-all placeholder:font-light"></textarea>
                </div>
              </form>
            </div>
            
            <div className="bg-slate-50 border-t border-slate-100 p-4 sm:px-6 flex gap-3 justify-end shrink-0">
              <button type="button" onClick={handleCloseRequest} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-[13px] shadow-sm">ยกเลิก</button>
              <button form="requestForm" type="submit" disabled={isSubmitting || !formData.project_title.trim()} className={`px-6 py-2.5 rounded-xl font-bold text-white flex items-center gap-2 text-[13px] transition-all shadow-sm ${isSubmitting || !formData.project_title.trim() ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 hover:shadow-md"}`}>
                {isSubmitting ? "กำลังส่ง..." : "ส่งคำขอโครงงาน"}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
