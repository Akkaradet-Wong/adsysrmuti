// =============================================
// src/pages/CreateRoom.jsx
// =============================================
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Header from "../components/Header";
import Swal from "sweetalert2";

// ================= ICONS =================
const cardColors = [
  '#74b9ff', // Blue
  '#a29bfe', // Purple
  '#55efc4', // Green
  '#ffeaa7', // Yellow
  '#fab1a0', // Orange
  '#ff7675', // Red
  '#81ecec', // Teal
  '#fd79a8', // Pink
];

const getRoomColor = (roomId) => {
  let hash = 0;
  const str = String(roomId);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return cardColors[Math.abs(hash) % cardColors.length];
};

const Icon = {
  Building: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 21V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15" />
      <path d="M13 10h6a1 1 0 0 1 1 1v10" />
      <path d="M9 8h.01M9 11h.01M9 14h.01M9 17h.01" />
      <path d="M17 14h.01M17 17h.01" />
      <path d="M2 21h20" />
    </svg>
  ),
  Plus: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Dots: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  ),
  Edit: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  Trash: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
  Bolt: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  ),
  Lock: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  Crown: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8Z" />
    </svg>
  ),
  Shield: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" />
    </svg>
  ),
  CheckCircle: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.3 2.3L15.5 9" />
    </svg>
  ),
  Clock: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  XCircle: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5l5 5m0-5-5 5" />
    </svg>
  ),
  User: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
    </svg>
  ),
  Arrow: (p) => (
    <svg className="shrink-0" viewBox="0 0 20 20" fill="currentColor" {...p}>
      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
    </svg>
  ),
  Users: (p) => (
    <svg className="shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

export default function CreateRoom() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomStatuses, setRoomStatuses] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const isAdvisor = profile?.role?.toUpperCase() === "ADVISOR" || profile?.role?.toUpperCase() === "ADMIN";
  const isAdmin = profile?.role?.toUpperCase() === "ADMIN";

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initUser = async () => {
      try {
        setLoading(true);
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
          navigate("/login");
          return;
        }
        if (isMounted) setUser(session.user);

        const { data: profileData } = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", session.user.id)
          .maybeSingle();

        if (!profileData) {
          navigate("/login");
          return;
        }
        if (isMounted) setProfile(profileData);
      } catch (err) {
        console.error("Error loading user:", err);
      }
    };
    initUser();
    return () => { isMounted = false; };
  }, [navigate]);

  const fetchData = useCallback(async () => {
    if (!profile?.auth_id) return;
    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from("project_rooms")
        .select(`
          *,
          advisor:users!project_rooms_advisor_id_fkey(first_name, last_name, prefix),
          room_members(id, status)
        `)
        .order("created_at", { ascending: false });

      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      const { data: memberData, error: memberError } = await supabase
        .from("room_members")
        .select("room_id, status")
        .eq("user_id", profile.auth_id);

      if (memberError) throw memberError;

      const statusesMap = new Map();
      (memberData || []).forEach((m) => {
        statusesMap.set(String(m.room_id || m.id), m.status || 'approved');
      });
      setRoomStatuses(statusesMap);
    } catch (error) {
      console.error("Error fetching data:", error.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.auth_id]);

  useEffect(() => {
    if (user && profile?.auth_id) fetchData();
  }, [user, profile, location, fetchData]);

  useEffect(() => {
    if (!profile?.auth_id) return;
    const roomChannel = supabase.channel('realtime_project_rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_rooms' }, () => fetchData())
      .subscribe();

    const memberChannel = supabase.channel('realtime_room_members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(memberChannel);
    };
  }, [profile, fetchData]);

  const swalClasses = {
    popup: "rounded-3xl p-8 font-kanit shadow-2xl border border-slate-100",
    confirmButton: "rounded-xl font-medium px-8 py-3 shadow-sm hover:shadow-md transition-all",
    cancelButton: "rounded-xl font-medium px-8 py-3 text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all",
  };

  const toggleFieldHtml = (id, checked, label, helper) => `
    <div class="flex items-start gap-4 mt-1 bg-slate-50 p-4 rounded-2xl border border-slate-200">
      <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
        <input type="checkbox" id="${id}" class="sr-only peer" ${checked ? "checked" : ""}>
        <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
      <div class="text-left">
        <div class="font-medium text-slate-800 text-[15px]">${label}</div>
        <div class="text-slate-500 text-[13px] leading-snug mt-0.5">${helper}</div>
      </div>
    </div>
  `;

  const handleCreateRoom = async () => {
    if (!isAdvisor) return;
    const { value: formValues } = await Swal.fire({
      title: '<div class="text-xl font-semibold text-slate-800 text-left">เปิดรายวิชาใหม่</div>',
      html: `
        <div class="text-left mb-1.5 text-[14px] font-medium text-slate-700">ชื่อวิชา/ห้องเรียน <span class="text-rose-500">*</span></div>
        <input id="swal-title" class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 text-[15px] transition-all font-normal placeholder-slate-400 text-slate-900" placeholder="เช่น Project Web App 1/67">
        ${toggleFieldHtml("swal-auto-approve", false, "รับเข้าห้องอัตโนมัติ", "หากปิด นักศึกษาจะต้องส่งคำขอและรออาจารย์อนุมัติ")}
      `,
      focusConfirm: false,
      showCancelButton: true, reverseButtons: true,
      confirmButtonText: 'สร้างห้องเรียน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#f8fafc',
      customClass: swalClasses,
      preConfirm: () => {
        const title = document.getElementById('swal-title').value.trim();
        const autoApprove = document.getElementById('swal-auto-approve').checked;
        if (!title) return Swal.showValidationMessage('กรุณาระบุชื่อวิชา');
        return { title, autoApprove };
      }
    });

    if (formValues) {
      try {
        Swal.fire({ title: "กำลังสร้างห้อง...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { error } = await supabase.from("project_rooms").insert([{
          title: formValues.title,
          room_code: randomCode,
          auto_approve: formValues.autoApprove,
          advisor_id: profile.auth_id
        }]);
        if (error) throw error;
        await Swal.fire({
          icon: 'success',
          title: 'สร้างห้องสำเร็จ',
          text: formValues.autoApprove ? 'รายวิชานี้เปิดรับนักศึกษาอัตโนมัติ' : 'รายวิชานี้ต้องรออาจารย์อนุมัติผู้เข้าห้อง',
          confirmButtonText: 'รับทราบ',
          confirmButtonColor: '#2563eb',
          customClass: { popup: swalClasses.popup, confirmButton: swalClasses.confirmButton }
        });
        fetchData();
      } catch (error) {
        Swal.fire({ title: "ข้อผิดพลาด", text: error.message, icon: "error", customClass: { popup: swalClasses.popup, confirmButton: swalClasses.confirmButton } });
      }
    }
  };

  const handleEditRoom = async (room) => {
    const { value: formValues } = await Swal.fire({
      title: '<div class="text-xl font-semibold text-slate-800 text-left">แก้ไขข้อมูลห้องเรียน</div>',
      html: `
        <div class="text-left mb-1.5 text-[14px] font-medium text-slate-700">ชื่อวิชา/ห้องเรียน <span class="text-rose-500">*</span></div>
        <input id="edit-title" class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 text-[15px] transition-all font-normal placeholder-slate-400 text-slate-900" value="${room.title}">
        ${toggleFieldHtml("edit-auto-approve", room.auto_approve, "รับเข้าห้องอัตโนมัติ", "หากปิด นักศึกษาจะต้องส่งคำขอและรออาจารย์อนุมัติ")}
      `,
      focusConfirm: false,
      showCancelButton: true, reverseButtons: true,
      confirmButtonText: 'บันทึกการแก้ไข',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#f8fafc',
      customClass: swalClasses,
      preConfirm: () => {
        const title = document.getElementById('edit-title').value.trim();
        const autoApprove = document.getElementById('edit-auto-approve').checked;
        if (!title) return Swal.showValidationMessage('กรุณาระบุชื่อวิชา');
        return { title, autoApprove };
      }
    });

    if (formValues) {
      try {
        Swal.fire({ title: "กำลังบันทึก...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const roomId = String(room.room_id || room.id);
        const { error } = await supabase
          .from("project_rooms")
          .update({ title: formValues.title, auto_approve: formValues.autoApprove })
          .eq("room_id", roomId);
        if (error) throw error;
        await Swal.fire({ icon: 'success', title: 'อัปเดตข้อมูลสำเร็จ', showConfirmButton: false, timer: 1400, customClass: { popup: swalClasses.popup } });
        fetchData();
      } catch (error) {
        Swal.fire({ title: "ข้อผิดพลาด", text: error.message, icon: "error", customClass: { popup: swalClasses.popup, confirmButton: swalClasses.confirmButton } });
      }
    }
  };

  const handleEnterRoom = async (e, room, isPending) => {
    if (e) e.stopPropagation();

    const roomId = String(room.room_id || room.id);
    const isOwner = room.advisor_id === profile?.auth_id;
    const isAdvisorCheck = profile?.role?.toUpperCase() === "ADVISOR" || profile?.role?.toUpperCase() === "ADMIN" || profile?.requested_role === "ADVISOR";
    const canManage = isOwner || isAdmin;
    const roomStatus = roomStatuses.get(roomId);
    const hasJoined = roomStatus === 'approved';

    // 1. ถ้าเป็นเจ้าของห้อง, หรือแอดมิน, หรืออาจารย์, หรือได้รับการอนุมัติแล้ว -> เข้าห้องเรียนได้ทันที
    if (canManage || hasJoined || isAdvisorCheck) {
      navigate(`/classroom/${roomId}`);
      return;
    }

    // 2. ถ้ากำลังรออนุมัติ -> แจ้งเตือนสถานะ
    if (isPending || roomStatus === 'pending') {
      Swal.fire({
        title: "อยู่ระหว่างรอการอนุมัติ",
        text: "คำขอเข้าร่วมห้องเรียนของคุณกำลังรออาจารย์ผู้สอนยืนยันการอนุมัติ",
        icon: "info",
        confirmButtonColor: "#2563eb",
        confirmButtonText: "รับทราบ",
        customClass: swalClasses
      });
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title: '<div class="text-xl font-semibold text-slate-800">ยืนยันการเข้าร่วม</div>',
      html: `คุณต้องการขอเข้าร่วมวิชา <b class="text-blue-600">${room.title}</b> ใช่หรือไม่?`,
      icon: 'question',
      showCancelButton: true, reverseButtons: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#f8fafc",
      confirmButtonText: room.auto_approve ? "เข้าร่วมเลย" : "ส่งคำขอเข้าร่วม",
      cancelButtonText: "ยกเลิก",
      customClass: swalClasses,
    });

    if (isConfirmed) {
      const joinStatus = room.auto_approve ? 'approved' : 'pending';
      requestJoinRoom(roomId, joinStatus);
    }
  };

  const requestJoinRoom = async (roomId, status) => {
    try {
      Swal.fire({ title: "กำลังดำเนินการ...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const { data: existingMember } = await supabase
        .from("room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", profile.auth_id)
        .maybeSingle();

      let errorResult;
      if (existingMember) {
        const { error } = await supabase.from("room_members").update({ status: status }).eq("id", existingMember.id);
        errorResult = error;
      } else {
        const { error } = await supabase.from("room_members").insert({ room_id: roomId, user_id: profile.auth_id, status: status });
        errorResult = error;
      }

      if (errorResult) throw errorResult;
      setRoomStatuses(prev => new Map(prev).set(roomId, status));

      if (status === 'approved') {
        await Swal.fire({ icon: "success", title: "เข้าร่วมสำเร็จ", text: "คุณได้เข้าร่วมรายวิชานี้เรียบร้อยแล้ว", confirmButtonColor: "#2563eb", confirmButtonText: "ไปที่ห้องเรียน", customClass: { popup: swalClasses.popup, confirmButton: swalClasses.confirmButton } });
        navigate(`/classroom/${roomId}`);
      } else {
        await Swal.fire({ icon: "success", title: "ส่งคำขอสำเร็จ", text: "ระบบได้ส่งคำขอไปยังอาจารย์ผู้สอนแล้ว กรุณารอการอนุมัติเพื่อเข้าสู่ห้องเรียน", confirmButtonColor: "#2563eb", confirmButtonText: "รับทราบ", customClass: { popup: swalClasses.popup, confirmButton: swalClasses.confirmButton } });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ title: "ข้อผิดพลาด", text: "ไม่สามารถดำเนินการได้", icon: "error", customClass: { popup: swalClasses.popup, confirmButton: swalClasses.confirmButton } });
    }
  };

  const handleDeleteRoom = async (e, room) => {
    if (e) e.stopPropagation();
    const confirm = await Swal.fire({
      title: '<div class="text-xl font-semibold text-slate-800">ยืนยันการลบห้องเรียน</div>',
      html: `คุณกำลังจะลบวิชา <b class="text-rose-600">${room.title}</b><br><br><span class="text-sm font-normal text-rose-500 bg-rose-50 border border-rose-100 p-3 rounded-xl block mb-4">ข้อมูลการเข้าร่วมของนักศึกษาในห้องนี้จะถูกลบออกทั้งหมด</span><div class="text-left text-sm font-medium text-slate-700 mb-1.5">พิมพ์ <span class="font-bold text-rose-600">${room.title}</span> เพื่อยืนยันการลบ</div>`,
      input: 'text',
      inputPlaceholder: room.title,
      icon: 'warning',
      showCancelButton: true, reverseButtons: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#f8fafc',
      confirmButtonText: 'ลบห้องเรียน',
      cancelButtonText: 'ยกเลิก',
      customClass: swalClasses,
      preConfirm: (inputValue) => {
        if (inputValue !== room.title) {
          Swal.showValidationMessage('ชื่อห้องเรียนไม่ตรงกัน กรุณาพิมพ์ให้ถูกต้อง');
          return false;
        }
        return true;
      }
    });

    if (confirm.isConfirmed) {
      try {
        Swal.fire({ title: "กำลังลบ...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const roomId = String(room.room_id || room.id);
        const { error } = await supabase.from("project_rooms").delete().eq("room_id", roomId);
        if (error) throw error;
        Swal.fire({ title: "ลบสำเร็จ", text: "ห้องเรียนถูกลบออกจากระบบแล้ว", icon: "success", confirmButtonColor: "#2563eb", customClass: { popup: swalClasses.popup, confirmButton: swalClasses.confirmButton } });
        fetchData();
      } catch (err) {
        console.error(err);
        Swal.fire({ title: "ข้อผิดพลาด", text: "ไม่สามารถลบห้องเรียนได้", icon: "error", customClass: { popup: swalClasses.popup, confirmButton: swalClasses.confirmButton } });
      }
    }
  };

  return (
    <div className="min-h-screen bg-transparent font-kanit flex flex-col relative transition-colors duration-200">

      <Header
        user={user}
        role={profile?.role}
        fullName={profile ? `${profile.first_name} ${profile.last_name}` : ""}
        profileImage={profile?.profile_image}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 relative z-10">

        {/* ===== Page header ===== */}
        <div className="mb-10 mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div className="flex items-center gap-4">
            <span className="p-3 bg-white shadow-sm rounded-2xl border border-slate-100 text-blue-600">
              <Icon.Building className="w-7 h-7" />
            </span>
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-800 tracking-tight">
                รายวิชาทั้งหมด
              </h2>
              <p className="text-slate-500 mt-1 text-[14px] font-normal">
                {isAdvisor ? "จัดการรายวิชาที่คุณสร้าง หรือดูรายวิชาของอาจารย์ท่านอื่น" : "ส่งคำขอเข้าร่วมรายวิชาโดยการเลือกจากรายการด้านล่าง"}
              </p>
            </div>
          </div>

          {isAdvisor && (
            <button
              onClick={handleCreateRoom}
              className="hidden sm:inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-[14px] px-5 py-3 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <Icon.Plus className="w-4 h-4" />
              เปิดรายวิชาใหม่
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-10 h-10 border-[3px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <div className="text-slate-500 font-medium tracking-wide text-[14px]">กำลังประมวลผลข้อมูล...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">

            {/* การ์ด: เปิดรายวิชาใหม่ (มือถือ / โชว์เฉพาะ Advisor / Admin) */}
            {isAdvisor && (
              <div
                onClick={handleCreateRoom}
                className="sm:hidden bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border-2 border-dashed border-blue-300 hover:border-blue-400 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[260px] cursor-pointer transition-all duration-300 group shadow-sm hover:shadow-md"
              >
                <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 shadow-lg shadow-blue-500/25 transition-all duration-300 shrink-0">
                  <Icon.Plus className="w-6 h-6" />
                </div>
                <span className="font-semibold text-slate-800 text-[16px]">เปิดรายวิชาใหม่</span>
                <span className="text-[13px] text-slate-500 mt-1 font-normal">แตะเพื่อสร้างห้องเรียน</span>
              </div>
            )}

            {/* รายการห้องเรียนทั้งหมด */}
            {rooms.length > 0 ? (
              rooms.map((room) => {
                const roomId = String(room.room_id || room.id);
                const isOwner = room.advisor_id === profile?.auth_id;
                const canManage = isOwner || isAdmin;

                const status = roomStatuses.get(roomId);
                const hasJoined = status === 'approved';
                const isPending = status === 'pending';
                const advisor = room.advisor;
                return (
                  <div
                    key={roomId}
                    onClick={(e) => handleEnterRoom(e, room, isPending)}
                    className={`bg-white border flex flex-col relative group overflow-hidden rounded-2xl ${isPending && !canManage ? 'border-slate-200 opacity-70 cursor-default' : 'border-slate-200 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1.5 cursor-pointer transition-all duration-300'} h-[320px]`}
                  >
                    {/* Banner */}
                    <div className="h-36 w-full relative shrink-0" 
                         style={{
                           backgroundColor: getRoomColor(roomId),
                           backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                           backgroundSize: '20px 20px'
                         }}>
                    </div>

                    <div className="p-6 flex-1 flex flex-col relative">
                      {/* Options Button */}
                      {canManage && (
                        <div className="absolute top-4 right-4 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === roomId ? null : roomId);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
                              <circle cx="5" cy="12" r="2.5" />
                              <circle cx="12" cy="12" r="2.5" />
                              <circle cx="19" cy="12" r="2.5" />
                            </svg>
                          </button>

                          {openDropdownId === roomId && (
                            <div className="absolute top-9 right-0 bg-white shadow-xl border border-slate-100 py-1 w-44 z-50 rounded-xl overflow-hidden">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditRoom(room); setOpenDropdownId(null); }}
                                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                              >
                                แก้ไขข้อมูล
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRoom(e, room); setOpenDropdownId(null); }}
                                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2"
                              >
                                ลบรายวิชา
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Header Texts */}
                      <div className="pr-10 mb-2">
                        <div className="text-[13px] text-slate-500 font-medium mb-1.5">
                          สาขาวิชาวิศวกรรมคอมพิวเตอร์
                        </div>
                        <div className="text-[17px] text-slate-900 font-extrabold hover:text-blue-600 transition-colors cursor-pointer line-clamp-2 leading-snug" title={`${room.title} / อ.${advisor?.first_name || 'ไม่ระบุ'}`}>
                          {room.title} <span className="text-[14px] text-slate-500 font-medium whitespace-nowrap">/ อ.{advisor?.first_name || "ไม่ระบุ"}</span>
                        </div>
                      </div>

                      {/* Footer Info (Members & Status) */}
                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">สมาชิกในห้อง</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-slate-800 leading-none">{room.room_members?.filter(m => m.status === 'approved').length || 0}</span>
                            <span className="text-[13px] font-bold text-slate-500">คน</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1.5">
                          {room.auto_approve ? (
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              เปิดรับอัตโนมัติ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" /></svg>
                              ต้องรออนุมัติ
                            </span>
                          )}
                          
                          {/* User Status Badge */}
                          {(() => {
                            if (isOwner) return <span className="text-[12px] text-blue-600 font-extrabold mt-0.5">⭐ วิชาของคุณ</span>;
                            if (isAdmin) return <span className="text-[12px] text-purple-600 font-extrabold mt-0.5">🛡️ แอดมิน</span>;
                            if (hasJoined) return <span className="text-[12px] text-emerald-600 font-extrabold mt-0.5">✓ เข้าร่วมแล้ว</span>;
                            if (isPending) return <span className="text-[12px] text-amber-600 font-extrabold mt-0.5">⏳ รอดำเนินการ</span>;
                            const status = roomStatuses.get(roomId);
                            if (status === 'rejected') return <span className="text-[12px] text-rose-600 font-extrabold mt-0.5">✕ ถูกปฏิเสธ</span>;
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mb-5 shrink-0">
                  <Icon.Building className="w-8 h-8" />
                </div>
                <h3 className="text-slate-800 text-lg font-medium mb-1.5">ยังไม่มีรายวิชาในระบบ</h3>
                <p className="text-slate-400 text-[14px] font-normal">ระบบยังไม่มีรายวิชาเปิดสอนในขณะนี้</p>
              </div>
            )}
          </div>
        )}
      </main>

      {isAdvisor && (
        <button
          onClick={handleCreateRoom}
          className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg flex items-center justify-center transition-all z-40"
          title="เปิดรายวิชาใหม่"
        >
          <Icon.Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}