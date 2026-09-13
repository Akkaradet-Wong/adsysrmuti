// ===============================================
// src/components/Header.jsx
// ===============================================
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import { supabase } from "../lib/supabaseClient";
import { logoutAll } from "../lib/authUtils";

// Toast Notification Setup
const Toast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 4000, 
  timerProgressBar: true,
  background: '#ffffff',
  color: '#0f172a',
  iconColor: '#4f46e5',
  customClass: {
    popup: 'rounded-2xl shadow-lg border border-slate-100'
  },
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

export default function Header({ user, fullName, profileImage, role }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const menuRef = useRef(null);
  const notiRef = useRef(null);
  

  const [dbUser, setDbUser] = useState(null);
  const [notificationList, setNotificationList] = useState([]);
  const [notifications, setNotifications] = useState({ projects: 0, chat: 0, system: 0, appointments: 0, total: 0 });

  const [notiFilter, setNotiFilter] = useState('all'); 
  const [ignoredProjectNoti, setIgnoredProjectNoti] = useState(0);

  const userRoomsRef = useRef([]);
  const userProjectsRef = useRef([]);

  // ----------------------------------------------------
  // 1. Fetch User Data
  // ----------------------------------------------------
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.email) return; 
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", user.email)
        .single();

      if (data && !error) setDbUser(data);
    };
    fetchUserData();
  }, [user]);

  const getAvatarInitials = (name) => {
    if (!name || name === "กำลังโหลด...") return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const fireModernToast = ({
    headerTitle = "การแจ้งเตือนใหม่",
    title = "",
    message = "",
    avatar = null,
    avatarText = null,
    badgeType = "info", // "chat" | "success" | "info" | "warning" | "error"
    timeText = "เพิ่งส่งเมื่อสักครู่",
    link = null
  }) => {
    const safeTitle = (title || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeMsg = (message || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let badgeBg = "#3b82f6";
    let badgeSvg = `<svg class="shrink-0" width="10" height="10" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

    if (badgeType === 'chat') {
      badgeBg = "#22c55e";
      badgeSvg = `<svg class="shrink-0" width="11" height="11" fill="white" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
    } else if (badgeType === 'success') {
      badgeBg = "#22c55e";
      badgeSvg = `<svg class="shrink-0" width="11" height="11" fill="white" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>`;
    } else if (badgeType === 'warning') {
      badgeBg = "#f59e0b";
      badgeSvg = `<svg class="shrink-0" width="10" height="10" fill="white" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;
    } else if (badgeType === 'error') {
      badgeBg = "#ef4444";
      badgeSvg = `<svg class="shrink-0" width="10" height="10" fill="white" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
    }

    let avatarHtml = '';
    if (avatar && typeof avatar === 'string' && avatar.trim().length > 0) {
      avatarHtml = `<img src="${avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 1px solid #e2e8f0;" />`;
    } else if (avatarText) {
      avatarHtml = `<div style="width: 48px; height: 48px; border-radius: 50%; background: #eff6ff; color: #2563eb; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid #dbeafe;">${avatarText}</div>`;
    } else {
      avatarHtml = `<div style="width: 48px; height: 48px; border-radius: 50%; background: #eff6ff; color: #2563eb; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid #dbeafe;">
        <svg class="shrink-0" width="22" height="22" fill="#2563eb" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
      </div>`;
    }

    Swal.fire({
      toast: true,
      position: 'bottom-end',
      showConfirmButton: false,
      showCancelButton: false,
      showCloseButton: false,
      timer: 5500,
      timerProgressBar: false,
      background: '#ffffff',
      html: `
        <div style="display: flex; flex-direction: column; width: 100%; text-align: left; font-family: 'Kanit', sans-serif; letter-spacing: -0.2px;">
          <!-- Top Row (Header & Close Button) -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="color: #0f172a; font-weight: 700; font-size: 14.5px;">${headerTitle}</span>
            <div id="toast-close-btn" style="background: #f1f5f9; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; font-size: 13px; font-weight: bold; transition: all 0.2s;">✕</div>
          </div>
          <!-- Content Row -->
          <div style="display: flex; align-items: flex-start; gap: 14px;">
            <!-- Avatar with Badge -->
            <div style="position: relative; flex-shrink: 0; margin-top: 1px;">
              ${avatarHtml}
              <!-- Badge attached to avatar -->
              <div style="position: absolute; bottom: -2px; right: -4px; width: 22px; height: 22px; background: ${badgeBg}; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                ${badgeSvg}
              </div>
            </div>
            <!-- Message Body -->
            <div style="flex: 1; min-width: 0; line-height: 1.45;">
              <div style="font-size: 14px; color: #334155; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;">
                ${safeTitle ? `<span style="font-weight: 700; color: #0f172a;">${safeTitle}</span> ` : ''}${safeMsg}
              </div>
              <div style="font-size: 12.5px; color: #2563eb; margin-top: 4px; font-weight: 600;">${timeText}</div>
            </div>
            <!-- Unread Blue Dot -->
            <div style="width: 9px; height: 9px; border-radius: 50%; background: #2563eb; flex-shrink: 0; margin-top: 8px; margin-left: 4px;"></div>
          </div>
        </div>
      `,
      customClass: {
        popup: '!bg-white !rounded-[24px] cursor-pointer !p-4 !shadow-2xl border border-slate-100/80',
        htmlContainer: '!m-0',
      },
      didOpen: (toast) => {
        const closeBtn = toast.querySelector('#toast-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            Swal.close();
          });
        }
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
        if (link) {
          toast.addEventListener('click', (e) => {
             if (e.target.closest('#toast-close-btn')) return;
             Swal.close();
             navigate(link);
          });
        }
      }
    });
  };

  const fireChatToast = (name, text, imgUrl, path) => {
    const initials = getAvatarInitials(name);
    fireModernToast({
      headerTitle: "การแจ้งเตือนใหม่",
      title: name,
      message: `ได้ส่งข้อความ: "${text}"`,
      avatar: imgUrl,
      avatarText: initials,
      badgeType: "chat",
      timeText: "เพิ่งส่งเมื่อสักครู่",
      link: path || "/chat"
    });
  };

  const fireNavigableToast = (icon, title, path, headerTitle = "การแจ้งเตือนระบบ") => {
    let badgeType = "info";
    if (icon === "success") badgeType = "success";
    else if (icon === "warning") badgeType = "warning";
    else if (icon === "error") badgeType = "error";

    fireModernToast({
      headerTitle: headerTitle,
      title: "",
      message: title,
      badgeType: badgeType,
      timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่",
      link: path
    });
  };


  useEffect(() => {
    if (notifications.projects < ignoredProjectNoti) {
      setIgnoredProjectNoti(notifications.projects);
    }
  }, [notifications.projects, ignoredProjectNoti]);

  // ----------------------------------------------------
  // 2. Fetch Notifications Function
  // ----------------------------------------------------
  const handleAcceptInvite = async (type, rawId) => {
    const result = await Swal.fire({
      title: "ยืนยันการเข้าร่วม?",
      text: "คุณแน่ใจหรือไม่ที่จะเข้าร่วมกลุ่มนี้?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563EB",
      cancelButtonColor: "#F1F5F9",
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>",
      reverseButtons: true,
      customClass: { popup: "!rounded-[24px] !p-6" }
    });

    if (result.isConfirmed) {
      try {
        if (type === 'co_advisor_invite') {
          const { error } = await supabase.from('projects').update({ co_advisor_status: 'accepted' }).eq('project_id', rawId);
          if (error) throw error;
        } else {
          const table = type === 'room_invite' ? 'room_members' : 'project_members';
          const { error } = await supabase.from(table).update({ status: 'approved' }).eq('id', rawId);
          if (error) throw error;
        }
        Swal.fire({ title: "สำเร็จ", text: type === 'co_advisor_invite' ? "ตอบรับเป็นที่ปรึกษาร่วมแล้ว" : "เข้าร่วมกลุ่มเรียบร้อยแล้ว", icon: "success", timer: 1500, showConfirmButton: false });
        fetchNotifications();
      } catch (err) {
        Swal.fire("เกิดข้อผิดพลาด", err.message, "error");
      }
    }
  };

  const handleDeclineInvite = async (type, rawId, e) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: "ปฏิเสธคำเชิญ?",
      text: "คุณต้องการปฏิเสธและลบคำเชิญนี้หรือไม่?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#F1F5F9",
      confirmButtonText: "ลบคำเชิญ",
      cancelButtonText: "<span class='text-slate-700'>ยกเลิก</span>",
      reverseButtons: true,
      customClass: { popup: "!rounded-[24px] !p-6" }
    });

    if (result.isConfirmed) {
      try {
        if (type === 'co_advisor_invite') {
          const { error } = await supabase.from('projects').update({ co_advisor_status: 'rejected' }).eq('project_id', rawId);
          if (error) throw error;
        } else if (type === 'project_invite') {
          const { data: pmInfo } = await supabase
            .from('project_members')
            .select('student_id, project_id, projects(title, leader_id), users:users!project_members_student_id_fkey(first_name, last_name, email)')
            .eq('id', rawId)
            .maybeSingle();

          const { error } = await supabase.from('project_members').delete().eq('id', rawId);
          if (error) throw error;

          if (pmInfo?.projects?.leader_id) {
            const uName = `${pmInfo.users?.first_name || ''} ${pmInfo.users?.last_name || ''}`.trim() || 'นักศึกษา';
            await supabase.from('notifications').insert({
              user_id: pmInfo.projects.leader_id,
              title: 'สมาชิกปฏิเสธคำเชิญ',
              message: `${uName} ได้ปฏิเสธคำเชิญเข้าร่วมกลุ่มโครงงาน "${pmInfo.projects.title || ''}"`,
              is_read: false,
              created_at: new Date().toISOString()
            });
          }
        } else {
          const table = 'room_members';
          const { error } = await supabase.from(table).delete().eq('id', rawId);
          if (error) throw error;
        }
        Swal.fire({ title: "ปฏิเสธคำเชิญแล้ว", icon: "success", timer: 1500, showConfirmButton: false, toast: true, position: 'bottom-end' });
        fetchNotifications();
      } catch (err) {
        Swal.fire("เกิดข้อผิดพลาด", err.message, "error");
      }
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!dbUser) return;

    const userEmail = dbUser.email;
    const userAuthId = dbUser.auth_id;
    const currentUserRole = dbUser.role?.toLowerCase();

    const lastReadNotiStr = localStorage.getItem(`last_read_noti_${userEmail}`) || (userAuthId ? localStorage.getItem(`last_read_noti_${userAuthId}`) : null);
    const lastReadTime = lastReadNotiStr ? new Date(lastReadNotiStr).getTime() : 0;
    const readIds = JSON.parse(localStorage.getItem(`read_noti_ids_${userEmail}`) || "[]");

    const checkIsRead = (id, timeStr, defaultIsRead = false) => {
      if (defaultIsRead) return true;
      if (id && readIds.includes(String(id))) return true;
      if (timeStr && lastReadTime && new Date(timeStr).getTime() <= lastReadTime) return true;
      return false;
    };

    try {
      let projectCount = 0;
      let chatCount = 0;
      let appointmentCount = 0;
      let unreadSysNotis = 0;
      let tempNotiList = [];
      let currentRooms = [];
      let currentProjects = [];

      // ==========================================
      // A.0. Pending Invites (Room & Project)
      // ==========================================
      if (currentUserRole === "student") {
        const { data: roomInvites } = await supabase
          .from("room_members")
          .select("id, joined_at, project_rooms(title, display_id)")
          .eq("user_id", userAuthId)
          .eq("status", "pending")
          .order("joined_at", { ascending: false });

        roomInvites?.forEach(invite => {
          const isRead = checkIsRead('room_invite_' + invite.id, invite.joined_at, false);
          if (!isRead) projectCount++;
          tempNotiList.push({
            id: 'room_invite_' + invite.id,
            raw_id: invite.id,
            type: 'room_invite',
            title: 'คำเชิญเข้าห้องเรียน',
            message: `คุณได้รับคำเชิญให้เข้าร่วมห้องเรียน "${invite.project_rooms?.title || invite.project_rooms?.display_id}" คุณจะเข้ากลุ่มหรือไม่?`,
            time: invite.joined_at || new Date().toISOString(),
            link: null,
            is_read: isRead
          });
        });

        try {
            const { data: projInvites } = await supabase
              .from("project_members")
              .select("id, projects(title)")
              .eq("student_id", userAuthId)
              .eq("status", "pending");

            projInvites?.forEach(invite => {
              const isRead = checkIsRead('proj_invite_' + invite.id, new Date().toISOString(), false);
              if (!isRead) projectCount++;
              tempNotiList.push({
                id: 'proj_invite_' + invite.id,
                raw_id: invite.id,
                type: 'project_invite',
                title: 'คำเชิญเข้ากลุ่มโครงงาน',
                message: `คุณได้รับคำเชิญให้เข้าร่วมกลุ่มโครงงาน "${invite.projects?.title || 'ไม่ระบุชื่อ'}" คุณจะเข้ากลุ่มหรือไม่?`,
                time: new Date().toISOString(),
                link: null,
                is_read: isRead
              });
            });
        } catch (e) {
            console.log("No status column in project_members yet", e);
        }
      }

      // ==========================================
      // A. System Notifications & Invites
      // ==========================================
      const { data: sysNotis } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.ilike.${userEmail},user_id.eq.${userAuthId}`)
        .order("created_at", { ascending: false })
        .limit(20);

      sysNotis?.forEach(n => {
        const isInvite = n.message?.includes('เชิญ') || n.message?.includes('คำขอ');
        const isRead = checkIsRead(n.notification_id, n.created_at, n.is_read);
        if (!isRead) unreadSysNotis++;
        
        let targetLink = '/dashboard';
        if (n.message?.includes('โครงงาน') || n.message?.includes('อัปเดตสถานะโครงงาน') || n.message?.includes('รายงานความคืบหน้า')) {
            targetLink = '/project';
        } else if (n.message?.includes('คำร้อง') || n.message?.includes('ที่ปรึกษา')) {
            targetLink = '/advisor/requests';
        } else if (n.message?.includes('ห้องเรียน') || n.message?.includes('ประกาศ')) {
            targetLink = '/classroom';
        }

        tempNotiList.push({
          id: n.notification_id,
          type: isInvite ? 'invite' : 'system',
          title: isInvite ? 'คำเชิญ / แจ้งเตือนโครงงาน' : 'แจ้งเตือนระบบ',
          message: n.message,
          time: n.created_at,
          link: targetLink, 
          is_read: isRead
        });
      });

      // ==========================================
      // B. Advisor Requests & Co-Advisor Invites
      // ==========================================
      if (currentUserRole === "advisor" || currentUserRole === "admin") {
        
        // 1. คำขอจากนักศึกษา
        const { data: reqs } = await supabase
          .from("requests")
          .select("*, student:users!requests_student_id_fkey(first_name, last_name)")
          .eq("advisor_id", userAuthId)
          .order("updated_at", { ascending: false })
          .limit(10);

        reqs?.forEach(r => {
          const st = r.status?.toLowerCase();
          const isPending = st === 'pending';
          const isRead = checkIsRead(r.request_id, r.updated_at || r.created_at, !isPending);
          if (isPending && !isRead) projectCount++;

          let t = "อัปเดตคำขอ";
          if(st === 'pending') t = "คำร้องขอที่ปรึกษาใหม่";
          else if(st === 'approved' || st === 'accepted') t = "อนุมัติคำขอแล้ว";
          else if(st === 'rejected') t = "ปฏิเสธคำขอแล้ว";
          else if(st === 'canceled' || st === 'cancelled') t = "นศ. ยกเลิกคำขอ";

          tempNotiList.push({
            id: r.request_id,
            type: 'request',
            title: t,
            message: `${r.student?.first_name || 'นักศึกษา'}: ${r.project_title}`,
            time: r.updated_at || r.created_at,
            link: '/advisor/requests', 
            is_read: isRead
          });
        });

        // 2. คำเชิญเป็นที่ปรึกษาร่วม (Co-Advisor)
        const { data: coReqs } = await supabase
          .from("projects")
          .select("project_id, title, updated_at, created_at, co_advisor_status")
          .eq("co_advisor_id", userAuthId)
          .order("updated_at", { ascending: false })
          .limit(10);

        coReqs?.forEach(p => {
          if (!p.co_advisor_status) return;
          const st = p.co_advisor_status?.toLowerCase();
          const isPending = st === 'pending' || st === 'co_advisor_pending' || st === 'รอพิจารณา' || st === 'รออนุมัติ';
          const isRead = checkIsRead(p.project_id + '_co', p.updated_at || p.created_at, !isPending);
          if (isPending && !isRead) projectCount++;

          let t = "อัปเดตที่ปรึกษาร่วม";
          if(isPending) t = "คำเชิญเป็นที่ปรึกษาร่วม";
          else if(st === 'accepted' || st === 'อนุมัติแล้ว') t = "ตอบรับเป็นที่ปรึกษาร่วมแล้ว";
          else if(st === 'rejected' || st === 'ปฏิเสธ') t = "ปฏิเสธคำเชิญแล้ว";

          tempNotiList.push({
            id: p.project_id + '_co', 
            type: 'co_advisor_invite',
            title: t,
            message: `โครงงาน: ${p.title}`,
            time: p.updated_at || p.created_at,
            link: '/advisor/requests', 
            is_read: isRead
          });
        });
      }

      // ==========================================
      // C. Student View (อัปเดตสถานะโครงงาน & คำเชิญเข้ากลุ่ม)
      // ==========================================
      if (currentUserRole === "student") {
        // 1. คำขอที่ตนเองเป็นหัวหน้ากลุ่ม (ผู้ส่งคำขอ)
        const { data: myReqs } = await supabase
          .from("requests")
          .select("*, advisor:users!requests_advisor_id_fkey(prefix, first_name, last_name)")
          .eq("student_id", userAuthId)
          .order("updated_at", { ascending: false })
          .limit(10);

        myReqs?.forEach(r => {
           const st = r.status?.toLowerCase();
           const advisorName = r.advisor ? `${r.advisor.prefix || 'อาจารย์'}${r.advisor.first_name} ${r.advisor.last_name}` : 'อาจารย์ที่ปรึกษา';
           const isPending = st === 'pending';
           const isRead = checkIsRead(r.request_id, r.updated_at || r.created_at, !isPending);
           if (isPending && !isRead) projectCount += 1;

           let t = "อัปเดตสถานะโครงงาน";
           let msg = `เรื่อง: ${r.project_title}`;

           if (st === 'pending') {
               t = `รอผลการอนุมัติ (${advisorName})`;
               msg = `คุณได้ส่งคำขอโครงงาน '${r.project_title}' ไปยัง ${advisorName} (อยู่ระหว่างรอผลอนุมัติ)`;
           }
           else if (st === 'approved' || st === 'accepted') {
               t = "โครงงานอนุมัติแล้ว";
               msg = `โครงงาน '${r.project_title}' ได้รับการตอบรับจาก ${advisorName} แล้ว`;
           }
           else if (st === 'rejected') {
               t = "โครงงานถูกปฏิเสธ";
               msg = `คำขอโครงงาน '${r.project_title}' ถูกปฏิเสธโดย ${advisorName}`;
           }
           else if (st === 'canceled' || st === 'cancelled') {
               t = "ยกเลิกคำขอแล้ว";
           }
           
           let targetLink = '/advisor/requests';
           if (st === 'approved' || st === 'accepted') targetLink = '/project';

           tempNotiList.push({
               id: r.request_id,
               type: 'request_update',
               title: t,
               message: msg,
               time: r.updated_at || r.created_at,
               link: targetLink, 
               is_read: isRead
           });
        });

        // 2. คำขอที่เพื่อนระบุตนเองเป็นสมาชิกในกลุ่ม (ผู้ถูกชวน)
        if (userEmail) {
          const { data: memberReqs } = await supabase
            .from("requests")
            .select("*, student:users!requests_student_id_fkey(prefix, first_name, last_name), advisor:users!requests_advisor_id_fkey(prefix, first_name, last_name)")
            .neq("student_id", userAuthId)
            .ilike("message", `%${userEmail}%`)
            .order("updated_at", { ascending: false })
            .limit(10);

          memberReqs?.forEach(r => {
             const st = r.status?.toLowerCase();
             const isPending = st === 'pending';
             const isRead = checkIsRead(`${r.request_id}_member`, r.updated_at || r.created_at, !isPending);
             if (isPending && !isRead) projectCount += 1;

             const leaderName = r.student ? `${r.student.prefix || ''}${r.student.first_name} ${r.student.last_name}`.trim() : 'หัวหน้ากลุ่ม';
             const advisorName = r.advisor ? `${r.advisor.prefix || 'อาจารย์'}${r.advisor.first_name} ${r.advisor.last_name}` : 'อาจารย์ที่ปรึกษา';

             let t = "คำเชิญเข้ากลุ่มโครงงาน";
             let msg = `${leaderName} ได้ชวนคุณเข้าร่วมกลุ่มโครงงาน '${r.project_title}' (ยื่นขอเป็นที่ปรึกษากับ ${advisorName})`;

             if (st === 'pending') {
                 t = "มีคำเชิญเข้าร่วมกลุ่ม (รอผลอนุมัติ)";
             }
             else if (st === 'approved' || st === 'accepted') {
                 t = "โครงงานที่คุณเป็นสมาชิกได้รับอนุมัติแล้ว";
                 msg = `โครงงาน '${r.project_title}' (โดย ${leaderName}) ได้รับการอนุมัติจาก ${advisorName} เรียบร้อยแล้ว`;
             }
             else if (st === 'rejected') {
                 t = "คำขอโครงงานที่คุณร่วมกลุ่มถูกปฏิเสธ";
                 msg = `คำขอโครงงาน '${r.project_title}' (โดย ${leaderName}) ถูกปฏิเสธ`;
             }
             else if (st === 'canceled' || st === 'cancelled') {
                 t = "คำขอโครงงานที่คุณร่วมกลุ่มถูกยกเลิก";
             }

             let targetLink = '/advisorsearch';
             if (st === 'approved' || st === 'accepted') targetLink = '/project';
             else if (st === 'pending') targetLink = '/advisorsearch';

             tempNotiList.push({
                 id: `${r.request_id}_member`,
                 type: 'group_invite',
                 title: t,
                 message: msg,
                 time: r.updated_at || r.created_at,
                 link: targetLink, 
                 is_read: isRead
             });
          });
        }
      }

      // ==========================================
      // D. Chat Notifications (แจ้งเตือนข้อความแชท)
      // ==========================================
      const { data: myRooms } = await supabase.from("room_members").select("room_id").eq("user_id", userAuthId);
      currentRooms = myRooms?.map(r => r.room_id) || [];
      
      if (currentUserRole === 'advisor' || currentUserRole === 'admin') {
          const { data: advisedProjects } = await supabase.from('projects').select('project_id').eq('advisor_id', userAuthId);
          currentProjects = advisedProjects?.map(p => p.project_id) || [];
          
          if (currentProjects.length > 0) {
              const { data: projectRooms } = await supabase.from('project_rooms').select('room_id').in('project_id', currentProjects);
              projectRooms?.forEach(pr => {
                  if (!currentRooms.includes(pr.room_id)) currentRooms.push(pr.room_id);
              });
          }
      } else if (currentUserRole === 'student') {
          const { data: myProjects } = await supabase.from('project_members').select('project_id').eq('student_id', userAuthId).eq('status', 'approved');
          const { data: leadProjects } = await supabase.from('projects').select('project_id').eq('leader_id', userAuthId);
          const allPIds = new Set([
              ...(myProjects?.map(p => p.project_id) || []),
              ...(leadProjects?.map(p => p.project_id) || [])
          ]);
          currentProjects = Array.from(allPIds);
      }

      userRoomsRef.current = currentRooms;
      userProjectsRef.current = currentProjects;

      if (currentRooms.length > 0 || currentProjects.length > 0) {
        let msgQuery = supabase
          .from("project_messages")
          .select("*, sender:users!project_messages_sender_id_fkey(first_name)", { count: "exact" })
          .neq("sender_id", userEmail)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(10);

        if (currentRooms.length > 0 && currentProjects.length > 0) {
            msgQuery = msgQuery.or(`room_id.in.(${currentRooms.join(',')}),project_id.in.(${currentProjects.join(',')})`);
        } else if (currentRooms.length > 0) {
            msgQuery = msgQuery.in("room_id", currentRooms);
        } else if (currentProjects.length > 0) {
            msgQuery = msgQuery.in("project_id", currentProjects);
        }

        const { data: msgs } = await msgQuery;
            
        msgs?.forEach(m => {
            const isRead = checkIsRead(m.message_id, m.created_at, m.is_read);
            if (!isRead) chatCount++;
            tempNotiList.push({
                id: m.message_id,
                type: 'chat',
                title: `ข้อความจาก ${m.sender?.first_name || 'ผู้ใช้'}`,
                message: m.file_url ? 'ส่งไฟล์แนบ' : m.content, 
                time: m.created_at,
                link: '/chat', 
                is_read: isRead
            });
        });
      }

      // ==========================================
      // E. Weekly Appointments & Submissions (ดักแจ้งเตือนนัดหมาย และการส่งงาน/ตรวจงาน)
      // ==========================================
      if (currentProjects.length > 0) {
        const { data: reports } = await supabase
          .from("project_reports")
          .select("report_id, week_number, due_date, task_assigned, status, created_at, updated_at, project_id, projects(title)")
          .in("project_id", currentProjects)
          .order("updated_at", { ascending: false })
          .limit(20);

        reports?.forEach(rpt => {
          const st = rpt.status;
          const projTitle = Array.isArray(rpt.projects) ? rpt.projects[0]?.title : rpt.projects?.title;

          // สำหรับนักศึกษา
          if (currentUserRole === 'student') {
            const isPending = st === 'pending' || st === 'assigned' || !st;
            
            // นัดหมายที่ยังไม่ส่ง
            if (isPending && rpt.due_date) {
              const isRead = checkIsRead(`pend_${rpt.report_id}`, rpt.created_at, false);
              if (!isRead) appointmentCount += 1;
              const dateObj = new Date(rpt.due_date);
              let formattedDate = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
              let formattedTime = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
              let dateTimeStr = `${formattedDate} เวลา ${formattedTime} น.`;

              tempNotiList.push({
                id: `pend_${rpt.report_id}`,
                type: 'appointment',
                title: `นัดหมายสัปดาห์ที่ ${rpt.week_number}`,
                message: `กำหนดการ: ${dateTimeStr} - ${rpt.task_assigned || 'อัปเดตความคืบหน้า'}`,
                time: rpt.created_at,
                link: `/project?id=${rpt.project_id}`, 
                is_read: isRead
              });
            } 
            // ส่งงานแล้ว
            else if (st === 'submitted') {
              tempNotiList.push({
                id: `sub_${rpt.report_id}`,
                type: 'appointment',
                title: `ส่งงานแล้ว (W${rpt.week_number})`,
                message: `ระบบได้รับงานสัปดาห์ที่ ${rpt.week_number} เรียบร้อยแล้ว (รอตรวจ)`,
                time: rpt.updated_at || rpt.created_at,
                link: `/project?id=${rpt.project_id}`, 
                is_read: true
              });
            }
            // ตรวจงานแล้ว
            else if (st === 'reviewed') {
              tempNotiList.push({
                id: `rev_${rpt.report_id}`,
                type: 'appointment',
                title: `ตรวจงานแล้ว (W${rpt.week_number})`,
                message: `อาจารย์ได้ตรวจและให้คะแนนงานสัปดาห์ที่ ${rpt.week_number} แล้ว`,
                time: rpt.updated_at || rpt.created_at,
                link: `/project?id=${rpt.project_id}`,
                is_read: true
              });
            }
          }
          
          // สำหรับอาจารย์ / ผู้ดูแลระบบ
          else if (currentUserRole === 'advisor' || currentUserRole === 'admin') {
            // โชว์แจ้งเตือนเมื่อนศ.ส่งงานแล้ว แต่ยังไม่ได้ตรวจ
            if (st === 'submitted') {
              const isRead = checkIsRead(`sub_${rpt.report_id}`, rpt.updated_at || rpt.created_at, false);
              if (!isRead) appointmentCount += 1;
              tempNotiList.push({
                id: `sub_${rpt.report_id}`,
                type: 'appointment',
                title: `นศ. ส่งงานแล้ว (W${rpt.week_number})`,
                message: `กลุ่ม ${projTitle || 'ไม่ระบุชื่อ'} ส่งงานสัปดาห์ที่ ${rpt.week_number} (รอตรวจ)`,
                time: rpt.updated_at || rpt.created_at,
                link: `/project?id=${rpt.project_id}`, 
                is_read: isRead
              });
            }
            // โชว์ประวัติการตรวจ
            else if (st === 'reviewed') {
              tempNotiList.push({
                id: `rev_${rpt.report_id}`,
                type: 'appointment',
                title: `ตรวจและให้คะแนนแล้ว (W${rpt.week_number})`,
                message: `กลุ่ม ${projTitle || 'ไม่ระบุชื่อ'} ถูกตรวจและให้คะแนนแล้ว`,
                time: rpt.updated_at || rpt.created_at,
                link: `/project?id=${rpt.project_id}`, 
                is_read: true
              });
            }
          }
        });
      }

      // เรียงลำดับเวลาใหม่สุดขึ้นก่อน
      tempNotiList.sort((a, b) => new Date(b.time) - new Date(a.time));
      
      setNotificationList(tempNotiList);
      setNotifications({
        projects: projectCount,
        chat: chatCount,
        system: unreadSysNotis,
        appointments: appointmentCount,
        total: projectCount + chatCount + unreadSysNotis + appointmentCount
      });

    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [dbUser]);

  // ----------------------------------------------------
  // 3. Realtime Listener
  // ----------------------------------------------------
  useEffect(() => {
    if (!dbUser?.email || !dbUser?.auth_id) return;
    
    fetchNotifications();
    const userEmail = dbUser.email;
    const userAuthId = dbUser.auth_id; 
    const currentUserRole = dbUser.role?.toLowerCase();

    const channel = supabase
      .channel(`global-noti-${userAuthId}`) 

      // 1. ดักการอัปเดตข้อมูลผู้ใช้
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "users", filter: `email=eq.${userEmail}` }, (payload) => {
          setDbUser(payload.new); 
      })

      // 2. ดักแจ้งเตือนระบบ
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userEmail}` }, (payload) => {
          fetchNotifications();
          if (payload.eventType === 'INSERT') {
            fireModernToast({
              headerTitle: "การแจ้งเตือนระบบ",
              title: "แจ้งเตือน:",
              message: payload.new.message || 'มีการแจ้งเตือนใหม่',
              badgeType: "info",
              timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่",
              link: "/dashboard"
            });
          }
      })

      // 3. ดักคำขอที่ปรึกษาโครงงาน
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, (payload) => {
          const isLeader = (payload.new && payload.new.student_id === userAuthId) || (payload.old && payload.old.student_id === userAuthId);
          const isAdvisor = (payload.new && payload.new.advisor_id === userAuthId) || (payload.old && payload.old.advisor_id === userAuthId);
          const isMember = userEmail && (
            (payload.new?.message && payload.new.message.includes(userEmail)) ||
            (payload.old?.message && payload.old.message.includes(userEmail))
          );

          if (isLeader || isAdvisor || isMember) {
             fetchNotifications();
             
             const evt = payload.eventType;
             const newReq = payload.new;
             const oldReq = payload.old;
             const title = newReq?.project_title || oldReq?.project_title;

             if (evt === 'INSERT') {
                 if (isAdvisor) fireModernToast({ headerTitle: "คำร้องขอใหม่", title: "มีคำขอใหม่:", message: title, badgeType: "info", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                 else if (isLeader) fireModernToast({ headerTitle: "ส่งคำขอสำเร็จ", title: "ส่งคำขอโครงงาน:", message: title, badgeType: "success", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                 else if (isMember) fireModernToast({ headerTitle: "คำเชิญเข้ากลุ่ม", title: "คุณมีคำเชิญเข้าร่วมกลุ่ม:", message: title, badgeType: "info", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisorsearch" });
             } 
             else if (evt === 'UPDATE') {
                 const newStatus = newReq?.status?.toLowerCase();
                 const oldStatus = oldReq?.status?.toLowerCase();
                 
                 if (newStatus !== oldStatus) {
                     if (isLeader) {
                        if (newStatus === 'approved' || newStatus === 'accepted') fireModernToast({ headerTitle: "โครงงานได้รับอนุมัติ", title: "อนุมัติแล้ว:", message: title, badgeType: "success", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/project" });
                        else if (newStatus === 'rejected') fireModernToast({ headerTitle: "คำขอถูกปฏิเสธ", title: "ถูกปฏิเสธ:", message: title, badgeType: "error", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisorsearch" });
                        else if (newStatus === 'canceled' || newStatus === 'cancelled') fireModernToast({ headerTitle: "ยกเลิกคำขอ", title: "ยกเลิกคำขอ:", message: title, badgeType: "warning", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                        else fireModernToast({ headerTitle: "สถานะเปลี่ยน", title: `สถานะเป็น ${newStatus}:`, message: title, badgeType: "info", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                     } else if (isMember) {
                        if (newStatus === 'approved' || newStatus === 'accepted') fireModernToast({ headerTitle: "โครงงานได้รับอนุมัติ", title: "โครงงานที่คุณเป็นสมาชิกได้รับอนุมัติ:", message: title, badgeType: "success", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/project" });
                        else if (newStatus === 'rejected') fireModernToast({ headerTitle: "คำขอถูกปฏิเสธ", title: "คำขอที่คุณร่วมกลุ่มถูกปฏิเสธ:", message: title, badgeType: "error", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisorsearch" });
                        else if (newStatus === 'canceled' || newStatus === 'cancelled') fireModernToast({ headerTitle: "ยกเลิกคำขอ", title: "คำขอที่คุณร่วมกลุ่มถูกยกเลิก:", message: title, badgeType: "warning", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                        else fireModernToast({ headerTitle: "สถานะเปลี่ยน", title: `สถานะโครงงานเป็น ${newStatus}:`, message: title, badgeType: "info", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                     }
                     if (isAdvisor) {
                        if (newStatus === 'canceled' || newStatus === 'cancelled') fireModernToast({ headerTitle: "นศ. ยกเลิกคำขอ", title: "ยกเลิกคำขอ:", message: `นศ. ยกเลิก ${title}`, badgeType: "warning", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                        else if (newStatus === 'approved' || newStatus === 'accepted') fireModernToast({ headerTitle: "อนุมัติสำเร็จ", title: "คุณอนุมัติโครงงาน:", message: title, badgeType: "success", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/project" });
                        else if (newStatus === 'rejected') fireModernToast({ headerTitle: "ปฏิเสธคำขอ", title: "คุณปฏิเสธคำขอ:", message: title, badgeType: "error", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                     }
                 }
             }
             else if (evt === 'DELETE') {
                 if (isAdvisor) fireModernToast({ headerTitle: "คำขอถูกลบ", title: "ลบคำขอ:", message: title, badgeType: "warning", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                 else if (isMember) fireModernToast({ headerTitle: "คำขอถูกลบ", title: "คำขอที่คุณร่วมกลุ่มถูกลบ:", message: title, badgeType: "warning", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
             }
          }
      })

      // ดักคำเชิญเข้าโครงงานของนักศึกษา
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members" }, (payload) => {
          const isMe = (payload.new && payload.new.student_id === userAuthId) || (payload.old && payload.old.student_id === userAuthId);
          if (isMe) {
              fetchNotifications();
              const evt = payload.eventType;
              if (evt === 'INSERT' && payload.new.status === 'pending') {
                  fireModernToast({ headerTitle: "คำเชิญเข้ากลุ่ม", title: "คำเชิญใหม่:", message: "คุณได้รับคำเชิญเข้าร่วมกลุ่มโครงงาน", badgeType: "info", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisorsearch" });
              } else if (evt === 'UPDATE' && payload.new.status === 'approved') {
                  fireModernToast({ headerTitle: "เข้าร่วมกลุ่มแล้ว", title: "สำเร็จ:", message: "คุณได้เข้าร่วมกลุ่มโครงงานเรียบร้อยแล้ว", badgeType: "success", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/project" });
              }
          }
      })

      // 4. ดักการเปลี่ยนแปลงโครงงานและที่ปรึกษาร่วม
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects" }, (payload) => {
          const isRelatedToMe = 
            (payload.new && (
              payload.new.advisor_id === userAuthId || 
              payload.new.co_advisor_id === userAuthId || 
              payload.new.leader_id === userAuthId ||
              userProjectsRef.current.includes(payload.new.project_id)
            ));

          if (isRelatedToMe) {
             fetchNotifications();
             
             const newStatus = payload.new?.status?.toLowerCase();
             const oldStatus = payload.old?.status?.toLowerCase();
             const title = payload.new?.title;
             
             if (newStatus !== oldStatus) {
                 if (newStatus === 'completed') fireModernToast({ headerTitle: "โครงงานเสร็จสิ้น", title: "เสร็จสิ้น:", message: title, badgeType: "success", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/project" });
                 else if (newStatus === 'canceled' || newStatus === 'cancelled') fireModernToast({ headerTitle: "โครงงานถูกยกเลิก", title: "ถูกยกเลิก:", message: `โครงงาน ${title} ถูกยุบหรือยกเลิก`, badgeType: "error", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisorsearch" });
             }

             const newCoStatus = payload.new?.co_advisor_status?.toLowerCase();
             const oldCoStatus = payload.old?.co_advisor_status?.toLowerCase();
             
             if (newCoStatus !== oldCoStatus) {
                 if (payload.new.co_advisor_id === userAuthId) {
                     const isPending = newCoStatus === 'pending' || newCoStatus === 'co_advisor_pending' || newCoStatus === 'รอพิจารณา';
                     if (isPending) fireModernToast({ headerTitle: "คำเชิญที่ปรึกษาร่วม", title: "ที่ปรึกษาร่วม:", message: `คุณได้รับเชิญเป็นที่ปรึกษาร่วมในโครงงาน ${title}`, badgeType: "info", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                     else if (newCoStatus === 'accepted' || newCoStatus === 'อนุมัติแล้ว') fireModernToast({ headerTitle: "ตอบรับที่ปรึกษาร่วม", title: "สำเร็จ:", message: `คุณตอบรับเป็นที่ปรึกษาร่วมในโครงงาน ${title}`, badgeType: "success", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/project" });
                 } else if (payload.new.advisor_id === userAuthId || payload.new.leader_id === userAuthId) {
                     if (newCoStatus === 'accepted' || newCoStatus === 'อนุมัติแล้ว') fireModernToast({ headerTitle: "ที่ปรึกษาร่วมตอบรับ", title: "สำเร็จ:", message: `อาจารย์ที่ปรึกษาร่วมตอบรับโครงงาน ${title} แล้ว`, badgeType: "success", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/project" });
                     else if ((!newCoStatus || newCoStatus === 'rejected' || newCoStatus === 'ปฏิเสธ') && oldCoStatus === 'pending') fireModernToast({ headerTitle: "ที่ปรึกษาร่วมปฏิเสธ", title: "ปฏิเสธคำเชิญ:", message: `อาจารย์ปฏิเสธการเป็นที่ปรึกษาร่วมในโครงงาน ${title}`, badgeType: "warning", timeText: "เพิ่งแจ้งเตือนเมื่อสักครู่", link: "/advisor/requests" });
                 }
             }
          }
      })

      // 5. ดักการสร้างนัดหมาย/ส่งงานและการตรวจงาน (Project Reports)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_reports" }, (payload) => {
          if (userProjectsRef.current.includes(payload.new.project_id)) {
              if (currentUserRole === 'student') {
                 fireNavigableToast('info', `มีการนัดหมายใหม่ สัปดาห์ที่ ${payload.new.week_number}`, `/project?id=${payload.new.project_id}`);
              }
              fetchNotifications();
          }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "project_reports" }, async (payload) => {
          if (payload.new.status !== payload.old.status && userProjectsRef.current.includes(payload.new.project_id)) {
              fetchNotifications(); // อัปเดตข้อมูลเพื่อให้กระดิ่งอัปเดตอัตโนมัติ
              
              const { data: proj } = await supabase.from('projects').select('title, advisor_id, co_advisor_id').eq('project_id', payload.new.project_id).single();
              
              if (proj) {
                  const isAdv = proj.advisor_id === userAuthId || proj.co_advisor_id === userAuthId || currentUserRole === 'admin';
                  
                  // ดักแจ้งเตือนตอน นศ. ส่งงาน (โชว์ที่อาจารย์)
                  if (payload.new.status === 'submitted' && isAdv) {
                      fireNavigableToast('info', `นศ. ส่งงานสัปดาห์ที่ ${payload.new.week_number}: ${proj.title}`, `/project?id=${payload.new.project_id}`);
                  } 
                  // ดักแจ้งเตือนตอน อาจารย์ ตรวจงานเสร็จ (โชว์ที่ นศ.)
                  else if (payload.new.status === 'reviewed' && !isAdv) {
                      fireNavigableToast('success', `อาจารย์ตรวจงานสัปดาห์ที่ ${payload.new.week_number} แล้ว`, `/project?id=${payload.new.project_id}`);
                  }
              }
          }
      })

      // 6. ดักข้อความแชทใหม่
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_messages" }, async (payload) => {
          const msg = payload.new;
          if (!msg || msg.sender_id === userEmail) return; 

          const isMyRoom = msg.room_id && userRoomsRef.current.some(id => String(id) === String(msg.room_id));
          const isMyProject = msg.project_id && userProjectsRef.current.some(id => String(id) === String(msg.project_id));

          if (isMyRoom || isMyProject) {
             fetchNotifications();
             if (!location.pathname.includes('/chat')) { 
                 const { data: senderData } = await supabase.from('users').select('first_name, last_name, profile_image').eq('email', msg.sender_id).single();
                 if (senderData) {
                     const name = `${senderData.first_name || ''} ${senderData.last_name || ''}`.trim() || 'ผู้ใช้';
                     const img = senderData.profile_image || `https://ui-avatars.com/api/?name=${name}&background=eff6ff&color=3b82f6`;
                     const text = msg.message || 'ส่งไฟล์หรือรูปภาพ';
                     fireChatToast(name, text, img, '/chat');
                 } else {
                     fireNavigableToast('info', 'คุณมีข้อความใหม่', '/chat');
                 }
             }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dbUser?.email, dbUser?.auth_id, fetchNotifications, location.pathname]);

  // Handle Outside Click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notiRef.current && !notiRef.current.contains(e.target)) setNotiOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotiClick = async (item) => {
    if (item.type === 'room_invite' || item.type === 'project_invite') return;
    setNotiOpen(false);

    const userEmail = (dbUser?.email || user?.email || '').trim();
    if (userEmail && item.id) {
      try {
        const readIds = JSON.parse(localStorage.getItem(`read_noti_ids_${userEmail}`) || "[]");
        if (!readIds.includes(String(item.id))) {
          readIds.push(String(item.id));
          localStorage.setItem(`read_noti_ids_${userEmail}`, JSON.stringify(readIds));
        }
      } catch (err) {
        console.warn("Storage error in noti click:", err);
      }
    }
    
    if (item.type === 'system' || item.type === 'invite') {
        await supabase.from('notifications').update({ is_read: true }).eq('notification_id', item.id);
    } else if (item.type === 'chat') {
        await supabase.from('project_messages').update({ is_read: true }).eq('message_id', item.id);
    }
    
    fetchNotifications();
    if (item.link) navigate(item.link);
  };

  const handleMarkAllRead = async (e) => {
      if (e) e.stopPropagation();
      const userEmail = (dbUser?.email || user?.email || '').trim();
      const userAuthId = dbUser?.auth_id || user?.id;
      if (!userEmail && !userAuthId) return;

      const nowIso = new Date().toISOString();
      if (userEmail) localStorage.setItem(`last_read_noti_${userEmail}`, nowIso);
      if (userAuthId) localStorage.setItem(`last_read_noti_${userAuthId}`, nowIso);

      // 1. เคลียร์จุดแดงและจำนวนแจ้งเตือนใน State ทันที
      setNotificationList(prev => prev.map(item => ({ ...item, is_read: true })));
      setNotifications({
        total: 0,
        appointments: 0,
        projects: 0,
        chat: 0,
        system: 0
      });

      try {
        // 2. อัปเดตฐานข้อมูลตาราง notifications
        const notiUpdates = [];
        if (userEmail) {
          notiUpdates.push(supabase.from('notifications').update({ is_read: true }).ilike('user_id', userEmail));
        }
        if (userAuthId) {
          notiUpdates.push(supabase.from('notifications').update({ is_read: true }).eq('user_id', userAuthId));
        }
        await Promise.all(notiUpdates);

        // 3. อัปเดตฐานข้อมูลตาราง project_messages
        if (userRoomsRef.current.length > 0 || userProjectsRef.current.length > 0) {
            let query = supabase.from('project_messages').update({ is_read: true });
            if (userEmail) query = query.neq('sender_id', userEmail);
            
            if (userRoomsRef.current.length > 0 && userProjectsRef.current.length > 0) {
                query = query.or(`room_id.in.(${userRoomsRef.current.join(',')}),project_id.in.(${userProjectsRef.current.join(',')})`);
            } else if (userRoomsRef.current.length > 0) {
                query = query.in("room_id", userRoomsRef.current);
            } else if (userProjectsRef.current.length > 0) {
                query = query.in("project_id", userProjectsRef.current);
            }
            await query;
        }
      } catch (err) {
        console.error("Error in handleMarkAllRead:", err);
      }

      await fetchNotifications();
  };

  const handleChatMenuClick = async () => {
    setMenuOpen(false);
    
    if(dbUser) {
      setNotifications(prev => ({ ...prev, chat: 0 })); 
      if (userRoomsRef.current.length > 0 || userProjectsRef.current.length > 0) {
          let query = supabase.from('project_messages').update({ is_read: true }).neq('sender_id', dbUser.email);
          if (userRoomsRef.current.length > 0 && userProjectsRef.current.length > 0) {
              query = query.or(`room_id.in.(${userRoomsRef.current.join(',')}),project_id.in.(${userProjectsRef.current.join(',')})`);
          } else if (userRoomsRef.current.length > 0) {
              query = query.in("room_id", userRoomsRef.current);
          } else if (userProjectsRef.current.length > 0) {
              query = query.in("project_id", userProjectsRef.current);
          }
          await query;
          fetchNotifications();
      }
    }
    navigate("/chat");
  };

  const handleProjectMenuClick = () => {
    setMenuOpen(false);
    setIgnoredProjectNoti(notifications.projects);
    navigate("/advisor/requests");
  };

  const formatTime = (dateString) => {
      if(!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const confirmLogout = async () => {
    const result = await Swal.fire({
      title: "ออกจากระบบ?",
      text: "คุณต้องการออกจากระบบใช่หรือไม่",
      icon: "warning",
      background: "#ffffff",
      color: "#0f172a",
      showCancelButton: true, reverseButtons: true,
      confirmButtonText: "ใช่, ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      customClass: {
        popup: 'rounded-2xl shadow-xl border border-slate-100'
      }
    });
    if (result.isConfirmed) {
      await logoutAll();
      navigate("/");
    }
  };

  const isActive = (path) => (location.pathname === path ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium");

  const getDisplayFullName = () => {
    if (dbUser) {
      const fName = dbUser.first_name || "";
      const lName = dbUser.last_name && dbUser.last_name !== "-" ? dbUser.last_name : "";
      return `${fName} ${lName}`.trim();
    }
    return fullName || "กำลังโหลด...";
  };

  const getDisplayRole = () => {
    const activeRole = dbUser?.role || role;
    switch (activeRole?.toLowerCase()) {
      case "advisor": 
        if (dbUser?.advisor_type === "อาจารย์ในสาขา") return "อาจารย์ในสาขา";
        if (dbUser?.advisor_type === "อาจารย์นอกสาขา") return "อาจารย์นอกสาขา";
        if (dbUser?.advisor_type === "บุคลากรภายนอก") return "บุคลากรภายนอก";
        return "อาจารย์ที่ปรึกษา";
      case "admin": return "ผู้ดูแลระบบ";
      case "student": return "นักศึกษา";
      default: return "";
    }
  };

  const getInitial = (name) => {
    if (!name || name === "กำลังโหลด...") return "U";
    return name.charAt(0).toUpperCase();
  };

  const displayFullName = getDisplayFullName();
  const displayRoleText = getDisplayRole();
  const rawRole = dbUser?.role?.toLowerCase() || role?.toLowerCase();
  const hasProfileImage = dbUser?.profile_image && dbUser.profile_image.trim() !== "";

  const filteredNotis = notificationList.filter(item => {
    if (notiFilter === 'all') return true;
    if (notiFilter === 'chat') return item.type === 'chat';
    if (notiFilter === 'project') return ['request', 'invite', 'request_update', 'co_advisor_invite'].includes(item.type);
    if (notiFilter === 'system') return item.type === 'system';
    if (notiFilter === 'appointment') return item.type === 'appointment';
    return true;
  });

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/70 sticky top-0 z-50 shadow-[0_4px_25px_rgba(0,0,0,0.03)] transition-all duration-200 relative">
      {/* 🌟 Subtle Gradient Accent Line at bottom of header */}
      <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent pointer-events-none"></div>

      <div className="w-full px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        <div className="flex items-center cursor-pointer gap-3 sm:gap-4 group" onClick={() => navigate("/dashboard")}>
          <div className="p-1.5 bg-gradient-to-br from-indigo-50/90 to-blue-50/90 rounded-2xl border border-indigo-100/80 shadow-sm group-hover:shadow-md group-hover:border-indigo-200 transition-all duration-300 shrink-0">
            <img 
              src="/PJ.png"
              alt="Project Logo" 
              className="w-9 h-9 object-contain rounded-xl shrink-0"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="hidden w-9 h-9 bg-indigo-600 text-white rounded-xl items-center justify-center shadow-sm shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
            </div>
          </div>
          <div>
            <h1 className="text-[13px] sm:text-base md:text-lg lg:text-xl font-bold text-slate-800 tracking-wide leading-tight group-hover:text-indigo-600 transition-colors">
              ระบบจัดหาที่ปรึกษาและติดตามโครงงานนักศึกษา
            </h1>
            <p className="hidden sm:block text-[10px] lg:text-[11px] text-slate-400 font-medium">
              Advisor Placement and Project Tracking System
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">

          
          {user ? (
            <>
              <div className="relative shrink-0" ref={notiRef}>
                <button 
                  onClick={() => setNotiOpen(!notiOpen)}
                  className={`relative p-2.5 rounded-2xl transition-all duration-200 border ${
                    notiOpen 
                      ? 'bg-indigo-50/90 text-indigo-600 border-indigo-200 shadow-inner' 
                      : 'bg-white/70 text-slate-500 hover:bg-white hover:text-indigo-600 hover:border-slate-200/80 border-slate-200/50 shadow-sm'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  
                  {notifications.total > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-rose-500 border-2 border-white rounded-full shadow-sm">
                      {notifications.total > 99 ? '99+' : notifications.total}
                    </span>
                  )}
                </button>

                {notiOpen && (
                  <div className="absolute -right-[76px] mt-3 w-[calc(100vw-32px)] sm:right-0 sm:w-[400px] bg-white border border-slate-200/80 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50 overflow-hidden animate-fade-in-down origin-top-right">
                    <div className="flex justify-between items-center px-5 py-4 bg-slate-50/80 border-b border-slate-100">
                      <span className="font-bold text-slate-800">การแจ้งเตือน</span>
                      <button onClick={handleMarkAllRead} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                        อ่านทั้งหมด
                      </button>
                    </div>

                    <div className="flex flex-wrap px-4 py-2.5 gap-2 border-b border-slate-100 bg-white">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setNotiFilter('all'); }} 
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${notiFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        ทั้งหมด
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setNotiFilter('appointment'); }} 
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${notiFilter === 'appointment' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        นัดหมาย
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setNotiFilter('project'); }} 
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${notiFilter === 'project' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        โครงงาน
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setNotiFilter('chat'); }} 
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${notiFilter === 'chat' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        แชท
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setNotiFilter('system'); }} 
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${notiFilter === 'system' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        ระบบ
                      </button>
                    </div>
                    
                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                      {filteredNotis.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">ไม่มีการแจ้งเตือนในหมวดหมู่นี้</div>
                      ) : (
                        filteredNotis.map((item, index) => (
                          <div 
                            key={`${item.type}-${item.id}-${index}`} 
                            className={`flex flex-col p-4 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${!item.is_read ? 'bg-indigo-50/30' : ''}`}
                            onClick={() => handleNotiClick(item)}
                          >
                            <div className="flex gap-4">
                              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border border-white ${
                                item.type === 'chat' ? 'bg-indigo-100 text-indigo-600' :
                                item.type === 'appointment' && item.title?.includes('ส่งงาน') ? 'bg-amber-100 text-amber-600' :
                                item.type === 'appointment' ? 'bg-purple-100 text-purple-600' :
                                item.type === 'request' || item.type === 'invite' || item.type === 'co_advisor_invite' ? 'bg-amber-100 text-amber-600' :
                                item.type === 'request_update' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.type === 'chat' && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                )}
                                {item.type === 'appointment' && !item.title?.includes('ตรวจงาน') && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                )}
                                {item.type === 'appointment' && item.title?.includes('ตรวจงาน') && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                                {(item.type === 'request' || item.type === 'invite' || item.type === 'co_advisor_invite' || item.type === 'room_invite' || item.type === 'project_invite') && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                )}
                                {item.type === 'request_update' && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                                {item.type === 'system' && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 pt-0.5 relative">
                                <div className="flex justify-between items-start gap-2">
                                  <p className={`text-[14px] leading-tight mb-0.5 ${!item.is_read ? 'font-bold' : 'font-semibold'} ${(item.title?.includes('ยกเลิก') || item.title?.includes('ปฏิเสธ') || item.title?.includes('ลบ')) ? 'text-rose-500' : (!item.is_read ? 'text-slate-900' : 'text-slate-800')}`}>
                                    {item.title}
                                  </p>
                                  {!item.is_read && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1 shadow-sm border border-white"></span>
                                  )}
                                </div>
                                <p className={`text-[13px] truncate ${(item.title?.includes('ยกเลิก') || item.title?.includes('ปฏิเสธ') || item.title?.includes('ลบ')) ? 'text-rose-400 font-medium' : (!item.is_read ? 'text-slate-700 font-medium' : 'text-slate-500')}`}>{item.message}</p>
                                {(item.type === 'room_invite' || item.type === 'project_invite' || (item.type === 'co_advisor_invite' && !item.is_read)) && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <button 
                                      onClick={(e) => handleDeclineInvite(item.type, item.raw_id, e)}
                                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[12px] font-bold rounded-lg transition-colors border border-slate-200"
                                    >
                                      ยกเลิก
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAcceptInvite(item.type, item.raw_id); }}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg transition-colors shadow-sm"
                                    >
                                      ยืนยัน
                                    </button>
                                  </div>
                                )}
                                
                                <p className="text-[11px] text-slate-400 mt-1.5 font-medium">{formatTime(item.time)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={menuRef}>
                <div 
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={`flex items-center space-x-3 cursor-pointer p-1.5 sm:px-3 sm:py-1.5 rounded-2xl transition-all duration-200 border ${
                    menuOpen 
                      ? 'bg-white shadow-md border-indigo-200' 
                      : 'bg-white/70 hover:bg-white border-slate-200/50 hover:border-indigo-200 hover:shadow-sm'
                  }`}
                >
                  <div className="relative shrink-0">
                    {hasProfileImage ? (
                      <img src={dbUser.profile_image} alt="Profile" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
                    ) : (
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-full flex items-center justify-center font-bold text-base sm:text-lg shadow-sm shrink-0">
                        {getInitial(displayFullName)}
                      </div>
                    )}
                    {(notifications.projects > ignoredProjectNoti || notifications.chat > 0 || notifications.appointments > 0) && (
                      <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full shadow-sm"></span>
                    )}
                  </div>
                  
                  <div className="hidden sm:block text-left pr-1">
                    <p className="text-sm font-bold text-slate-800 leading-tight">
                      {displayFullName}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {displayRoleText}
                    </p>
                  </div>

                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${menuOpen ? "rotate-180 text-indigo-600" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {menuOpen && (
                  <div className="absolute right-0 mt-3 w-64 max-w-[calc(100vw-32px)] bg-white border border-slate-200/80 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] py-2 z-50 animate-fade-in-down origin-top-right">
                    
                    <div className="px-5 py-3 border-b border-slate-50 mb-1 sm:hidden">
                      <p className="text-sm font-bold text-slate-800 truncate">{displayFullName}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{displayRoleText}</p>
                    </div>

                    <div className="px-5 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      เมนูนำทาง
                    </div>

                    <div className="px-2">
                      <button 
                        className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isActive("/profile")}`} 
                        onClick={() => { setMenuOpen(false); navigate("/profile"); }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        ข้อมูลส่วนตัว
                      </button>

                      {rawRole === "student" && dbUser?.requested_role?.toUpperCase() === "ADVISOR" && (
                        <div className="flex items-center w-full px-3 py-2.5 rounded-xl text-sm text-amber-700 bg-amber-50 cursor-not-allowed my-1 shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          รออนุมัติสิทธิ์อาจารย์
                        </div>
                      )}

                      {rawRole === "admin" && (
                        <button 
                          className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isActive("/admin")}`}
                          onClick={() => { setMenuOpen(false); navigate("/admin"); }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          จัดการระบบ (Admin)
                        </button>
                      )}

                      {rawRole === "advisor" && (
                        <button 
                          className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isActive("/advisor/requests")}`}
                          onClick={handleProjectMenuClick}
                        >
                          <div className="flex items-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                            คำขอที่ปรึกษา
                          </div>
                          {notifications.projects > ignoredProjectNoti && <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></span>}
                        </button>
                      )}

                      {(rawRole === "student" || rawRole === "admin") && (
                        <button 
                          className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isActive("/advisor/requests")}`}
                          onClick={handleProjectMenuClick}
                        >
                          <div className="flex items-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                            {rawRole === 'admin' ? 'ดูสถานะโครงงาน (Admin)' : 'สถานะโครงงาน'}
                          </div>
                          {notifications.projects > ignoredProjectNoti && <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></span>}
                        </button>
                      )}

                      <button 
                        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isActive("/project")}`}
                        onClick={() => { setMenuOpen(false); navigate("/project"); }}
                      >
                        <div className="flex items-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                          </svg>
                          โครงงานหลัก
                        </div>
                        {notifications.appointments > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></span>}
                      </button>

                      <button 
                        className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isActive("/create-room")}`}
                        onClick={() => { setMenuOpen(false); navigate("/create-room"); }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                        ห้องเรียน
                      </button>

                      <button 
                        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isActive("/chat")}`}
                        onClick={handleChatMenuClick}
                      >
                        <div className="flex items-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          แชท / ข้อความ
                        </div>
                        {notifications.chat > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></span>}
                      </button>
                    </div>

                    <div className="border-t border-slate-100 my-2"></div>

                    <div className="px-2 pb-1">
                      <button 
                        onClick={() => { setMenuOpen(false); confirmLogout(); }}
                        className="flex items-center w-full px-3 py-2.5 rounded-xl text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-semibold transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        ออกจากระบบ
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </>
          ) : (
            <button 
              onClick={() => navigate("/login")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              เข้าสู่ระบบ
            </button>
          )}

        </div>
      </div>
      

    </header>
  );
}
