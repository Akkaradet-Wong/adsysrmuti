// =============================================
// src/pages/Classroom.jsx 
// =============================================
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Header from "../components/Header";
import { Icon, Avatar, ModalShell, PdfFileRow } from "../components/SharedUI";
import Swal from "sweetalert2";
import ProjectScopeViewer from "../components/ProjectScopeViewer";

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

const escapeHtml = (unsafe) => {
  return (unsafe || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export default function Classroom() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [room, setRoom] = useState(null);
  const [students, setStudents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [advisorName, setAdvisorName] = useState("");
  const [advisorInfo, setAdvisorInfo] = useState(null); 

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState([]);
  const hasShownPendingPopup = useRef(false);
  const prevPendingCount = useRef(0);

  const [isAllAnnouncementsOpen, setIsAllAnnouncementsOpen] = useState(false);
  const maxAnnouncementsToShow = 3;

  const [activeMenuId, setActiveMenuId] = useState(null);

  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [reportsData, setReportsData] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const [isWeeklyOverviewOpen, setIsWeeklyOverviewOpen] = useState(false);
  const [overviewWeek, setOverviewWeek] = useState(1);
  const [weeklyOverviewData, setWeeklyOverviewData] = useState([]);
  const [loadingWeeklyOverview, setLoadingWeeklyOverview] = useState(false);

  const [projectInfo, setProjectInfo] = useState(null);
  const [loadingProjectInfo, setLoadingProjectInfo] = useState(false);
  const [isProjectDetailModalOpen, setIsProjectDetailModalOpen] = useState(false);
  const [projectDetailData, setProjectDetailData] = useState(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [selectedStudentsToInvite, setSelectedStudentsToInvite] = useState([]);
  const [isSearchingInvite, setIsSearchingInvite] = useState(false);

  const isOwner = room?.advisor_id === profile?.auth_id;
  const isAdvisorRole = profile?.role?.toUpperCase() === "ADVISOR" || profile?.role?.toUpperCase() === "ADMIN";
  const isAdmin = profile?.role?.toUpperCase() === "ADMIN";

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/login");
          return;
        }
        setUser(session.user);

        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (profileData) setProfile(profileData);
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };
    fetchUserAndProfile();
  }, [navigate]);

  // Moved fetchRoomData above useEffect and removed setState-in-effect warning

  useEffect(() => {
    const fetchFullProjectDetails = async () => {
      if (isModalOpen && selectedStudent?.project_id) {
        setLoadingProjectInfo(true);
        try {
          const { data: pData } = await supabase.from('projects').select('*').eq('project_id', selectedStudent.project_id).single();
          
          if (pData) {
            const { data: mData } = await supabase.from('project_members')
              .select('users(auth_id, prefix, first_name, last_name, account_code)')
              .eq('project_id', selectedStudent.project_id);

            let advName = "-";
            let coAdvName = "-";
            let leaderName = "";

            if (pData.advisor_id) {
               const {data: adv} = await supabase.from('users').select('prefix, first_name, last_name').eq('auth_id', pData.advisor_id).single();
               if (adv) advName = `${adv.prefix || ''}${adv.first_name} ${adv.last_name}`;
            }
            if (pData.co_advisor_id) {
               const {data: coAdv} = await supabase.from('users').select('prefix, first_name, last_name').eq('auth_id', pData.co_advisor_id).single();
               if (coAdv) coAdvName = `${coAdv.prefix || ''}${coAdv.first_name} ${coAdv.last_name}`;
            }
            if (pData.leader_id) {
               const {data: leader} = await supabase.from('users').select('prefix, first_name, last_name, account_code').eq('auth_id', pData.leader_id).single();
               if (leader) leaderName = `${leader.prefix || ''}${leader.first_name} ${leader.last_name}`;
            }

            setProjectInfo({
              ...pData,
              advisorName: advName,
              coAdvisorName: coAdvName,
              leaderName: leaderName,
              members: mData?.map(m => m.users).filter(u => u && u.auth_id !== pData.leader_id) || []
            });
          }
        } catch (err) {
          console.error("Error fetching project info:", err);
        }
        setLoadingProjectInfo(false);
      } else {
        setProjectInfo(null);
      }
    };
    fetchFullProjectDetails();
  }, [isModalOpen, selectedStudent]);

  const fetchRoomData = useCallback(async () => {
    if (!profile || !id) return;
    try {
      const { data: roomData, error: roomError } = await supabase
        .from("project_rooms")
        .select(`*, users (auth_id, email, prefix, first_name, last_name, role, profile_image, phone, bio, expertise)`)
        .eq("room_id", id)
        .single();
      if (roomError) throw roomError;

      const { data: members, error: membersError } = await supabase
        .from("room_members")
        .select(`
          id, joined_at, status,
          users (
            auth_id, email, prefix, first_name, last_name, role, 
            account_code, profile_image, phone, bio, faculty, major, expertise
          )
        `)
        .eq("room_id", id)
        .order("joined_at", { ascending: true });
      if (membersError) throw membersError;

      const isRoomOwner = roomData.advisor_id === profile.auth_id;
      const isAdminCheck = profile.role?.toUpperCase() === "ADMIN";
      const isAdvisorCheck = profile.role?.toUpperCase() === "ADVISOR" || profile.requested_role === "ADVISOR";
      const myMemberRecord = members.find((m) => {
        const u = Array.isArray(m.users) ? m.users[0] : m.users;
        return u?.auth_id === profile.auth_id;
      });

      if (!isRoomOwner && !isAdminCheck && !isAdvisorCheck) {
        if (!myMemberRecord) {
          Swal.fire({ title: "ปฏิเสธการเข้าถึง", text: "คุณยังไม่ได้เข้าร่วมห้องเรียนนี้ กรุณากดขอเข้าร่วมก่อน", icon: "warning", confirmButtonColor: "#2563eb", confirmButtonText: "กลับไปหน้ารายวิชา" });
          navigate("/create-room");
          return;
        } else if (myMemberRecord.status === 'pending') {
          Swal.fire({ title: "รอการอนุมัติ", text: "คำขอเข้าร่วมห้องเรียนของคุณกำลังรออาจารย์ยืนยัน", icon: "info", confirmButtonColor: "#f59e0b", confirmButtonText: "รับทราบ" });
          navigate("/create-room");
          return;
        }
      }

      setRoom(roomData);
      
      const activeList = [];
      const pendingList = [];
      let advisorAuthId = roomData.advisor_id;

      if (roomData.users) {
        const advInfo = Array.isArray(roomData.users) ? roomData.users[0] : roomData.users;
        if (advInfo) {
          setAdvisorName(`${advInfo.prefix || ''}${advInfo.first_name || ''} ${advInfo.last_name || ''}`);
          setAdvisorInfo(advInfo);
        }
      }

      const studentIds = members.map((m) => {
        const u = Array.isArray(m.users) ? m.users[0] : m.users;
        return u?.auth_id;
      }).filter(Boolean).filter(sid => sid !== advisorAuthId);

      let allProjects = [];
      let projectMemberships = [];
      let allRequests = [];

      if (studentIds.length > 0) {
        const { data: leaderProjects } = await supabase.from("projects").select("project_id, title, status, leader_id, project_code, created_at, advisor:users!projects_advisor_id_fkey(prefix, first_name, last_name)").in("leader_id", studentIds).neq("status", "cancelled").order("created_at", { ascending: false });
        allProjects = leaderProjects || [];

        const { data: memberData } = await supabase.from("project_members").select(`student_id, joined_at, projects (project_id, title, status, leader_id, project_code, created_at, advisor:users!projects_advisor_id_fkey(prefix, first_name, last_name))`).in("student_id", studentIds).eq("status", "approved").order("joined_at", { ascending: false });
        projectMemberships = memberData || [];

        const { data: reqData } = await supabase.from("requests").select("student_id, status, project_title, created_at").in("student_id", studentIds).order("created_at", { ascending: false });
        allRequests = reqData || [];
      }

      members.forEach((m) => {
        const u = Array.isArray(m.users) ? m.users[0] : m.users;
        if (!u) return;

        const studentId = u.auth_id;
        if (studentId === advisorAuthId) return;

        // Collect all projects this student is part of
        const studentProjects = [];

        // As leader
        allProjects.forEach(p => {
           if (p.leader_id === studentId && p.status !== "cancelled") {
              studentProjects.push({ ...p, __date: new Date(p.created_at || 0).getTime() });
           }
        });

        // As member
        projectMemberships.forEach(pm => {
           if (pm.student_id === studentId) {
              const proj = Array.isArray(pm.projects) ? pm.projects[0] : pm.projects;
              if (proj && proj.status !== "cancelled") {
                 studentProjects.push({ ...proj, __date: new Date(pm.joined_at || proj.created_at || 0).getTime() });
              }
           }
        });

        // Sort: active (not completed) first, then by date descending
        studentProjects.sort((a, b) => {
           const isActiveA = (a.status !== 'completed' && a.status !== 'cancelled') ? 1 : 0;
           const isActiveB = (b.status !== 'completed' && b.status !== 'cancelled') ? 1 : 0;
           if (isActiveA !== isActiveB) return isActiveB - isActiveA;
           return b.__date - a.__date;
        });

        let myProject = studentProjects.length > 0 ? studentProjects[0] : null;

        let displayStatus = "none";
        let displayTitle = null;
        let displayCode = null;
        let displayAdvisor = null;

        const myReq = allRequests.find(r => r.student_id === studentId && ['pending', 'rejected'].includes(r.status.trim().toLowerCase()));

        let useRequest = false;
        if (!myProject) {
          useRequest = true;
        } else if (myProject.status === 'completed' && myReq) {
          const projDate = myProject.__date || 0;
          const reqDate = new Date(myReq.created_at || 0).getTime();
          if (reqDate > projDate) {
            useRequest = true;
          }
        }

        if (myProject && !useRequest) {
          const s = myProject.status.trim().toLowerCase();
          if (s === 'approved') displayStatus = 'approved';
          else if (s === 'pending' || s === 'requested') displayStatus = 'pending';
          else if (s === 'rejected') displayStatus = 'rejected';
          else if (s === 'completed') displayStatus = 'completed';
          else if (s === 'in_progress' || s === 'in-progress' || s === 'ongoing') displayStatus = 'in-progress';
          else displayStatus = s;

          displayTitle = myProject.title;
          displayCode = myProject.project_code;
          if (myProject.advisor) {
            const adv = Array.isArray(myProject.advisor) ? myProject.advisor[0] : myProject.advisor;
            if (adv) displayAdvisor = `${adv.prefix || ''}${adv.first_name || ''} ${adv.last_name || ''}`.trim();
          }
        } else if (myReq && useRequest) {
          const s = myReq.status.trim().toLowerCase();
          if (s === 'pending') displayStatus = 'requested';
          else if (s === 'rejected') displayStatus = 'rejected';
          displayTitle = myReq.project_title;
        }

        const studentObj = { 
          ...u, 
          member_id: m.id, 
          project_status: displayStatus, 
          project_title: displayTitle, 
          project_code: displayCode,
          project_id: myProject?.project_id,
          project_advisor: displayAdvisor
        };

        if (m.status === 'pending') pendingList.push(studentObj);
        else activeList.push(studentObj);
      });
      // Sort activeList by project_id so that members of the same group are adjacent
      activeList.sort((a, b) => {
        if (!a.project_id && !b.project_id) {
          return (a.account_code || "").localeCompare(b.account_code || "");
        }
        if (!a.project_id) return 1;
        if (!b.project_id) return -1;
        if (a.project_id < b.project_id) return -1;
        if (a.project_id > b.project_id) return 1;
        return (a.account_code || "").localeCompare(b.account_code || "");
      });

      setStudents(activeList);
      setPendingRequests(pendingList);

      const { data: annData, error: annError } = await supabase
        .from("project_messages")
        .select(`message_id, content, file_url, created_at, sender_id, users (prefix, first_name, last_name)`)
        .eq("room_id", id)
        .like("content", "#ANNOUNCEMENT# %")
        .order("created_at", { ascending: false });

      if (annError) console.error("Error fetching announcements:", annError);
      else setAnnouncements(annData || []);

    } catch (error) {
      console.error("Error fetching room details:", error);
      Swal.fire("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลห้องเรียนได้", "error");
    } finally {
      setLoading(false);
    }
  }, [id, profile, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile && id) fetchRoomData();

    const handleClickOutside = (event) => {
      if (!event.target.closest(".action-menu-container")) setActiveMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profile, id, fetchRoomData]);

  useEffect(() => {
    if ((isOwner || isAdmin) && !loading) {
      if (pendingRequests.length > 0) {
        if (!hasShownPendingPopup.current || pendingRequests.length > prevPendingCount.current) {
          setIsPendingModalOpen(true);
          hasShownPendingPopup.current = true;
        }
      }
    }
    prevPendingCount.current = pendingRequests.length;
  }, [pendingRequests.length, isOwner, isAdmin, loading]);

  // ================= REALTIME SUBSCRIPTIONS =================
  useEffect(() => {
    if (!id) return;
    
    const channel = supabase.channel(`realtime-classroom-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${id}` }, (payload) => {
        console.log("Realtime room_members update in Classroom:", payload);
        fetchRoomData();
        if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
          setIsPendingModalOpen(true);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_reports' }, (payload) => {
        console.log("Realtime project_reports update in Classroom:", payload);
        fetchRoomData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        console.log("Realtime projects update in Classroom:", payload);
        fetchRoomData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile]);

  const handleViewReports = async (student) => {
    setSelectedStudent(student);
    setIsReportsModalOpen(true);
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from("project_reports")
        .select("*")
        .eq("project_id", student.project_id)
        .order("week_number", { ascending: true });
        
      if (error) throw error;
      setReportsData(data || []);
    } catch (err) {
      console.error("Error fetching reports:", err);
      Swal.fire("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลการส่งงานได้", "error");
    } finally {
      setLoadingReports(false);
    }
  };

  const handleViewProjectDetail = async (projectId) => {
    setIsProjectDetailModalOpen(true);
    setLoadingProjectInfo(true);
    try {
      if (!projectId) throw new Error("No project ID");

      const { data: projectData, error: projErr } = await supabase
        .from("projects")
        .select("*")
        .eq("project_id", projectId)
        .single();
        
      if (projErr) throw projErr;

      let requestData = null;
      if (projectData.leader_id && projectData.advisor_id) {
        const { data: req } = await supabase
          .from("requests")
          .select("*")
          .eq("student_id", projectData.leader_id)
          .eq("advisor_id", projectData.advisor_id)
          .eq("project_title", projectData.title)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        requestData = req;
      }
      
      const { data: membersData } = await supabase
        .from("project_members")
        .select(`
          role,
          status,
          users (
            auth_id, first_name, last_name, profile_image, role, faculty, major
          )
        `)
        .eq("project_id", projectId);

      setProjectDetailData({ 
        projectData, 
        originalRequest: requestData,
        members: membersData || []
      });
    } catch (err) {
      console.error("Error fetching project details:", err);
      Swal.fire("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลรายละเอียดโครงงานได้", "error");
      setIsProjectDetailModalOpen(false);
    } finally {
      setLoadingProjectInfo(false);
    }
  };

  // 🌟 ฟังก์ชันสำหรับเพิ่ม/แก้ไขข้อเสนอแนะของอาจารย์ประจำวิชา (บันทึกลง instructor_feedback)
  const handleAddFeedback = async (reportId, currentFeedback, weekNumber) => {
    const { value: feedback } = await Swal.fire({
      title: `📝 เพิ่มข้อเสนอแนะ สัปดาห์ที่ ${weekNumber}`,
      input: "textarea",
      inputValue: currentFeedback || "",
      inputPlaceholder: "พิมพ์ข้อเสนอแนะให้แก่นักศึกษาสำหรับสัปดาห์นี้...",
      showCancelButton: true, reverseButtons: true,
      confirmButtonText: "บันทึกข้อเสนอแนะ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#4f46e5", // Indigo-600 to match Project.jsx
      cancelButtonColor: "#F1F5F9",
      customClass: {
        popup: '!rounded-2xl',
        input: '!rounded-xl !border-slate-300 focus:!border-indigo-500 focus:!ring-indigo-500 !min-h-[100px] !text-[13.5px]',
        cancelButton: '!text-slate-700 font-bold'
      }
    });

    if (feedback !== undefined) {
      try {
        Swal.fire({ title: "กำลังบันทึก...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // 🌟 เปลี่ยนให้บันทึกลงคอลัมน์ instructor_feedback
        const { error } = await supabase
          .from("project_reports")
          .update({ instructor_feedback: feedback })
          .eq("report_id", reportId);

        if (error) throw error;

        // อัปเดตข้อมูล State ในหน้าจอ Modal รายบุคคล
        setReportsData((prev) =>
          prev.map((r) => (r.report_id === reportId ? { ...r, instructor_feedback: feedback } : r))
        );

        // อัปเดตข้อมูล State ในหน้าจอ Weekly Overview
        setWeeklyOverviewData((prev) =>
          prev.map((s) =>
            s.report?.report_id === reportId
              ? { ...s, report: { ...s.report, instructor_feedback: feedback } }
              : s
          )
        );

        Swal.fire({
          title: "บันทึกสำเร็จ!",
          icon: "success",
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 1500
        });
      } catch (err) {
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถบันทึกข้อเสนอแนะได้: " + err.message, "error");
      }
    }
  };

  const handleOpenWeeklyOverview = async (week = overviewWeek) => {
    setIsWeeklyOverviewOpen(true);
    setLoadingWeeklyOverview(true);
    setOverviewWeek(week);

    try {
      const projectIds = students
        .map(s => s.project_id)
        .filter(id => id != null);

      if (projectIds.length === 0) {
        setWeeklyOverviewData(students.filter(s => s.role?.toUpperCase() !== 'ADVISOR' && s.role?.toUpperCase() !== 'ADMIN').map(s => ({ ...s, report: null })));
        setLoadingWeeklyOverview(false);
        return;
      }

      const { data: reports, error } = await supabase
        .from("project_reports")
        .select("*")
        .in("project_id", projectIds)
        .eq("week_number", week);

      if (error) throw error;

      const overview = students.map(student => {
        const report = reports?.find(r => r.project_id === student.project_id);
        return {
          ...student,
          report: report || null
        };
      });

      const studentOnlyOverview = overview.filter(s => s.role?.toUpperCase() !== 'ADVISOR' && s.role?.toUpperCase() !== 'ADMIN');

      setWeeklyOverviewData(studentOnlyOverview);
    } catch (err) {
      console.error("Error fetching weekly overview:", err);
      Swal.fire("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลภาพรวมได้", "error");
    } finally {
      setLoadingWeeklyOverview(false);
    }
  };

  const handlePostAnnouncement = async () => {
    const { value: formValues } = await Swal.fire({
      title: "สร้างประกาศใหม่",
      html:
        `<div style="text-align:left; font-weight:500; font-size:14px; margin-bottom:5px; color:#475569;">หัวข้อประกาศ</div>` +
        `<input id="swal-ann-title" class="swal2-input !mt-0 !mb-4 !rounded-xl !border-slate-300 focus:!border-blue-500 focus:!ring-blue-500" placeholder="เช่น ส่งรายงานความคืบหน้าสัปดาห์ที่ 5">` +
        `<div style="text-align:left; font-weight:500; font-size:14px; margin-bottom:5px; color:#475569;">ลิงก์เอกสาร (Google Drive, Dropbox ฯลฯ)</div>` +
        `<input id="swal-ann-link" class="swal2-input !mt-0 !rounded-xl !border-slate-300 focus:!border-blue-500 focus:!ring-blue-500" placeholder="https://...">`,
      focusConfirm: false, showCancelButton: true, reverseButtons: true, confirmButtonText: "โพสต์ประกาศ", cancelButtonText: "ยกเลิก", confirmButtonColor: "#2563eb",
      customClass: { popup: '!rounded-3xl' },
      preConfirm: () => {
        const title = document.getElementById("swal-ann-title").value.trim();
        const link = document.getElementById("swal-ann-link").value.trim();
        if (!title) { Swal.showValidationMessage("กรุณากรอกหัวข้อประกาศ"); return false; }
        if (!link || !link.startsWith("http")) { Swal.showValidationMessage("กรุณากรอกลิงก์ให้ถูกต้อง"); return false; }
        return { title, link };
      }
    });

    if (!formValues) return;
    Swal.fire({ title: "กำลังโพสต์ประกาศ...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let inserted;
    try {
      const { data, error } = await supabase
        .from("project_messages")
        .insert({ room_id: id, content: `#ANNOUNCEMENT# ${formValues.title}`, file_url: formValues.link, sender_id: profile.email })
        .select(`message_id, content, file_url, created_at, sender_id, users (prefix, first_name, last_name)`).single();
      if (error) throw error;
      inserted = data;
    } catch (err) {
      Swal.fire("ข้อผิดพลาด", "ไม่สามารถโพสต์ประกาศได้: " + err.message, "error");
      return;
    }

    setAnnouncements(prev => [inserted, ...prev]);

    try {
      const studentEmails = students.filter((s) => s.role?.toUpperCase() !== "ADVISOR" && s.role?.toUpperCase() !== "ADMIN" && s.email).map((s) => s.email);
      if (studentEmails.length > 0) {
        const notifications = studentEmails.map(email => ({ user_id: email, message: `แจ้งเตือน: อาจารย์โพสต์ประกาศใหม่ "${formValues.title}" ในห้องเรียน "${room?.title}"` }));
        await supabase.from("notifications").insert(notifications);
      }
    } catch (notifyErr) { console.error("Error notifying students:", notifyErr); }

    Swal.fire({ title: "สำเร็จ!", text: "โพสต์ประกาศเรียบร้อยแล้ว", icon: "success", customClass: { confirmButton: '!bg-blue-600 !rounded-xl' }});
  };

  const handleDeleteAnnouncement = async (messageId) => {
    const result = await Swal.fire({ title: "ลบประกาศนี้?", text: "การลบไม่สามารถกู้คืนได้", icon: "warning", showCancelButton: true, reverseButtons: true, confirmButtonColor: "#EF4444", cancelButtonColor: "#F1F5F9", confirmButtonText: "ลบประกาศ", cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>", customClass: { popup: '!rounded-3xl' } });
    if (!result.isConfirmed) return;
    try {
      const { error } = await supabase.from("project_messages").delete().eq("message_id", messageId);
      if (error) throw error;
      setAnnouncements(prev => prev.filter(a => a.message_id !== messageId));
      Swal.fire({ title: "ลบสำเร็จ", icon: "success", toast: true, position: "bottom-end", showConfirmButton: false, timer: 1500 });
      if (announcements.length - 1 <= maxAnnouncementsToShow) setIsAllAnnouncementsOpen(false);
    } catch (err) { Swal.fire("เกิดข้อผิดพลาด", err.message, "error"); }
  };

  const handleViewAnnouncement = (title, url) => {
    Swal.fire({
      title: "แน่ใจหรือไม่?",
      text: "คุณแน่ใจใช่ไหมที่จะเปิดลิงก์/ไฟล์นี้?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563EB",
      cancelButtonColor: "#F1F5F9",
      confirmButtonText: "ใช่, เปิดไฟล์",
      cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>",
      reverseButtons: true,
      customClass: { popup: "!rounded-[24px] !p-6" }
    }).then((result) => {
      if (result.isConfirmed) {
        window.open(url, "_blank");
      }
    });
  };

  const handleSearchStudentsForInvite = async (query) => {
    setInviteSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setInviteSearchResults([]);
      return;
    }
    setIsSearchingInvite(true);
    try {
      const memberIds = students.map(s => s.auth_id);
      const selectedIds = selectedStudentsToInvite.map(s => s.auth_id);
      let q = supabase
        .from("users")
        .select("auth_id, first_name, last_name, prefix, account_code, profile_image")
        .eq("role", "STUDENT")
        .or(`account_code.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(10);
      
      const { data, error } = await q;
      if (error) throw error;
      
      const filtered = data.filter(u => !memberIds.includes(u.auth_id) && !selectedIds.includes(u.auth_id));
      setInviteSearchResults(filtered);
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
    if (inviteSearchQuery.trim().length >= 2) {
      setInviteSearchResults(prev => {
        if (!prev.some(s => s.auth_id === student.auth_id)) {
          return [student, ...prev];
        }
        return prev;
      });
    }
  };

  const handleInviteMultipleStudents = async () => {
    if (selectedStudentsToInvite.length === 0) return;

    const result = await Swal.fire({
      title: "ยืนยันการเพิ่มนักศึกษา",
      text: `คุณต้องการเพิ่มนักศึกษาทั้งหมด ${selectedStudentsToInvite.length} คน เข้าห้องเรียนใช่หรือไม่?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#2563EB",
      cancelButtonColor: "#F1F5F9",
      customClass: { cancelButton: "!text-slate-700", popup: "!rounded-3xl" },
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    try {
      const inserts = selectedStudentsToInvite.map(student => ({
        room_id: id,
        user_id: student.auth_id,
        status: 'approved'
      }));

      const { error } = await supabase.from("room_members").insert(inserts);
        
      if (error) {
        if (error.code === '23505') throw new Error("มีนักศึกษาบางคนอยู่ในห้องเรียนแล้ว");
        throw error;
      }
      
      Swal.fire({ title: "เพิ่มสำเร็จ", text: `เพิ่มนักศึกษา ${selectedStudentsToInvite.length} คนเข้าห้องเรียนแล้ว`, icon: "success", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      setInviteSearchQuery("");
      setInviteSearchResults([]);
      setSelectedStudentsToInvite([]);
      setIsInviteModalOpen(false);
      fetchRoomData();
    } catch (err) {
      Swal.fire("เกิดข้อผิดพลาด", err.message, "error");
    }
  };

  const handleApproveStudent = async (memberId) => {
    try {
      const { data, error } = await supabase.from("room_members").update({ status: "approved" }).eq("id", memberId).select();
      if (error || !data || data.length === 0) throw new Error("ระบบไม่อนุญาตให้อัปเดตข้อมูล");
      
      const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
      Toast.fire({ icon: 'success', title: 'อนุมัติสำเร็จ' });
      
      fetchRoomData();
    } catch (err) { Swal.fire("ผิดพลาด", err.message, "error"); }
  };

  const handleRejectStudent = async (memberId, studentName) => {
    const result = await Swal.fire({ title: "ปฏิเสธคำขอ?", text: `ปฏิเสธคำขอเข้าร่วมห้องของ ${studentName} ใช่หรือไม่?`, icon: "warning", showCancelButton: true, reverseButtons: true, confirmButtonColor: "#ef4444", cancelButtonColor: "#F1F5F9", confirmButtonText: "ปฏิเสธ", cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>", customClass: { popup: '!rounded-3xl' } });
    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from("room_members").delete().eq("id", memberId);
        if (error) throw error;
        setSelectedPendingIds(prev => prev.filter(id => id !== memberId));
        fetchRoomData();
      } catch (err) { Swal.fire("ผิดพลาด", err.message, "error"); }
    }
  };

  const handleBatchApprove = async (idsToApprove) => {
    const ids = idsToApprove || selectedPendingIds;
    if (!ids || ids.length === 0) return;
    try {
      Swal.fire({ title: "กำลังอนุมัติคำขอ...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const { data, error } = await supabase
        .from("room_members")
        .update({ status: "approved" })
        .in("id", ids)
        .select();
        
      if (error || !data) throw error || new Error("ระบบไม่อนุญาตให้อัปเดตข้อมูล");
      
      setSelectedPendingIds([]);
      Swal.fire({
        icon: 'success',
        title: `อนุมัติคำขอ ${ids.length} คน เรียบร้อยแล้ว`,
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 2000
      });
      fetchRoomData();
    } catch (err) {
      Swal.fire("ผิดพลาด", err.message, "error");
    }
  };

  const handleBatchReject = async (idsToReject) => {
    const ids = idsToReject || selectedPendingIds;
    if (!ids || ids.length === 0) return;
    const result = await Swal.fire({
      title: "ปฏิเสธคำขอที่เลือก?",
      text: `คุณต้องการปฏิเสธคำขอของนักศึกษา ${ids.length} คน ใช่หรือไม่?`,
      icon: "warning",
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#F1F5F9",
      confirmButtonText: "ปฏิเสธทั้งหมดที่เลือก",
      cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>",
      customClass: { popup: '!rounded-3xl' }
    });
    if (result.isConfirmed) {
      try {
        Swal.fire({ title: "กำลังปฏิเสธคำขอ...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const { error } = await supabase
          .from("room_members")
          .delete()
          .in("id", ids);
          
        if (error) throw error;
        
        setSelectedPendingIds([]);
        Swal.fire({
          icon: 'success',
          title: `ปฏิเสธคำขอ ${ids.length} คน เรียบร้อยแล้ว`,
          toast: true,
          position: 'bottom-end',
          showConfirmButton: false,
          timer: 2000
        });
        fetchRoomData();
      } catch (err) {
        Swal.fire("ผิดพลาด", err.message, "error");
      }
    }
  };

  const handleOpenChat = () => navigate("/chat", { state: { targetId: room?.room_id } });

  const handleLeaveRoom = async () => {
    if (isOwner) return Swal.fire("ไม่สามารถออกได้", "คุณเป็นเจ้าของห้องนี้ หากต้องการยกเลิกกรุณาลบห้องเรียน", "error");
    const result = await Swal.fire({ title: "ออกจากห้องเรียน?", html: `หากคุณออกจากห้องเรียน<br/><b class="text-rose-500">คุณจะต้องกดขอเข้าร่วมและรออนุมัติใหม่</b>`, icon: "warning", showCancelButton: true, reverseButtons: true, confirmButtonColor: "#ef4444", cancelButtonColor: "#F1F5F9", confirmButtonText: "ยืนยันการออก", cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>", customClass: { popup: '!rounded-3xl' } });
    if (result.isConfirmed) {
      try {
        await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", profile.auth_id);
        await Swal.fire("สำเร็จ", "คุณออกจากห้องเรียนแล้ว", "success");
        navigate("/create-room");
      } catch (err) { Swal.fire("ผิดพลาด", err.message, "error"); }
    }
  };

  const handleManageRoom = async () => {
    const { value } = await Swal.fire({
      title: 'ตั้งค่าห้องเรียน',
      html:
        `<div style="text-align:left; font-weight: 500; font-size: 14px; margin-bottom:5px; color:#475569;">ชื่อห้องเรียน</div>` +
        `<input id="swal-input-title" class="swal2-input !mt-0 !mb-4 !rounded-xl !border-slate-300 focus:!border-blue-500 focus:!ring-blue-500" value="${room.title || ''}" placeholder="ชื่อห้องเรียน">` +
        `<div style="text-align:left; font-weight: 500; font-size: 14px; margin-bottom:5px; color:#475569;">ลิงก์ Google Drive ประจำวิชา (ถ้ามี)</div>` +
        `<input id="swal-input-drive" class="swal2-input !mt-0 !mb-4 !rounded-xl !border-slate-300 focus:!border-blue-500 focus:!ring-blue-500" value="${room.drive_link || ''}" placeholder="https://drive.google.com/...">`,
      focusConfirm: false, 
      showCancelButton: true, reverseButtons: true, 
      confirmButtonText: 'บันทึกการแก้ไข', 
      cancelButtonText: 'ยกเลิก', 
      confirmButtonColor: '#2563eb', 
      cancelButtonColor: '#F1F5F9',
      customClass: { 
        popup: '!rounded-3xl', 
        actions: '!w-full !flex !justify-center !gap-3 !px-4',
        confirmButton: '!rounded-xl !font-bold !m-0',
        cancelButton: '!rounded-xl !font-bold !text-slate-700 !m-0'
      },
      preConfirm: () => {
        return {
          title: document.getElementById('swal-input-title').value,
          drive_link: document.getElementById('swal-input-drive').value
        }
      }
    });

    if (value) {
      try {
        const { error } = await supabase.from("project_rooms").update({ title: value.title, drive_link: value.drive_link || null }).eq("room_id", id);
        if (error) throw error;
        Swal.fire({title: "บันทึกสำเร็จ", text: "ข้อมูลห้องเรียนถูกแก้ไขแล้ว", icon: "success", customClass: {confirmButton: '!bg-blue-600 !rounded-xl'}});
        fetchRoomData();
      } catch (err) { Swal.fire("เกิดข้อผิดพลาด", err.message, "error"); }
    }
  };

  const handleToggleAutoApprove = async () => {
    const newValue = !room.auto_approve;
    setRoom(prev => ({ ...prev, auto_approve: newValue }));
    
    try {
      const { error } = await supabase
        .from('project_rooms')
        .update({ auto_approve: newValue })
        .eq('room_id', id);
        
      if (error) throw error;
      Swal.fire({
        toast: true, position: 'bottom-end', icon: 'success',
        title: newValue ? 'เปิดรับสมาชิกอัตโนมัติแล้ว' : 'ปิดรับสมาชิกอัตโนมัติ',
        showConfirmButton: false, timer: 2000
      });
    } catch (error) {
      console.error("Error in handleToggleAutoApprove:", error);
      setRoom(prev => ({ ...prev, auto_approve: !newValue }));
      Swal.fire("ข้อผิดพลาด", "ไม่สามารถบันทึกการตั้งค่าได้", "error");
    }
  };

  const handleDeleteRoom = async () => {
    const result = await Swal.fire({
      title: "ลบห้องเรียน?",
      html: `การกระทำนี้ไม่สามารถกู้คืนได้!<br>กรุณาพิมพ์ชื่อห้อง <b class="text-slate-900">"${room.title}"</b> เพื่อยืนยัน`,
      icon: "warning", input: "text", inputPlaceholder: "พิมพ์ชื่อห้องที่นี่...",
      showCancelButton: true, reverseButtons: true, confirmButtonColor: "#ef4444", confirmButtonText: "ยืนยันการลบ", cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>", cancelButtonColor: '#F1F5F9',
      customClass: { popup: '!rounded-[24px]', input: '!rounded-xl !border-slate-300 focus:!border-blue-500 focus:!ring-blue-500' },
      preConfirm: (inputValue) => {
        if (inputValue !== room.title) { Swal.showValidationMessage('ชื่อห้องไม่ถูกต้อง กรุณาลองใหม่'); return false; }
        return inputValue;
      }
    });
    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from("project_rooms").delete().eq("room_id", id);
        if (error) throw error;
        await Swal.fire("ลบสำเร็จ", "ห้องเรียนถูกลบออกจากระบบแล้ว", "success");
        navigate("/create-room");
      } catch (err) {
        console.error("Error in handleDeleteRoom:", err);
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถลบห้องได้", "error");
      }
    }
  };

  const handleRemoveStudent = async (student) => {
    const result = await Swal.fire({ title: "ยืนยันการลบ?", html: `ต้องการลบ <b>${student.first_name} ${student.last_name}</b> ออกจากห้องเรียนใช่ไหม?<br/><br/><span style="color: #ef4444; font-size: 0.9em;">*หากต้องการกลับเข้ามาใหม่ นักศึกษาจะต้องส่งคำขอเข้าร่วมอีกครั้ง</span>`, icon: "warning", showCancelButton: true, reverseButtons: true, confirmButtonColor: "#ef4444", cancelButtonColor: "#F1F5F9", confirmButtonText: "ใช่, ลบเลย", cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>", customClass: { popup: '!rounded-3xl' } });
    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", student.auth_id);
        if (error) throw error;
        const newStudents = students.filter((s) => s.auth_id !== student.auth_id);
        setStudents(newStudents);
        const totalPagesAfterDelete = Math.ceil(newStudents.length / itemsPerPage);
        if (currentPage > totalPagesAfterDelete && currentPage > 1) setCurrentPage(currentPage - 1);
        Swal.fire({title: "ลบสำเร็จ!", text: "นำผู้ใช้ออกจากห้องแล้ว", icon: "success", customClass:{confirmButton: '!bg-blue-600 !rounded-xl'}});
      } catch (err) {
        console.error("Error in handleRemoveStudent:", err);
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถลบข้อมูลได้", "error");
      }
    }
  };

  const handleRemoveGroup = async (projectItem) => {
    const result = await Swal.fire({ title: "ยืนยันการลบกลุ่ม?", html: `ต้องการนำกลุ่มโครงงาน <b>${projectItem.project_code || 'โครงงานนี้'}</b> ออกจากห้องเรียนใช่ไหม?<br/><br/><span style="color: #ef4444; font-size: 0.9em;">*สมาชิกทุกคนในกลุ่มนี้จะถูกนำออกจากห้องเรียน</span>`, icon: "warning", showCancelButton: true, reverseButtons: true, confirmButtonColor: "#ef4444", cancelButtonColor: "#F1F5F9", confirmButtonText: "ใช่, ลบเลย", cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>", customClass: { popup: '!rounded-3xl' } });
    if (result.isConfirmed) {
      try {
        const memberIds = projectItem.members.map(m => m.auth_id);
        const { error } = await supabase.from("room_members").delete().eq("room_id", id).in("user_id", memberIds);
        if (error) throw error;
        const newStudents = students.filter((s) => !memberIds.includes(s.auth_id));
        setStudents(newStudents);
        const totalPagesAfterDelete = Math.ceil(newStudents.length / itemsPerPage);
        if (currentPage > totalPagesAfterDelete && currentPage > 1) setCurrentPage(currentPage - 1);
        Swal.fire({title: "ลบสำเร็จ!", text: "นำนักศึกษาในกลุ่มออกจากห้องแล้ว", icon: "success", customClass:{confirmButton: '!bg-blue-600 !rounded-xl'}});
      } catch (err) {
        console.error("Error in handleRemoveGroup:", err);
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถลบข้อมูลได้", "error");
      }
    }
  };

  const toggleMenu = (studentId) => setActiveMenuId(activeMenuId === studentId ? null : studentId);

  const getStatusText = (status) => {
    const labels = {
      none: "ยังไม่มีโครงงาน",
      requested: "ส่งคำขอที่ปรึกษา",
      pending: "รออนุมัติจัดตั้ง",
      rejected: "ไม่ผ่าน/แก้ไข",
      "in-progress": "กำลังดำเนินงาน",
      in_progress: "กำลังดำเนินงาน",
      ongoing: "กำลังดำเนินงาน",
      approved: "ได้หัวข้อแล้ว",
      completed: "เสร็จสมบูรณ์",
    };
    return labels[status] || "ไม่มีข้อมูล";
  };

  const getStatusBadge = (status) => {
    const badges = {
      none: { label: "ยังไม่มีโครงงาน", class: "bg-slate-100 text-slate-600 border border-slate-200" },
      requested: { label: "ส่งคำขอที่ปรึกษา", class: "bg-sky-50 text-sky-600 border border-sky-200" },
      pending: { label: "รออนุมัติจัดตั้ง", class: "bg-amber-50 text-amber-600 border border-amber-200" },
      rejected: { label: "ไม่ผ่าน/แก้ไข", class: "bg-rose-50 text-rose-600 border border-rose-200" },
      "in-progress": { label: "กำลังดำเนินงาน", class: "bg-blue-50 text-blue-600 border border-blue-200" },
      ongoing: { label: "กำลังดำเนินงาน", class: "bg-blue-50 text-blue-600 border border-blue-200" },
      approved: { label: "ได้หัวข้อแล้ว", class: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
      completed: { label: "เสร็จสมบูรณ์", class: "bg-teal-50 text-teal-600 border border-teal-200" },
    };
    
    const config = badges[status] || badges["none"];
    
    return (
      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const openStudentModal = (student) => { setSelectedStudent(student); setIsModalOpen(true); };
  const closeStudentModal = () => { setIsModalOpen(false); setSelectedStudent(null); setProjectInfo(null); };

  const handleViewPDFs = (pdfList, studentName) => {
    let htmlContent = `<div class="flex flex-col gap-3 mt-2">`;
    pdfList.forEach((pdf, index) => {
      htmlContent += `
        <a href="${pdf.url}" target="_blank" rel="noopener noreferrer" 
           class="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-colors duration-200 text-left group">
          <svg className="shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <div class="flex flex-col overflow-hidden w-full">
             <span class="font-bold text-[14px] truncate w-full">
               ${pdf.name || `ไฟล์ PDF ${index + 1}`}
             </span>
          </div>
        </a>
      `;
    });
    htmlContent += `</div>`;

    Swal.fire({
      title: `<span class="text-[18px] font-bold text-slate-800">ไฟล์แนบของ ${studentName}</span>`,
      html: htmlContent,
      showConfirmButton: false,
      showCloseButton: true,
      customClass: { popup: "!rounded-[24px] !p-6" }
    });
  };

  // Group students by project_id for display
  const groupedProjects = {};
  const noProjectList = [];

  students.forEach((stu) => {
    if (stu.project_id) {
      if (!groupedProjects[stu.project_id]) {
        groupedProjects[stu.project_id] = {
          is_group: true,
          project_id: stu.project_id,
          project_title: stu.project_title,
          project_code: stu.project_code,
          project_status: stu.project_status,
          project_advisor: stu.project_advisor,
          members: []
        };
      }
      groupedProjects[stu.project_id].members.push(stu);
    } else {
      noProjectList.push({
        is_group: false,
        member: stu
      });
    }
  });

  const projectGroupsList = Object.values(groupedProjects);
  const displayList = [...projectGroupsList, ...noProjectList];

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = displayList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(displayList.length / itemsPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50" style={{ fontFamily: "'Kanit', sans-serif" }}>
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  const AnnouncementCard = ({ ann }) => {
    const poster = Array.isArray(ann.users) ? ann.users[0] : ann.users;
    const posterName = poster ? `${poster.prefix || ''}${poster.first_name || ''} ${poster.last_name || ''}`.trim() : (advisorName || "อาจารย์ประจำวิชา");
    const postedDate = ann.created_at ? new Date(ann.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-slate-300 flex flex-col gap-3 transition-shadow hover:shadow-md">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
               {poster?.profile_image ? (
                  <img src={poster.profile_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-medium text-[16px]">{posterName.charAt(0)}</span>
                )}
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-slate-900 text-[14px] leading-tight hover:underline cursor-pointer">{posterName}</span>
              <span className="text-[12px] text-slate-500 font-normal">
                {postedDate}
              </span>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={() => handleDeleteAnnouncement(ann.message_id)}
              className="w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors"
              title="ลบประกาศ"
            >
              <svg className="shrink-0" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          )}
        </div>

        <p className="text-slate-800 text-[14px] leading-relaxed font-normal whitespace-pre-wrap mt-2">
          {ann.content.replace("#ANNOUNCEMENT# ", "")}
        </p>

        <button
          onClick={() => handleViewAnnouncement(ann.content, ann.file_url)}
          className="w-fit mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-600 hover:bg-slate-50 text-[13px] font-medium rounded-md border border-slate-300 transition-colors"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="shrink-0"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
          <span className="truncate max-w-[200px]">
            ไฟล์แนบ
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col relative transition-colors duration-200" style={{ fontFamily: "'Kanit', sans-serif" }}>

      {/* ================= HEADER ================= */}
      <Header user={user} role={profile?.role} fullName={profile?.first_name} />

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 sm:pb-8 relative z-10">

        <button
          onClick={() => navigate("/create-room")}
          className="group inline-flex items-center text-[13px] font-bold text-slate-500 hover:text-blue-600 mb-4 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200"
        >
          <svg className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          กลับหน้ารายวิชา
        </button>

        {/* ================= HEADER CARD (HERO SECTION) ================= */}
        <section className="h-[240px] sm:h-[300px] rounded-xl flex flex-col justify-between p-6 mb-6 relative overflow-hidden bg-slate-800 border border-transparent shadow-sm">
          
          {/* Subtle Google Classroom style background image/pattern */}
          <div className="absolute inset-0 opacity-40 bg-[url('https://www.gstatic.com/classroom/themes/img_read.jpg')] bg-cover bg-center pointer-events-none"></div>

          {/* Top Actions (Settings, Leave) */}
          <div className="relative z-10 w-full flex justify-end gap-3">
            {!isOwner && (
              <button
                className="inline-flex justify-center items-center p-2 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                onClick={handleLeaveRoom}
                title="ออกจากห้อง"
              >
                <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            )}

            {isOwner && (
              <>
                <div 
                  className="inline-flex justify-center items-center gap-2 px-3 py-1.5 rounded-md bg-black/20 text-white cursor-pointer hover:bg-black/40 transition-colors"
                  onClick={handleToggleAutoApprove}
                  title="รับเข้าอัตโนมัติ"
                >
                  <span className="text-[12px] font-medium tracking-wide">รับเข้าอัตโนมัติ</span>
                  <button
                    type="button"
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                      room?.auto_approve ? 'bg-emerald-400' : 'bg-white/30'
                    }`}
                    role="switch"
                    aria-checked={room?.auto_approve}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
                        room?.auto_approve ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <button 
                  onClick={handleManageRoom}
                  className="inline-flex justify-center items-center p-2 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  title="ตั้งค่า"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>

                <button 
                  onClick={handleDeleteRoom}
                  className="inline-flex justify-center items-center p-2 rounded-full text-white/80 hover:bg-rose-500 hover:text-white transition-colors"
                  title="ลบห้องเรียน"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </>
            )}
          </div>

          {/* Bottom Title Area */}
          <div className="relative z-10 w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-medium tracking-tight text-white mb-2 leading-tight drop-shadow-md">
                {room?.title}
              </h1>
              <div 
                className="text-white/90 text-sm font-medium hover:underline cursor-pointer w-fit drop-shadow-sm flex items-center gap-2"
                onClick={() => advisorInfo && openStudentModal(advisorInfo)}
                title="ดูโปรไฟล์อาจารย์"
              >
                {advisorInfo?.profile_image ? (
                  <img src={advisorInfo.profile_image} alt={advisorName} className="w-6 h-6 rounded-full object-cover border border-white/30 shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center border border-white/30 shrink-0">
                    <span className="text-[10px] text-white font-bold">{advisorName ? advisorName.charAt(0) : "อ"}</span>
                  </div>
                )}
                {advisorName || "อาจารย์ประจำวิชา"}
              </div>
            </div>

            {/* Drive Link (Clean Material Button) */}
            {room?.drive_link && (
              <a
                href={room.drive_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white bg-white/20 hover:bg-white/30 px-4 py-2 rounded-md transition-colors w-fit"
              >
                <svg className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <span className="font-medium text-[13px]">โฟลเดอร์งาน</span>
              </a>
            )}
          </div>
        </section>

        {/* --- MAIN GRID LAYOUT --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          <div className="lg:col-span-3 flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start z-10">
            
            {/* Personal Project Widget */}
            {(() => {
              const myStudent = students.find(s => s.auth_id === profile?.auth_id);
              if (!myStudent || !myStudent.project_id) return null;
              
              return (
                <div className="w-full bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                  <h3 className="font-bold text-slate-800 text-[13px] flex items-center gap-2 mb-3 border-b border-blue-100/50 pb-2.5">
                    <span className="w-6 h-6 rounded-lg bg-white text-blue-600 flex items-center justify-center border border-blue-100"><Icon name="grid" /></span>
                    ข้อมูลโครงงาน ({getStatusText(myStudent.project_status)})
                  </h3>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 shadow-sm">
                    {myStudent.project_code && (
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider shrink-0">รหัสโครงงาน</span>
                        <span className="text-blue-700 font-bold text-sm bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-right">{myStudent.project_code}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">ชื่อโครงงาน</span>
                      <span className="text-slate-800 font-bold text-[13px] leading-relaxed">{myStudent.project_title || <span className="text-slate-400 italic font-normal">ยังไม่ได้ระบุชื่อโครงงาน</span>}</span>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <button 
                        onClick={() => handleViewReports(myStudent)} 
                        className="w-full px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        เช็คงาน / คะแนน
                      </button>
                      <button 
                        onClick={() => handleViewProjectDetail(myStudent.project_id)} 
                        className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        ดูรายละเอียดโครงงาน <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-3 mb-1 pl-1">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <svg className="shrink-0" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
              </div>
              <h3 className="text-xl font-black text-slate-800 m-0 tracking-tight">ประกาศล่าสุด</h3>
            </div>

            {/* Post Box */}
            {isOwner && (
              <div
                className="bg-white p-4 rounded-lg border border-slate-300 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer flex items-center gap-3"
                onClick={handlePostAnnouncement}
              >
                {profile?.profile_image ? (
                  <img src={profile.profile_image} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-700 text-white flex items-center justify-center font-medium shrink-0 text-[16px]">
                    {profile?.first_name?.charAt(0) || "T"}
                  </div>
                )}
                <div className="text-slate-500 w-full text-[13px] font-medium select-none truncate">
                  แจ้งข่าวสาร หรือประกาศให้ห้องเรียนทราบ...
                </div>
              </div>
            )}

            {/* Announcement List */}
            <div className="flex flex-col gap-4">
              {announcements.length > 0 ? (
                <>
                  {announcements.slice(0, maxAnnouncementsToShow).map((ann) => (
                    <AnnouncementCard key={ann.message_id} ann={ann} />
                  ))}

                  {announcements.length > maxAnnouncementsToShow && (
                    <button
                      onClick={() => setIsAllAnnouncementsOpen(true)}
                      className="w-full py-3.5 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 font-bold text-[14px] rounded-xl border border-slate-200 hover:border-blue-200 transition-colors duration-200"
                    >
                      ดูประกาศทั้งหมด ({announcements.length})
                    </button>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-slate-100 shrink-0">
                    <svg className="shrink-0" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2-2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                  </div>
                  <p className="text-slate-600 font-bold text-[15px]">ยังไม่มีประกาศ</p>
                  <p className="text-slate-400 text-[13px] mt-2 leading-relaxed">ยังไม่มีความเคลื่อนไหวใดๆ<br/>แจ้งข่าวเพื่อให้ทุกคนทราบได้เลย</p>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: Members & Requests */}
          <div className="lg:col-span-9 flex flex-col gap-6">

            {/* Member List Section */}
            <div className="bg-white rounded-3xl border border-slate-200 flex flex-col h-full relative shadow-sm">
              
              {/* Card Header (Google Classroom Style) */}
              <div className="px-6 py-4 flex flex-col xl:flex-row justify-between xl:items-center gap-4 bg-white border-b border-blue-600 rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <h3 className="text-[2rem] font-normal text-blue-600 tracking-tight m-0">
                    นักศึกษา
                  </h3>
                  <span className="text-blue-600 font-medium text-[15px]">{students.length} คน</span>
                </div>
                
                {/* ปุ่มจัดการสำหรับอาจารย์/Admin */}
                {(isOwner || isAdmin) && (
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {/* 🌟 ปุ่มคำขอเข้าห้อง (พร้อมจุดสีแดงแจ้งเตือน) */}
                    <button
                      onClick={() => setIsPendingModalOpen(true)}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[13px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm relative group"
                    >
                      <div className="relative flex items-center justify-center">
                        <svg className="shrink-0 text-slate-600 group-hover:text-blue-600 transition-colors" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                        </svg>
                        {pendingRequests.length > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-white"></span>
                          </span>
                        )}
                      </div>
                      <span>คำขอเข้าห้อง</span>
                      {pendingRequests.length > 0 && (
                        <span className="bg-rose-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-xs">
                          {pendingRequests.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setIsInviteModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 border border-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <svg className="shrink-0" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                      เชิญนักศึกษา
                    </button>
                    <button
                      onClick={() => handleOpenWeeklyOverview(overviewWeek)}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-blue-600 text-[13px] font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <svg className="shrink-0" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      เช็คงานรายสัปดาห์
                    </button>
                  </div>
                )}
              </div>

              {/* Responsive List Container */}
              <div className="flex flex-col flex-1 bg-white pt-2 rounded-b-3xl">
                
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-[13px] font-medium text-slate-500 border-b border-slate-200">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-4">ชื่อโครงงาน (Project Name)</div>
                  <div className="col-span-3">สมาชิกในกลุ่ม</div>
                  <div className="col-span-2 text-center lg:text-left">สถานะโครงงาน</div>
                  <div className="col-span-2 text-center">ตรวจสอบงาน</div>
                </div>

                {/* Rows */}
                {currentItems.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 text-blue-300">
                     <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-5 border border-blue-100 shrink-0">
                       <svg className="w-10 h-10 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                     </div>
                     <span className="font-bold text-[16px] text-slate-500">ยังไม่มีข้อมูลโครงงาน/สมาชิก</span>
                     <p className="text-slate-400 text-[14px]">รอนักศึกษาส่งคำขอเข้าร่วมห้องเรียน</p>
                   </div>
                ) : (
                  currentItems.map((item, index) => {
                    const globalIndex = indexOfFirstItem + index + 1;
                    const isLastRow = index === currentItems.length - 1;

                    if (item.is_group) {
                      return (
                        <div key={`group-${item.project_id}`} className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 md:px-6 border-b border-slate-200 hover:bg-slate-50 transition-colors items-center relative ${isLastRow ? 'border-b-0 rounded-b-3xl' : ''}`}>
                          
                          <div className="md:col-span-1 hidden md:flex justify-center text-slate-500 text-[13px]">{globalIndex}</div>
                          
                          <div className="md:col-span-4 min-w-0 pr-4">
                             <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-slate-900 line-clamp-2" title={item.project_title}>{item.project_title || <span className="text-slate-400 font-normal italic">ยังไม่ได้ระบุชื่อโครงงาน</span>}</span>
                                {item.project_code && <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 w-fit">{item.project_code}</span>}
                                {item.project_advisor && <span className="text-[11px] text-indigo-600 mt-1 truncate">อ.ที่ปรึกษา: {item.project_advisor}</span>}
                             </div>
                          </div>

                          <div className="md:col-span-3 flex flex-col gap-2.5">
                             {item.members.map(member => (
                               <div key={member.auth_id} className="flex items-center gap-2.5 cursor-pointer group/member" onClick={() => openStudentModal(member)}>
                                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold text-slate-600 border border-slate-300 group-hover/member:border-blue-400 transition-colors">
                                     {member.profile_image ? (
                                        <img src={member.profile_image} alt="" className="w-full h-full object-cover" />
                                     ) : (member.first_name?.charAt(0) || "?")}
                                  </div>
                                  <div className="flex flex-col min-w-0 w-full">
                                      <div className="text-[12px] text-slate-700 font-medium group-hover/member:text-blue-600 transition-colors truncate">
                                          {member.first_name} {member.last_name}
                                      </div>
                                      <div className="text-[10px] text-slate-400 truncate w-full">
                                          {member.account_code || "-"}
                                      </div>
                                  </div>
                               </div>
                             ))}
                          </div>

                          <div className="md:col-span-2 flex justify-start lg:justify-start mt-2 md:mt-0">
                             {getStatusBadge(item.project_status)}
                          </div>

                          <div className="absolute top-4 right-4 md:static md:col-span-2 flex justify-end md:justify-center items-center">
                             {(isAdvisorRole || isOwner || isAdmin || (item.members && item.members.some(m => m.auth_id === profile?.auth_id))) && (
                               <div className="relative action-menu-container">
                                 <button
                                   className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none"
                                   onClick={(e) => { e.stopPropagation(); toggleMenu(`group_${item.project_id || item.project_code}`); }}
                                 >
                                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none shrink-0">
                                     <circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle>
                                   </svg>
                                 </button>
                                 {activeMenuId === `group_${item.project_id || item.project_code}` && (
                                   <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                                     
                                     <button onClick={() => { handleViewReports(item.members[0]); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2 border-b border-slate-100">
                                       <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                       เช็คงานรายกลุ่ม
                                     </button>

                                     <button onClick={() => { handleViewProjectDetail(item.project_id); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                                       <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                       ข้อมูลโครงงาน
                                     </button>

                                     {(isOwner || isAdmin) && (
                                        <button onClick={() => { handleRemoveGroup(item); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-slate-100 mt-1 pt-2">
                                          <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                          ลบกลุ่มนี้ออกจากห้อง
                                        </button>
                                     )}
                                   </div>
                                 )}
                               </div>
                             )}
                          </div>
                        </div>
                      );
                    } else {
                      // Individual without project
                      const stu = item.member;
                      const isTargetOwner = room?.advisor_id === stu.auth_id;
                      const isMe = profile?.auth_id === stu.auth_id;
                      const showDeleteButton = isAdvisorRole && !isTargetOwner && !isMe;

                      return (
                        <div key={stu.auth_id} className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 md:px-6 border-b border-slate-200 hover:bg-slate-50 transition-colors items-center relative group ${isLastRow ? 'border-b-0 rounded-b-3xl' : ''}`}>
                          
                          <div className="md:col-span-1 hidden md:flex justify-center text-slate-500 text-[13px]">{globalIndex}</div>
                          
                          <div className="md:col-span-4 min-w-0 pr-4">
                             <div className="flex flex-col">
                                {stu.project_title ? (
                                  <span className="text-[14px] font-bold text-slate-900 break-words line-clamp-2" title={stu.project_title}>
                                    {stu.project_title}
                                  </span>
                                ) : (
                                  <span className="text-[13px] font-normal text-slate-400 italic">ยังไม่มีโครงงาน</span>
                                )}
                             </div>
                          </div>

                          <div className="md:col-span-3 flex items-center gap-3 relative">
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden" onClick={() => openStudentModal(stu)}>
                              {stu.profile_image ? (
                                 <img src={stu.profile_image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                 <span className="font-medium text-[12px] uppercase">{stu.first_name?.charAt(0) || "?"}</span>
                              )}
                            </div>
                            <div className="min-w-0 cursor-pointer w-full" onClick={() => openStudentModal(stu)}>
                              <div className="font-medium text-slate-900 text-[13px] truncate w-full hover:underline">
                                 {stu.prefix || ''}{stu.first_name} {stu.last_name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate w-full">
                                 {stu.account_code || "-"}
                              </div>
                            </div>
                          </div>

                          <div className="md:col-span-2 flex justify-start lg:justify-start mt-2 md:mt-0">
                             {getStatusBadge(stu.project_status)}
                          </div>

                          <div className="absolute top-4 right-4 md:static md:col-span-2 flex justify-end md:justify-center items-center">
                            <div className="relative action-menu-container">
                              <button
                                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none"
                                onClick={(e) => { e.stopPropagation(); toggleMenu(stu.auth_id); }}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none shrink-0">
                                  <circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle>
                                </svg>
                              </button>

                              {activeMenuId === stu.auth_id && (
                                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                                  <button onClick={() => { openStudentModal(stu); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                                    ดูโปรไฟล์เต็ม
                                  </button>

                                  {showDeleteButton && (
                                    <button onClick={() => { handleRemoveStudent(stu); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-slate-100 mt-1 pt-2">
                                      นำออกจากห้อง
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center p-5 border-t border-slate-100 gap-2 bg-slate-50">
                  <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 rounded-xl text-[14px] font-bold transition-colors disabled:opacity-40 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">ก่อนหน้า</button>
                  <div className="flex gap-2">
                    {[...Array(totalPages)].map((_, i) => (
                      <button key={i + 1} onClick={() => paginate(i + 1)} className={`w-9 h-9 rounded-xl text-[14px] font-bold transition-colors flex items-center justify-center ${currentPage === i + 1 ? 'bg-blue-600 text-white border border-blue-600' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>{i + 1}</button>
                    ))}
                  </div>
                  <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="px-4 py-2 rounded-xl text-[14px] font-bold transition-colors disabled:opacity-40 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">ถัดไป</button>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* --- MODAL: อนุมัติคำขอเข้าห้อง --- */}
      {isPendingModalOpen && (
        <ModalShell
          title={
            <div>
              <div className="font-bold text-[15px]">คำขอเข้าห้องเรียน</div>
              <div className="text-[11px] text-slate-500 font-medium">
                {pendingRequests.length > 0 ? `มีคำขอรอพิจารณา ${pendingRequests.length} รายการ` : "ไม่มีคำขอค้างอยู่"}
              </div>
            </div>
          }
          icon={<Icon name="people" className="w-4 h-4" />}
          onClose={() => {
            setIsPendingModalOpen(false);
            setSelectedPendingIds([]);
          }}
          maxW="max-w-2xl"
        >
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3 border border-slate-100 shrink-0">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <p className="font-bold text-slate-700 text-[15px]">ไม่มีคำขอเข้าห้องเรียน</p>
              <p className="text-slate-400 text-[13px] mt-1">ยังไม่มีนักศึกษาส่งคำขอเข้าร่วมห้องเรียนในขณะนี้</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* 🌟 แถบเมนูเลือกทั้งหมด และรับ/ปฏิเสธทีเดียว */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pendingRequests.length > 0 && selectedPendingIds.length === pendingRequests.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPendingIds(pendingRequests.map(r => r.member_id));
                      } else {
                        setSelectedPendingIds([]);
                      }
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-[13px] font-bold text-slate-700">
                    เลือกทั้งหมด {selectedPendingIds.length > 0 && `(${selectedPendingIds.length}/${pendingRequests.length})`}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  {selectedPendingIds.length > 0 ? (
                    <>
                      <button
                        onClick={() => handleBatchReject(selectedPendingIds)}
                        className="px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-[12px] font-bold rounded-xl transition-colors shadow-xs"
                      >
                        ปฏิเสธที่เลือก ({selectedPendingIds.length})
                      </button>
                      <button
                        onClick={() => handleBatchApprove(selectedPendingIds)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        <Icon name="check" className="w-3.5 h-3.5" />
                        รับที่เลือก ({selectedPendingIds.length})
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleBatchApprove(pendingRequests.map(r => r.member_id))}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
                    >
                      <Icon name="check" className="w-3.5 h-3.5" />
                      รับทั้งหมดทีเดียว ({pendingRequests.length})
                    </button>
                  )}
                </div>
              </div>

              {/* 🌟 รายการคำขอพร้อมช่องติ๊กเลือก */}
              {pendingRequests.map((req) => {
                const isSelected = selectedPendingIds.includes(req.member_id);
                return (
                  <div 
                    key={req.auth_id} 
                    className={`border p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-200 ${
                      isSelected 
                        ? 'bg-blue-50/60 border-blue-300 shadow-xs' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPendingIds(prev => [...prev, req.member_id]);
                          } else {
                            setSelectedPendingIds(prev => prev.filter(id => id !== req.member_id));
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                      />
                      <Avatar src={req.profile_image} name={req.first_name || 'U'} size="w-11 h-11 sm:w-12 sm:h-12" />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-[14.5px] sm:text-[15px] truncate" title={`${req.prefix || ''}${req.first_name} ${req.last_name}`}>
                          {req.prefix || ''}{req.first_name} {req.last_name}
                        </div>
                        <div className="text-[12.5px] font-medium text-slate-500 mt-0.5 truncate" title={`รหัส: ${req.account_code || '-'} • ${req.major || '-'}`}>
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[11px] font-bold tracking-widest mr-1.5 border border-blue-100">{req.account_code || '-'}</span>
                          {req.major || '-'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto shrink-0 mt-1 sm:mt-0 pl-7 sm:pl-0">
                      <button
                        onClick={() => handleApproveStudent(req.member_id)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 focus:ring-4 focus:ring-blue-500/20 shadow-xs"
                      >
                        <Icon name="check" className="w-4 h-4" />
                        รับเข้าห้อง
                      </button>
                      <button
                        onClick={() => handleRejectStudent(req.member_id, `${req.prefix || ''}${req.first_name || ''} ${req.last_name || ''}`)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-white text-rose-600 text-[13px] font-bold border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ModalShell>
      )}

      {/* --- MODAL: ประกาศทั้งหมด --- */}
      {isAllAnnouncementsOpen && (
        <ModalShell
          title={`ประกาศทั้งหมด (${announcements.length})`}
          icon={<svg className="shrink-0" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>}
          onClose={() => setIsAllAnnouncementsOpen(false)}
          maxW="max-w-2xl"
        >
          {announcements.map((ann) => (
            <AnnouncementCard key={ann.message_id} ann={ann} />
          ))}
        </ModalShell>
      )}

      {/* --- MODAL: โปรไฟล์ผู้ใช้ และรายละเอียดโครงงาน --- */}
      {isModalOpen && selectedStudent && (
        <ModalShell
          title="ข้อมูลนักศึกษา"
          icon={<Icon name="people" />}
          onClose={closeStudentModal}
          maxW="max-w-md"
        >
          <div className="flex flex-col items-center pb-4">
            <Avatar 
              src={selectedStudent.profile_image} 
              name={selectedStudent.first_name || 'U'} 
              size="w-24 h-24 sm:w-28 sm:h-28 mb-3" 
              ring="border-4 border-white shadow-sm" 
              tone="bg-blue-50 text-blue-500 text-3xl border-4 border-white shadow-sm" 
            />
            <div className="bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-widest px-3.5 py-1 rounded-full mb-4 border border-blue-100">
              {selectedStudent.role?.toUpperCase() === 'ADVISOR' || selectedStudent.role?.toUpperCase() === 'ADMIN' ? 'อาจารย์' : 'นักศึกษา'}
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center mb-6">
              {selectedStudent.prefix || ''}{selectedStudent.first_name} {selectedStudent.last_name}
            </h2>

            <div className="w-full bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 flex flex-col gap-4 text-[13.5px]">
              {selectedStudent.role?.toUpperCase() !== 'ADVISOR' && selectedStudent.role?.toUpperCase() !== 'ADMIN' && (
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">รหัสนักศึกษา</span>
                  <span className="text-blue-800 font-bold bg-white px-2 py-0.5 rounded border border-blue-100">{selectedStudent.account_code || "-"}</span>
                </div>
              )}

              {selectedStudent.role?.toUpperCase() === 'ADVISOR' || selectedStudent.role?.toUpperCase() === 'ADMIN' ? (
                <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-3">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">ความเชี่ยวชาญ</span>
                  <span className="text-slate-900 font-bold">{selectedStudent.expertise || "-"}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-3">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">คณะ / สาขาวิชา</span>
                  <span className="text-slate-900 font-bold leading-relaxed">{[selectedStudent.faculty, selectedStudent.major].filter(Boolean).join(" · ") || "-"}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-200 pb-3 gap-1.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Icon name="document" /> อีเมล
                </span>
                <span className="text-blue-600 font-bold truncate hover:underline cursor-pointer" title={selectedStudent.email}>{selectedStudent.email}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 border-b border-slate-200 pb-3">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Icon name="document" /> เบอร์โทร
                </span>
                <span className="text-slate-900 font-bold">{selectedStudent.phone || "-"}</span>
              </div>
              
              {selectedStudent.line_id && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                     <Icon name="document" /> Line ID
                  </span>
                  <span className="text-slate-900 font-bold">{selectedStudent.line_id}</span>
                </div>
              )}
            </div>

            {selectedStudent.project_id && (isOwner || isAdmin || profile?.auth_id === selectedStudent?.auth_id) && (
              <div className="w-full bg-blue-50 p-5 rounded-2xl border border-blue-100 mt-5">
                <h3 className="font-bold text-slate-800 text-[13px] flex items-center gap-2 mb-3 border-b border-blue-100 pb-2.5">
                  <span className="w-6 h-6 rounded-lg bg-white text-blue-600 flex items-center justify-center border border-blue-100"><Icon name="grid" /></span>
                  ข้อมูลโครงงาน ({getStatusText(selectedStudent.project_status)})
                </h3>
                
                {loadingProjectInfo ? (
                  <div className="flex justify-center items-center py-6 text-[13.5px] font-bold text-blue-600">
                    <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mr-2.5"></div>
                    กำลังโหลดข้อมูลโครงงาน...
                  </div>
                ) : projectInfo ? (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5">
                    {selectedStudent.project_code && (
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider shrink-0">รหัสโครงงาน</span>
                        <span className="text-blue-700 font-bold text-sm bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-right">{selectedStudent.project_code}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">ชื่อโครงงาน</span>
                      <span className="text-slate-800 font-bold text-[13px] leading-relaxed">{projectInfo.title || <span className="text-slate-400 italic font-normal">ยังไม่ได้ระบุชื่อโครงงาน</span>}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button 
                        onClick={() => { setIsModalOpen(false); handleViewReports(selectedStudent); }} 
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5"
                      >
                        <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        เช็คงาน / คะแนน
                      </button>
                      <button 
                        onClick={() => { closeStudentModal(); handleViewProjectDetail(selectedStudent.project_id); }} 
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        ดูรายละเอียดโครงงาน <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-500 text-[14px] font-bold bg-white rounded-xl border border-blue-100">
                    ไม่พบข้อมูลโครงงานในระบบ
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalShell>
      )}


      {isReportsModalOpen && selectedStudent && (
        <ModalShell
          title={
            <div>
              <div className="font-bold text-[17px] m-0 truncate">ประวัติการส่งงาน</div>
              <div className="text-[13px] text-slate-500 font-bold mt-0.5 truncate">{selectedStudent.project_title || "ไม่ระบุโครงงาน"}</div>
            </div>
          }
          icon={<Icon name="document" />}
          onClose={() => setIsReportsModalOpen(false)}
          maxW="max-w-[95vw] xl:max-w-7xl"
        >
          {loadingReports ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <span className="text-blue-500 font-bold text-sm">กำลังโหลดข้อมูล...</span>
            </div>
          ) : reportsData.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-300 rounded-full flex items-center justify-center mb-3 shrink-0">
                <Icon name="document" className="w-6 h-6" />
              </div>
              <p className="text-slate-700 font-bold text-[15px]">ยังไม่มีการส่งความคืบหน้า</p>
              <p className="text-slate-500 text-[13px] font-medium">โครงงานนี้ยังไม่ได้เริ่มส่งรายงานหรือแนบลิงก์ผลงานใดๆ</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px] table-fixed">
                  <thead className="bg-blue-50 border-b border-blue-100 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-center w-[8%]">สัปดาห์ที่</th>
                      <th className="px-4 py-3 text-center w-[20%]">วันที่ส่ง & ชิ้นงาน</th>
                      <th className="px-4 py-3 text-center w-[11%]">คะแนนงาน</th>
                      <th className="px-4 py-3 text-center w-[13%]">คะแนนเอกสาร</th>
                      <th className="px-4 py-3 text-center w-[10%]">ลิงก์ผลงาน</th>
                      <th className="px-4 py-3 text-center w-[12%]">PDF นศ.</th>
                      <th className="px-4 py-3 text-center w-[13%]">คอมเมนต์ (อ.ที่ปรึกษา)</th>
                      <th className="px-4 py-3 text-center w-[13%]">คอมเมนต์ (อ.ประจำวิชา)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reportsData.map((report) => (
                      <tr key={report.report_id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-7 bg-blue-600 text-white rounded-md text-[13px] font-bold shadow-sm">{report.week_number}</span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-col items-center justify-center w-full text-center">
                            <div className="text-[12px] font-bold text-slate-800 break-words whitespace-normal" title={report.task_submitted_title || report.task_assigned || "ส่งความคืบหน้า"}>
                               {report.task_submitted_title || report.task_assigned || "ส่งความคืบหน้า"}
                            </div>
                            <div className="text-[11px] font-bold text-blue-600">
                              {report.status === 'pending' ? (report.due_date ? `กำหนดส่ง: ${new Date(report.due_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.` : 'ไม่มีกำหนดส่ง') : `ส่งเมื่อ: ${new Date(report.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.`}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-black text-blue-600 text-[14px]">{report.weekly_score_work ?? '-'}</td>
                        <td className="px-4 py-3 text-center font-black text-sky-600 text-[14px]">{report.weekly_score_document ?? '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {report.drive_link ? (
                            <a href={report.drive_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-colors" title="เปิดลิงก์งาน">
                              <Icon name="externalLink" className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-slate-300 font-bold">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(() => {
                            const pdfList = parsePdfUrls(report.pdf_url);
                            return pdfList.length > 0 ? (
                              <button
                                onClick={() => handleViewPDFs(pdfList, `รายงานสัปดาห์ที่ ${report.week_number}`)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors duration-200 text-[11px] font-bold"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                เปิดไฟล์ {pdfList.length > 1 ? `(${pdfList.length})` : ''}
                              </button>
                            ) : (
                              <span className="text-slate-300 font-bold">-</span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          {report.advisor_feedback ? (
                            <span className="text-[11px] text-amber-700 break-words whitespace-normal inline-block text-left" title={report.advisor_feedback}>{report.advisor_feedback}</span>
                          ) : (
                            <span className="text-slate-300 font-bold">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                           <div className="flex items-center justify-between w-full h-full gap-2">
                             <div className="flex-1 flex justify-center items-center min-h-[28px]">
                               {report.instructor_feedback ? (
                                  <span className="text-[11px] text-blue-700 break-words whitespace-normal inline-block text-left" title={report.instructor_feedback}>{report.instructor_feedback}</span>
                               ) : (
                                  <span className="text-slate-300 font-bold">-</span>
                               )}
                             </div>
                             {(isOwner || isAdmin) && (
                                <div className="shrink-0 flex justify-end">
                                  <button onClick={() => handleAddFeedback(report.report_id, report.instructor_feedback || '', report.week_number)} className="inline-flex items-center justify-center p-1.5 rounded-md bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors" title="แก้ไขข้อเสนอแนะ">
                                    <Icon name="pencil" className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                             )}
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ModalShell>
      )}

      {/* 🌟 MODAL: ภาพรวมการส่งงานรายสัปดาห์ */}
      {isWeeklyOverviewOpen && (
        <ModalShell
          title={
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 w-full pr-8">
              <div>
                <div className="font-bold text-[17px] m-0 truncate">ภาพรวมการส่งงานรายสัปดาห์</div>
                <div className="text-[13px] font-bold text-slate-500 mt-0.5 truncate">ตรวจสอบสถานะการส่งงานของนักศึกษาทุกคน</div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                <div className="flex items-center bg-blue-50 rounded-xl p-1 border border-blue-100 shrink-0 mx-auto sm:mx-0">
                  <button
                    onClick={() => {
                       const newWeek = Math.max(1, overviewWeek - 1);
                       setOverviewWeek(newWeek);
                       handleOpenWeeklyOverview(newWeek);
                    }}
                    disabled={overviewWeek <= 1}
                    className="w-9 h-9 flex items-center justify-center text-blue-700 bg-white rounded-lg border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <svg className="shrink-0" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
                  <span className="text-[14px] text-blue-700 font-bold px-4 w-32 text-center">สัปดาห์ที่ {overviewWeek}</span>
                  <button
                    onClick={() => {
                       const newWeek = overviewWeek + 1;
                       setOverviewWeek(newWeek);
                       handleOpenWeeklyOverview(newWeek);
                    }}
                    className="w-9 h-9 flex items-center justify-center text-blue-700 bg-white rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm"
                  >
                    <svg className="shrink-0" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          }
          icon={<Icon name="grid" />}
          onClose={() => setIsWeeklyOverviewOpen(false)}
          maxW="max-w-[95vw] xl:max-w-7xl"
        >
          {loadingWeeklyOverview ? (
            <div className="flex flex-col items-center justify-center py-20 text-blue-500 font-bold text-sm">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              กำลังโหลดข้อมูลสัปดาห์ที่ {overviewWeek}...
            </div>
          ) : weeklyOverviewData.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
               <span className="text-blue-400 font-bold text-[14px]">ไม่พบข้อมูลนักศึกษาในระบบ</span>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* --- DESKTOP TABLE VIEW --- */}
              <div className="hidden md:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
                  <thead className="bg-blue-50 border-b border-blue-100 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-center w-10">#</th>
                      <th className="px-4 py-3 min-w-[300px]">โครงงาน & สมาชิก</th>
                      <th className="px-4 py-3 text-center">สถานะการส่งงาน</th>
                      <th className="px-4 py-3 text-center">คะแนนงาน</th>
                      <th className="px-4 py-3 text-center">คะแนนเอกสาร</th>
                      <th className="px-4 py-3 text-center">ลิงก์ผลงาน</th>
                      <th className="px-4 py-3 text-center">PDF นศ.</th>
                      <th className="px-4 py-3 text-center">คอมเมนต์</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(() => {
                      const groups = [];
                      weeklyOverviewData.forEach(stu => {
                        if (!stu.project_id) {
                          groups.push({ id: `stu-${stu.auth_id}`, type: 'single', students: [stu], report: stu.report, project_title: stu.project_title });
                        } else {
                          let existing = groups.find(g => g.type === 'group' && g.project_id === stu.project_id);
                          if (existing) {
                            existing.students.push(stu);
                          } else {
                            groups.push({ id: `proj-${stu.project_id}`, type: 'group', project_id: stu.project_id, students: [stu], report: stu.report, project_title: stu.project_title });
                          }
                        }
                      });
                      
                      return groups.map((group, idx) => {
                        const hasReport = group.report && group.report.status !== 'pending';
                        return (
                          <tr key={group.id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="px-4 py-3 text-center text-slate-400 font-bold text-[12px] align-middle">{idx + 1}</td>
                            <td className="px-4 py-3 align-middle">
                              <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 items-start xl:items-center">
                                {/* Project Info */}
                                <div className="flex flex-col xl:w-[250px] shrink-0">
                                  <span className="text-[13px] font-bold text-slate-900 line-clamp-2" title={group.project_title}>{group.project_title || <span className="text-slate-400 font-normal italic">ยังไม่ได้ระบุชื่อโครงงาน</span>}</span>
                                  {group.students[0]?.project_code && <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 w-fit">{group.students[0].project_code}</span>}
                                  {group.students[0]?.project_advisor && <span className="text-[11px] text-indigo-600 mt-1 truncate">อ.ที่ปรึกษา: {group.students[0].project_advisor}</span>}
                                </div>
                                {/* Member List */}
                                <div className="flex flex-col gap-2 flex-1 mt-2 xl:mt-0 border-t border-slate-100 xl:border-0 pt-3 xl:pt-0">
                                  {group.students.map((s) => (
                                    <div key={s.auth_id} className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-[9px] font-bold text-slate-600 border border-slate-300">
                                         {s.profile_image ? (
                                            <img src={s.profile_image} alt="" className="w-full h-full object-cover" />
                                         ) : (s.first_name?.charAt(0) || "?")}
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                          <div className="text-[11px] text-slate-700 font-medium truncate">
                                              {s.first_name} {s.last_name}
                                          </div>
                                          <div className="text-[9px] text-slate-400 truncate w-full tracking-widest">
                                              {s.account_code || "-"}
                                          </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              {hasReport ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black tracking-widest border border-emerald-200">
                                  <Icon name="check" className="w-3 h-3" strokeWidth="3" />
                                  ส่งแล้ว
                                </span>
                              ) : group.report && group.report.status === 'pending' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black tracking-widest border border-amber-200">
                                  <Icon name="clock" className="w-3 h-3" strokeWidth="3" />
                                  อาจารย์นัดส่งงาน
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black tracking-widest border border-rose-200">
                                  <Icon name="x" className="w-3 h-3" strokeWidth="3" />
                                  ยังไม่ส่ง
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-black text-blue-600 text-[14px] align-middle">{hasReport ? (group.report.weekly_score_work ?? "-") : "-"}</td>
                            <td className="px-4 py-3 text-center font-black text-sky-600 text-[14px] align-middle">{hasReport ? (group.report.weekly_score_document ?? "-") : "-"}</td>
                            <td className="px-4 py-3 text-center align-middle">
                              {hasReport && group.report.drive_link ? (
                                <a href={group.report.drive_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-colors" title="เปิดลิงก์งาน">
                                  <Icon name="externalLink" className="w-4 h-4" />
                                </a>
                              ) : (
                                <span className="text-slate-300 font-bold inline-block">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              {(() => {
                                const pdfList = hasReport ? parsePdfUrls(group.report.pdf_url) : [];
                                return pdfList.length > 0 ? (
                                  <button
                                    onClick={() => handleViewPDFs(pdfList, `รายงานสัปดาห์ที่ ${group.report.week_number}`)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors duration-200 text-[11px] font-bold"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                    เปิดดูไฟล์ {pdfList.length > 1 ? `(${pdfList.length})` : ''}
                                  </button>
                                ) : (
                                  <span className="text-slate-300 font-bold inline-block">-</span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              {hasReport ? (
                                <button 
                                  onClick={() => handleAddFeedback(group.report.report_id, group.report.instructor_feedback, overviewWeek)}
                                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors flex items-center justify-center gap-1.5 mx-auto ${
                                    group.report.instructor_feedback
                                      ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                                      : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                                  }`}
                                >
                                  <Icon name="pencil" className="w-3.5 h-3.5" />
                                  {group.report.instructor_feedback ? "ดู/แก้ไข" : "เพิ่มคอมเมนต์"}
                                </button>
                              ) : (
                                <span className="text-slate-300 font-bold inline-block">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* --- MOBILE CARD VIEW --- */}
              <div className="block md:hidden divide-y divide-slate-100">
                {(() => {
                  const groups = [];
                  weeklyOverviewData.forEach(stu => {
                    if (!stu.project_id) {
                      groups.push({ id: `stu-${stu.auth_id}`, type: 'single', students: [stu], report: stu.report, project_title: stu.project_title });
                    } else {
                      let existing = groups.find(g => g.type === 'group' && g.project_id === stu.project_id);
                      if (existing) {
                        existing.students.push(stu);
                      } else {
                        groups.push({ id: `proj-${stu.project_id}`, type: 'group', project_id: stu.project_id, students: [stu], report: stu.report, project_title: stu.project_title });
                      }
                    }
                  });
                  
                  return groups.map((group, idx) => {
                    const hasReport = group.report && group.report.status !== 'pending';
                    return (
                      <div key={group.id} className="p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div className="pr-2 w-full">
                            {/* Project Info */}
                            <div className="flex flex-col mb-3">
                                <span className="text-[13px] font-bold text-slate-900 line-clamp-2" title={group.project_title}>{group.project_title || <span className="italic text-slate-400 font-normal">ยังไม่ได้ระบุชื่อโครงงาน</span>}</span>
                                {group.students[0]?.project_code && <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 w-fit">{group.students[0].project_code}</span>}
                                {group.students[0]?.project_advisor && <span className="text-[11px] text-indigo-600 mt-1 truncate">อ.ที่ปรึกษา: {group.students[0].project_advisor}</span>}
                            </div>
                            {/* Member List */}
                            <div className="flex flex-col gap-2 shrink-0 border-t border-slate-100 pt-3">
                              {group.students.map((s) => (
                                <div key={s.auth_id} className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-[9px] font-bold text-slate-600 border border-slate-300">
                                     {s.profile_image ? (
                                        <img src={s.profile_image} alt="" className="w-full h-full object-cover" />
                                     ) : (s.first_name?.charAt(0) || "?")}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                      <div className="text-[11px] text-slate-700 font-medium truncate">
                                          {s.first_name} {s.last_name}
                                      </div>
                                      <div className="text-[9px] text-slate-400 truncate w-full tracking-widest">
                                          {s.account_code || "-"}
                                      </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {hasReport ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black tracking-widest border border-emerald-200">
                                <Icon name="check" className="w-3 h-3" strokeWidth="3" />
                                ส่งแล้ว
                              </span>
                            ) : group.report && group.report.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black tracking-widest border border-amber-200">
                                <Icon name="clock" className="w-3 h-3" strokeWidth="3" />
                                อาจารย์นัดส่งงาน
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black tracking-widest border border-rose-200">
                                <Icon name="x" className="w-3 h-3" strokeWidth="3" />
                                ยังไม่ส่ง
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Scores */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">คะแนนงาน</span>
                            <span className="font-black text-blue-600 text-[16px] leading-none">{hasReport ? (group.report.weekly_score_work ?? "-") : "-"}</span>
                          </div>
                          <div className="flex flex-col border-l border-slate-200 pl-3">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">คะแนนเอกสาร</span>
                            <span className="font-black text-sky-600 text-[16px] leading-none">{hasReport ? (group.report.weekly_score_document ?? "-") : "-"}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        {hasReport && (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              {group.report.drive_link && (
                                <a href={group.report.drive_link} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex justify-center items-center gap-1.5 p-2 bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-[12px] font-bold">
                                  <Icon name="externalLink" className="w-3.5 h-3.5" />
                                  ลิงก์ผลงาน
                                </a>
                              )}

                              {(() => {
                                const pdfList = parsePdfUrls(group.report.pdf_url);
                                return pdfList.length > 0 && (
                                  <button
                                    onClick={() => handleViewPDFs(pdfList, `รายงานสัปดาห์ที่ ${group.report.week_number}`)}
                                    className="flex-1 inline-flex justify-center items-center gap-1.5 px-2.5 py-2 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors text-[12px] font-bold"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                      <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                    เปิดดูไฟล์
                                  </button>
                                );
                              })()}
                            </div>
                            
                            <button
                              onClick={() => handleAddFeedback(group.report.report_id, group.report.instructor_feedback, overviewWeek)}
                              className={`w-full text-[12px] font-bold px-2.5 py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                                group.report.instructor_feedback
                                  ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                                  : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                              }`}
                            >
                              <Icon name="pencil" className="w-3.5 h-3.5" />
                              {group.report.instructor_feedback ? "ดู/แก้ไขคอมเมนต์" : "เพิ่มคอมเมนต์"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </ModalShell>
      )}

      {/* --- Floating Chat Button --- */}
      <button
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex justify-center items-center hover:bg-blue-700 hover:shadow-xl transition-all z-40"
        title="ข้อความแชท"
        onClick={handleOpenChat}
      >
        <svg className="shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>


      {/* ================= MODAL: ข้อเสนอโครงงานเริ่มต้น (ดูรายละเอียดโครงงาน) ================= */}
      {isProjectDetailModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsProjectDetailModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            
            {loadingProjectInfo ? (
              <div className="flex flex-col items-center justify-center py-20 text-blue-500 font-bold">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                กำลังโหลดข้อมูลโครงงาน...
              </div>
            ) : projectDetailData?.projectData && (
              <>
                {/* Modal Header */}
                <div className="bg-white px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-fit uppercase tracking-wide">หัวข้อโครงงาน</div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight break-words whitespace-normal">{projectDetailData.projectData.title}</h3>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 shrink-0 mt-2 sm:mt-0">
                    <button onClick={() => setIsProjectDetailModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-full transition-colors border border-slate-100">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col lg:flex-row gap-4 bg-slate-50/50 custom-scrollbar">
                  
                  {/* ซ้าย: ข้อมูลโปรเจกต์ */}
                  <div className="flex-[3] space-y-4">
                    
                    {/* ผู้เกี่ยวข้อง & สถานะ */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden shrink-0">
                          {(() => {
                            const leader = projectDetailData.members?.find(m => m.role === 'leader')?.users;
                            return leader?.profile_image ? <img src={leader.profile_image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-lg">{leader?.first_name?.charAt(0) || "U"}</div>;
                          })()}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 mb-0.5 uppercase tracking-wider">คู่สนทนา / ผู้เกี่ยวข้อง</p>
                          <p className="text-sm font-bold text-slate-800">
                            {(() => {
                              const leader = projectDetailData.members?.find(m => m.role === 'leader')?.users;
                              return leader ? `${leader.first_name} ${leader.last_name}` : "-";
                            })()}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                              นักศึกษา
                            </span>
                            {(() => {
                              const leader = projectDetailData.members?.find(m => m.role === 'leader')?.users;
                              if (leader?.major) {
                                return (
                                  <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    สาขา: {leader.major}
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
                        {getStatusBadge(projectDetailData.projectData.status)}
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
                          {projectDetailData.originalRequest?.project_scope || <span className="text-slate-400 italic">ไม่ได้ระบุขอบเขต</span>}
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
                          {projectDetailData.originalRequest?.language_used || <span className="text-slate-400 italic font-medium">ไม่ได้ระบุ</span>}
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
                          {projectDetailData.originalRequest?.diagram_url ? (
                            <a href={projectDetailData.originalRequest.diagram_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-start gap-1.5 bg-blue-50/50 p-2 rounded-lg border border-blue-100 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                              <span>คลิกเปิดลิงก์</span>
                            </a>
                          ) : <span className="text-slate-400 font-medium italic">- ไม่มีเอกสารแนบ -</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ขวา: ทีมและคำอธิบายเพิ่มเติม */}
                  <div className="flex-[2] flex flex-col gap-4">

                    {/* คำอธิบาย / รายละเอียดเพิ่มเติม */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[160px]">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 shrink-0">
                         <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                         </svg>
                         รายละเอียดเพิ่มเติม
                      </div>
                      <div className="flex-1 text-[13px] text-slate-700 font-medium whitespace-pre-wrap break-words leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 custom-scrollbar">
                        {(projectDetailData.originalRequest?.message || "").replace(/\[หมายเหตุระบบ\]:[^\n]*/g, "").replace(/\[สมาชิกในกลุ่ม\]:[\s\S]*/, "").replace(/\[หมายเหตุ(.*?)\]:\s*([\s\S]*)$/, "").trim() || (
                          <div className="h-full flex items-center justify-center text-slate-400 italic">
                            ไม่มีรายละเอียดเพิ่มเติม
                          </div>
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
                      {(() => {
                        const leader = projectDetailData.members?.find(m => m.role === 'leader')?.users;
                        if (!leader) return null;
                        return (
                          <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
                            <div className="flex items-center gap-2.5">
                              {leader.profile_image ? (
                                <img src={leader.profile_image} alt="" className="w-9 h-9 rounded-full border-2 border-amber-400 object-cover shadow-sm shrink-0" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                </div>
                              )}
                              <div>
                                <div className="text-[13px] font-bold text-slate-800">{leader.first_name} {leader.last_name}</div>
                                <div className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded inline-block">หัวหน้าทีม</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ลูกทีม */}
                      <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                        {projectDetailData.members?.filter(m => m.role !== 'leader').map((member, index) => {
                          const u = member.users;
                          return (
                            <div key={index} className="flex justify-between items-center group">
                              <div className="flex items-center gap-2.5">
                                {u.profile_image ? (
                                  <img src={u.profile_image} alt="" className="w-8 h-8 rounded-full border border-slate-200 object-cover shadow-sm group-hover:border-slate-300 transition-colors shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm group-hover:border-slate-300 transition-colors text-xs font-bold">
                                    {u.first_name?.charAt(0) || "U"}
                                  </div>
                                )}
                                <div>
                                  <div className="text-[12px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{u.first_name} {u.last_name}</div>
                                  <div className="text-[10px] font-medium text-slate-500">สมาชิก</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {(!projectDetailData.members || projectDetailData.members.filter(m => m.role !== 'leader').length === 0) && (
                          <div className="text-center py-2 text-slate-400 text-xs italic">ไม่มีสมาชิกเพิ่มเติม</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <ModalShell
          title={
            <div>
              <div className="font-bold text-[17px] m-0 truncate">เชิญนักศึกษาเข้าห้องเรียน</div>
              <div className="text-[13px] text-slate-500 font-bold">ค้นหาและเพิ่มนักศึกษาเข้าสู่ห้องเรียนของคุณ</div>
            </div>
          }
          icon={<Icon name="search" />}
          onClose={() => {
            setIsInviteModalOpen(false);
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
                  placeholder="รหัสนักศึกษา, ชื่อ, หรือนามสกุล (2 ตัวอักษรขึ้นไป)"
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
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-blue-600 font-bold text-[13px] tracking-wide">กำลังค้นหา...</span>
                </div>
              ) : inviteSearchQuery.trim().length >= 2 && inviteSearchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-300">
                  <div className="w-20 h-20 bg-slate-50 border-2 border-slate-100 rounded-full flex items-center justify-center mb-4 shadow-sm shrink-0">
                    <svg className="w-10 h-10 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <h4 className="font-bold text-[16px] text-slate-700 mb-1">ไม่พบข้อมูลนักศึกษา</h4>
                  <p className="text-[13px] font-medium text-slate-500 max-w-[260px]">
                    ไม่มีนักศึกษาที่ตรงกับคำค้นหานี้ <br/>หรือนักศึกษาอาจอยู่ในห้องเรียนนี้แล้ว
                  </p>
                </div>
              ) : inviteSearchQuery.trim().length < 2 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-300">
                  <div className="relative mb-5">
                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-md opacity-50 scale-110"></div>
                    <div className="relative w-24 h-24 bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100/50 rounded-full flex items-center justify-center shadow-sm shrink-0">
                      <svg className="w-12 h-12 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                  </div>
                  <h4 className="text-[17px] font-extrabold text-slate-800 mb-2">ค้นหานักศึกษาที่ต้องการเชิญ</h4>
                  <p className="text-[13px] text-slate-500 font-medium max-w-[280px] leading-relaxed">
                    พิมพ์รหัสนักศึกษา, ชื่อ, หรือนามสกุล <br/>(อย่างน้อย 2 ตัวอักษร) เพื่อเริ่มค้นหา
                  </p>
                </div>
              ) : (
                <div className="p-4 flex flex-col gap-3">
                  {inviteSearchResults.map(student => (
                    <div key={student.auth_id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-300 hover:shadow-md transition-all group">
                      <div className="flex items-center gap-3">
                        <Avatar src={student.profile_image} name={student.first_name || 'N'} size="sm" />
                        <div>
                          <p className="font-bold text-[14px] text-slate-800 group-hover:text-blue-700 transition-colors">
                            {student.prefix || ''}{student.first_name} {student.last_name}
                          </p>
                          <p className="text-[12px] text-blue-500/80 font-bold tracking-wide">
                            {student.account_code || "ไม่มีรหัสนักศึกษา"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddStudentToList(student)}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-[12px] font-bold rounded-xl transition-colors border border-blue-100 hover:border-blue-600 flex items-center gap-1.5 shadow-sm"
                      >
                        <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                        เลือก
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer with Submit Button */}
            {selectedStudentsToInvite.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                <button
                  onClick={handleInviteMultipleStudents}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm text-[15px]"
                >
                  เพิ่มเข้าห้องทั้งหมด ({selectedStudentsToInvite.length} คน)
                </button>
              </div>
            )}
          </div>
        </ModalShell>
      )}

    </div>
  );
}
